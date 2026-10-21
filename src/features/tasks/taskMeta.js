// Derived task facts shared by the Task Management table and the Task Detail panel:
// metadata (customer, category, status notes), elapsed/normal time, SLA status, and the
// client mirror of the server state machine (server/src/lib/stateMachine.js stays authoritative).

export function taskMeta(t) {
  try {
    return JSON.parse(t?.metadata || '{}') || {}
  } catch {
    return {}
  }
}

/** "Order Related" | "General" — explicit on new tasks, inferred from the module for older ones. */
export function taskCategory(t) {
  const m = taskMeta(t)
  if (m.category) return m.category
  return /order/i.test(t?.entityType || '') ? 'Order Related' : 'General'
}

export const CATEGORY_STYLE = {
  'Order Related': { bg: '#EAF2FF', fg: '#1A66E5' },
  General: { bg: '#F1EBFD', fg: '#6B47D6' },
}

const HOUR = 3_600_000

/** Working time since the task was started; stops at submission (or completion). */
export function elapsedMs(t, now = Date.now()) {
  if (!t?.startedAt) return null
  const end =
    (['Submitted', 'Completed'].includes(t.status) && (t.submittedAt || t.completedAt)) ||
    (t.status === 'Cancelled' && t.updatedAt) ||
    now
  return Math.max(0, new Date(end) - new Date(t.startedAt))
}

/**
 * SLA status of a task.
 * Routine tasks carry explicit thresholds (snapshotted from Task Settings) on elapsed time:
 *   < slaCriticalMinutes → Normal · ≥ slaCriticalMinutes → Critical · ≥ slaDelayedMinutes → Delayed
 * Other tasks are judged against their normal time (estimatedMinutes):
 *   Critical at ≥ 75% of it, Delayed once exceeded.
 * Either way, missing the due date is Delayed and being due within 2 hours is at least Critical.
 * Finished tasks are judged at the moment they were submitted. Cancelled → null.
 */
export function slaStatus(t, now = Date.now()) {
  if (!t || t.status === 'Cancelled') return null
  const MIN = 60_000
  const hasRules = t.slaCriticalMinutes != null && t.slaDelayedMinutes != null
  const critAt = hasRules ? t.slaCriticalMinutes * MIN : t.estimatedMinutes ? 0.75 * t.estimatedMinutes * MIN : null
  const delayAt = hasRules ? t.slaDelayedMinutes * MIN : t.estimatedMinutes ? t.estimatedMinutes * MIN : null
  const el = elapsedMs(t, now)
  const due = t.dueAt ? new Date(t.dueAt).getTime() : null

  if (['Submitted', 'Completed'].includes(t.status)) {
    const doneAt = new Date(t.submittedAt || t.completedAt || now).getTime()
    if ((due && doneAt > due) || (delayAt && el != null && el >= delayAt)) return 'Delayed'
    return hasRules && el != null && el >= critAt ? 'Critical' : 'Normal'
  }
  if ((due && now > due) || (delayAt && el != null && el >= delayAt)) return 'Delayed'
  if ((critAt && el != null && el >= critAt) || (due && due - now <= 2 * HOUR)) return 'Critical'
  return 'Normal'
}

export const SLA_STYLE = {
  Normal: { bg: '#E7F6EC', fg: '#1E7B34', hint: 'On track' },
  Critical: { bg: '#FFF1E0', fg: '#C25E00', hint: 'At risk — past the critical threshold, or due within 2 hours' },
  Delayed: { bg: '#FDE7E9', fg: '#D13438', hint: 'Past the delayed threshold or the due date' },
}

export function fmtDuration(ms) {
  if (ms == null) return '—'
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1) return '<1m'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (!h) return `${m}m`
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h` // "49d 0h" reads better than "1176h 37m"
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
}

export function fmtMinutes(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function fmtClock(seconds) {
  if (seconds == null || !isFinite(seconds)) return '--:--'
  const s = Math.round(seconds)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── State machine mirror (labels + who may fire each event) ───────────────────
const TRANSITIONS = [
  { event: 'accept', label: 'Accept task', from: ['Assigned'], who: 'assignee', onlyIf: (t) => t.requiresAcceptance },
  { event: 'start', label: 'Start task', from: ['Assigned', 'Accepted', 'Reopened'], who: 'assignee' },
  { event: 'resume', label: 'Resume', from: ['On Hold', 'Waiting'], who: 'assignee' },
  { event: 'pause', label: 'Put on hold', from: ['In Progress'], who: 'assignee' },
  { event: 'submit', label: 'Submit for review', from: ['In Progress'], who: 'assignee' },
  { event: 'approve', label: 'Approve', from: ['Submitted'], who: 'reviewer' },
  { event: 'reject', label: 'Reject', from: ['Submitted'], who: 'reviewer', danger: true },
  { event: 'reopen', label: 'Reopen', from: ['Rejected'], who: 'reviewer' },
  {
    event: 'cancel', label: 'Cancel task', who: 'reviewer', danger: true,
    from: ['Pending', 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Waiting', 'Rejected'],
  },
]

export function allowedEvents(t, user) {
  if (!t || !user) return []
  const isAdmin = user.role === 'ADMIN'
  const isAssignee = t.assignedUser?.id === user.id
  const isCreator = t.createdBy?.id === user.id
  return TRANSITIONS.filter((x) => {
    if (!x.from.includes(t.status)) return false
    if (x.onlyIf && !x.onlyIf(t)) return false
    if (x.who === 'assignee') return isAssignee || isAdmin
    return isCreator || isAdmin
  })
}

export const DELAY_REASONS = [
  'Waiting on customer',
  'Waiting on another department',
  'Missing information / files',
  'Rework requested',
  'Technical / system issue',
  'High workload',
  'Other',
]

/** Where a task opens: the Task Management page with its side panel (admin home is "/"). */
export function taskPanelPath(user, id) {
  return (user?.role === 'ADMIN' ? '/' : '/all-tasks') + '?task=' + id
}
