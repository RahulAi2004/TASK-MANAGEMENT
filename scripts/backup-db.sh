#!/usr/bin/env bash
# Safe online copy of the Task Management SQLite database (works while the app is running).
#   scripts/backup-db.sh            → daily copy in $BACKUP_DIR, copies older than $KEEP_DAYS days removed
#   scripts/backup-db.sh predeploy  → one-off copy taken by deploy.sh (also kept $KEEP_DAYS days)
# Cron (installed on the server): 15 2 * * * /opt/task-management/scripts/backup-db.sh >> /var/log/task-management-backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/task-management-daily}"
KEEP_DAYS="${KEEP_DAYS:-14}"
LABEL="${1:-daily}"

# DATABASE_URL="file:./dev.db" is relative to server/prisma (Prisma's rule)
url="$(grep -E '^DATABASE_URL=' "$APP_DIR/server/.env" | head -1 | cut -d= -f2- | tr -d '"'"'")"
db="${url#file:}"
[[ "$db" = /* ]] || db="$APP_DIR/server/prisma/${db#./}"
[[ -f "$db" ]] || { echo "backup: database not found at $db" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/task-management-$LABEL-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$db" ".backup '$out'"
# a backup that cannot be opened is worse than none — check it before trusting it
[[ "$(sqlite3 "$out" 'PRAGMA integrity_check;')" == "ok" ]] || { echo "backup: integrity check failed for $out" >&2; exit 1; }
gzip -f "$out"
find "$BACKUP_DIR" -name 'task-management-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') backup ok: $out.gz ($(du -h "$out.gz" | cut -f1))"
