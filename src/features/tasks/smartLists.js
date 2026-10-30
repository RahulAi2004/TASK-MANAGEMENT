// The phone home screen's Smart Lists. Each is a saved question over the tasks a person can see,
// so the counts are always real. Open-only lists show closed tasks only if a status filter asks.
import { Sun, Star, Calendar, CheckCircle2, User } from 'lucide-react'

export const isOpenTask = (t) => !['Completed', 'Cancelled'].includes(t.status)

const endOfToday = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export const SMART_LISTS = [
  // Late work still has to be done today, so it stays in My Day
  { key: 'my-day', label: 'My Day', icon: Sun, color: '#2563EB', test: (t, user) => t.assignedUser?.id === user.id && t.dueAt && new Date(t.dueAt) <= endOfToday() },
  { key: 'important', label: 'Important', icon: Star, color: '#EF4444', test: (t) => ['Urgent', 'High'].includes(t.priority) },
  { key: 'planned', label: 'Planned', icon: Calendar, color: '#16A34A', test: (t) => Boolean(t.dueAt) },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: '#16A34A', closed: true, test: (t) => t.status === 'Completed' },
  { key: 'assigned', label: 'Assigned to me', icon: User, color: '#8B5CF6', test: (t, user) => t.assignedUser?.id === user.id },
]

/** Is this task in the list? statusFiltered = the person picked a status, so don't hide closed tasks. */
export function inSmartList(list, t, user, statusFiltered = false) {
  return Boolean(list.test(t, user)) && (Boolean(list.closed) || statusFiltered || isOpenTask(t))
}

export const GROUP_COLORS = ['#2563EB', '#16A34A', '#8B5CF6', '#F97316', '#06B6D4', '#EAB308', '#EF4444']
