// Task lifecycle — single source of truth (docs/TECHNICAL_DESIGN.md §6).
// event: { from: [allowed source statuses], to, activityType, who }
// who: 'assignee' | 'reviewer' | 'admin_or_creator'

export const TRANSITIONS = {
  accept:  { from: ['Assigned'], to: 'Accepted', activityType: 'Accepted', who: 'assignee' },
  start:   { from: ['Assigned', 'Accepted', 'Reopened'], to: 'In Progress', activityType: 'Started', who: 'assignee' },
  pause:   { from: ['In Progress'], to: 'On Hold', activityType: 'Paused', who: 'assignee' },
  resume:  { from: ['On Hold', 'Waiting'], to: 'In Progress', activityType: 'Resumed', who: 'assignee' },
  submit:  { from: ['In Progress'], to: 'Submitted', activityType: 'Submitted', who: 'assignee' },
  approve: { from: ['Submitted'], to: 'Completed', activityType: 'Approved', who: 'reviewer' },
  reject:  { from: ['Submitted'], to: 'Rejected', activityType: 'Rejected', who: 'reviewer' },
  reopen:  { from: ['Rejected'], to: 'Assigned', activityType: 'Reopened', who: 'reviewer' },
  cancel:  { from: ['Pending', 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Waiting', 'Rejected'], to: 'Cancelled', activityType: 'Cancelled', who: 'admin_or_creator' },
}

export function canPerform(event, task, user) {
  const t = TRANSITIONS[event]
  if (!t) return { ok: false, error: `Unknown event "${event}"` }
  if (!t.from.includes(task.status)) {
    return { ok: false, error: `Cannot ${event} a task in status "${task.status}"` }
  }
  const isAssignee = task.assignedUserId === user.id
  const isCreator = task.createdById === user.id
  const isAdmin = user.role === 'ADMIN'

  if (t.who === 'assignee' && !(isAssignee || isAdmin)) {
    return { ok: false, error: 'Only the assignee can do this' }
  }
  // reviewer = task creator (the delegator) or admin
  if (t.who === 'reviewer' && !(isCreator || isAdmin)) {
    return { ok: false, error: 'Only the reviewer can do this' }
  }
  if (t.who === 'admin_or_creator' && !(isAdmin || isCreator)) {
    return { ok: false, error: 'Only an admin or the task creator can do this' }
  }
  return { ok: true, transition: t }
}
