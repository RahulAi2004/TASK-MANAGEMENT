#!/usr/bin/env bash
# Deploy the latest GitHub code on the server — run it ON the server:
#   cd /opt/task-management && scripts/deploy.sh [branch]        (default branch: main)
#   add --clear-old-reminders once to mark the old hourly reminders read
#
# It refuses to run when the server has work that is not on GitHub (edited files or local
# commits), so a deploy can never wipe out a fix that was made directly on the server.
# Order: checks → database backup → update code → build into dist-new → migrate → swap → restart
# → health check. If the health check fails, the previous frontend is put back.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PM2_NAME="${PM2_NAME:-task-app}"
BRANCH=main
CLEAR_REMINDERS=0
for arg in "$@"; do
  case "$arg" in
    --clear-old-reminders) CLEAR_REMINDERS=1 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) BRANCH="$arg" ;;
  esac
done
cd "$APP_DIR"
step() { printf '\n▶ %s\n' "$*"; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

step "Checking the server has no work missing from GitHub"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no
  fail "Files were edited directly on the server (above). Commit and push them to GitHub first, or discard them — nothing was changed."
fi
git fetch --quiet origin
local_only="$(git log --oneline HEAD --not --remotes=origin)"
if [[ -n "$local_only" ]]; then
  echo "$local_only"
  fail "These commits exist only on the server. Push them to GitHub (git push origin HEAD:<branch>) first — nothing was changed."
fi
git merge-base --is-ancestor HEAD "origin/$BRANCH" \
  || fail "origin/$BRANCH does not contain the code running now — merge it on GitHub first. Nothing was changed."
if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "Already up to date with origin/$BRANCH ($(git rev-parse --short HEAD)); rebuilding anyway."
fi

step "Backing up the database"
"$APP_DIR/scripts/backup-db.sh" predeploy

step "Updating code to origin/$BRANCH"
previous="$(git rev-parse --short HEAD)"
git merge --ff-only "origin/$BRANCH"
echo "$previous → $(git rev-parse --short HEAD)"

step "Building the frontend (the live site keeps running meanwhile)"
npm ci --no-audit --no-fund
rm -rf dist-new
npx vite build --outDir dist-new

step "Updating the API and database schema"
(cd server && npm ci --no-audit --no-fund && npx prisma migrate deploy && npx prisma generate)

step "Switching to the new version"
rm -rf dist-old
[[ -d dist ]] && mv dist dist-old
mv dist-new dist
pm2 restart "$PM2_NAME" --update-env

step "Health check"
port="$(grep -E '^PORT=' server/.env | cut -d= -f2 | tr -d '"'"'" || true)"
port="${port:-4000}"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
    echo "API healthy on port $port"
    rm -rf dist-old
    if [[ $CLEAR_REMINDERS == 1 ]]; then
      step "Marking old hourly reminders read"
      (cd server && node scripts/clear-old-reminders.mjs --apply)
    fi
    printf '\n✔ Deployed %s (was %s)\n' "$(git rev-parse --short HEAD)" "$previous"
    exit 0
  fi
  sleep 1
done

# Not healthy: put the old frontend back and show the log. The code/schema stay updated, so
# a full rollback is: git reset --hard <previous> + restore the predeploy backup.
[[ -d dist-old ]] && { rm -rf dist; mv dist-old dist; }
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
fail "The API did not come back. Previous frontend restored. Full rollback: git reset --hard $previous, restore the newest predeploy backup from /root/backups/task-management-daily, then pm2 restart $PM2_NAME."
