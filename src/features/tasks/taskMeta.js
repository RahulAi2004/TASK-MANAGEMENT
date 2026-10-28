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

/** "Order Related" | "General" | "Admin" — explicit on new tasks, inferred from the module for older ones. */
export function taskCategory(t) {
  const m = taskMeta(t)
  if (m.category) return m.category
  return /order/i.test(t?.entityType || '') ? 'Order Related' : 'General'
}

export const CATEGORIES = ['Order Related', 'General', 'Admin']
export const CATEGORY_STYLE = {
  'Order Related': { bg: '#EAF2FF', fg: '#1A66E5' },
  General: { bg: '#F1EBFD', fg: '#6B47D6' },
  Admin: { bg: '#E6F6F4', fg: '#0F7B6C' },
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

// `label` is what people see; the keys stay the stored/computed values (Task Settings still
// defines the Normal / Critical / Delayed thresholds by those names).
export const SLA_STYLE = {
  Normal: { label: 'On track', bg: '#E7F6EC', fg: '#1E7B34', hint: 'On track — within its target time' },
  Critical: { label: 'At risk', bg: '#FFF1E0', fg: '#C25E00', hint: 'At risk — close to its time limit, or due within 2 hours' },
  Delayed: { label: 'Delayed', bg: '#FDE7E9', fg: '#D13438', hint: 'Delayed — past its time limit or due date' },
}

// ── Plain-language status (what people read; the stored status values are unchanged) ──
export const STATUS_LABEL = {
  Pending: 'Not assigned',
  Assigned: 'To do',
  Accepted: 'To do',
  'In Progress': 'In progress',
  'On Hold': 'Paused',
  Waiting: 'Blocked',
  Submitted: 'In review',
  Completed: 'Done',
  Rejected: 'Sent back',
  Reopened: 'To do',
  Cancelled: 'Cancelled',
  Overdue: 'Late',
}
export const statusLabel = (s) => STATUS_LABEL[s] || s

const firstName = (u) => (u?.name || '').split(' ')[0] || 'someone'

/** One sentence saying where the task stands and who has to act next. */
export function statusSentence(t, user) {
  const me = t.assignedUser?.id === user?.id
  const reviewerIsMe = t.createdBy?.id === user?.id || user?.role === 'ADMIN'
  switch (t.status) {
    case 'Pending':
      return t.assignedUser ? `Waiting for ${me ? 'you' : firstName(t.assignedUser)} to start` : 'Nobody is assigned yet'
    case 'Assigned':
    case 'Accepted':
    case 'Reopened':
      return me ? 'Ready for you to start' : `Waiting for ${firstName(t.assignedUser)} to start`
    case 'In Progress':
      return me ? 'You are working on this' : `${firstName(t.assignedUser)} is working on this`
    case 'On Hold':
      return 'Paused — resume when ready'
    case 'Waiting':
      return 'Blocked — waiting for another task to finish'
    case 'Submitted':
      return reviewerIsMe ? 'Finished — ready for your review' : `Finished — waiting for ${firstName(t.createdBy)} to review`
    case 'Rejected':
      return 'Sent back — needs changes'
    case 'Completed':
      return 'Done'
    case 'Cancelled':
      return 'Cancelled'
    default:
      return statusLabel(t.status)
  }
}

/** Due date in words: "Due in 3h", "Due tomorrow, 5:00 PM", "2 days late", "Done". */
export function dueLabel(t, now = Date.now()) {
  if (t.status === 'Completed') return { text: 'Done', tone: 'done' }
  if (t.status === 'Cancelled') return { text: '—', tone: 'muted' }
  if (!t.dueAt) return { text: 'No due date', tone: 'muted' }
  const due = new Date(t.dueAt)
  const diff = due - now
  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000)
  if (diff < 0) {
    const late = -diff
    if (late < HOUR) return { text: `${Math.max(1, Math.round(late / 60_000))}m late`, tone: 'late' }
    if (late < 24 * HOUR) return { text: `${Math.round(late / HOUR)}h late`, tone: 'late' }
    const d = Math.round(late / (24 * HOUR))
    return { text: `${d} day${d === 1 ? '' : 's'} late`, tone: 'late' }
  }
  if (diff < HOUR) return { text: `Due in ${Math.max(1, Math.round(diff / 60_000))}m`, tone: 'soon' }
  if (days === 0) return { text: `Due today, ${fmtTime(t.dueAt)}`, tone: diff < 2 * HOUR ? 'soon' : 'ok' }
  if (days === 1) return { text: `Due tomorrow, ${fmtTime(t.dueAt)}`, tone: 'ok' }
  if (days < 7) return { text: `Due ${due.toLocaleDateString('en-US', { weekday: 'long' })}`, tone: 'ok' }
  return { text: `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, tone: 'ok' }
}
export const DUE_TONE = { late: 'text-status-danger font-semibold', soon: 'text-[#C25E00] font-medium', ok: 'text-ink', done: 'text-[#1E7B34] font-medium', muted: 'text-ink-tertiary' }

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
// `primary` marks the step that moves a task forward — shown as the big button; the rest are
// secondary (smaller buttons / "More"). Order = display order.
const TRANSITIONS = [
  { event: 'accept', label: 'Accept', from: ['Assigned'], who: 'assignee', primary: true, onlyIf: (t) => t.requiresAcceptance },
  { event: 'start', label: 'Start', from: ['Assigned', 'Accepted', 'Reopened'], who: 'assignee', primary: true },
  { event: 'resume', label: 'Resume', from: ['On Hold', 'Waiting'], who: 'assignee', primary: true },
  { event: 'submit', label: 'Send for review', from: ['In Progress'], who: 'assignee', primary: true },
  { event: 'approve', label: 'Approve', from: ['Submitted'], who: 'reviewer', primary: true },
  { event: 'reopen', label: 'Reopen', from: ['Rejected'], who: 'reviewer', primary: true },
  { event: 'pause', label: 'Pause', from: ['In Progress'], who: 'assignee' },
  { event: 'reject', label: 'Send back', from: ['Submitted'], who: 'reviewer', danger: true },
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
