// Tasks — admin gets All / Team / My scope tabs; everyone else sees only My Tasks.
import { useState } from 'react'
import { Search } from 'lucide-react'
import AppShell from '../app/AppShell'
import TaskTable from '../features/tasks/TaskTable'
import { api } from '../data/api'
import { useApi, useAuth } from '../auth/AuthContext'

const STATUSES = ['All', 'Assigned', 'In Progress', 'Submitted', 'Completed', 'Overdue']
const SCOPES = [
  { key: 'all', label: 'All Tasks' },
  { key: 'team', label: 'Team Tasks' },
  { key: 'mine', label: 'My Tasks' },
]

export default function AllTasks() {
  const { user } = useAuth()
  const isAdmin = user.role === 'ADMIN'
  const [scope, setScope] = useState(isAdmin ? 'all' : 'mine')
  const [status, setStatus] = useState('All')
  const [q, setQ] = useState('')

  // Non-admins are always locked to their own tasks.
  const effectiveScope = isAdmin ? scope : 'mine'
  const { data, loading, reload } = useApi(
    () => api.tasks({ scope: effectiveScope, ...(status !== 'All' ? { status } : {}), ...(q ? { q } : {}) }),
    [effectiveScope, status, q]
  )

  const subtitle = isAdmin
    ? 'Every task across the organization'
    : 'Tasks assigned to you'

  const emptyText =
    effectiveScope === 'mine'
      ? 'No tasks assigned to you'
      : effectiveScope === 'team'
        ? 'No team tasks match the filter'
        : 'No tasks match the filter'

  return (
    <AppShell title="Tasks" subtitle={subtitle} onTasksChanged={reload}>
      <div className="rounded-card border border-border bg-surface shadow-card">
        {/* Scope tabs — admin only */}
        {isAdmin && (
          <div className="flex gap-1 border-b border-border px-3 pt-2">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={
                  'focus-ring -mb-px border-b-2 px-4 py-2 text-sm ' +
                  (scope === s.key
                    ? 'border-accent font-semibold text-accent'
                    : 'border-transparent text-ink-secondary hover:text-ink')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="focus-ring w-full rounded-control border border-border-strong bg-surface py-1.5 pl-8 pr-3 text-sm placeholder:text-ink-tertiary"
              placeholder="Search by title, task no, entity…"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  'focus-ring rounded-control px-3 py-1.5 text-sm ' +
                  (status === s
                    ? 'bg-accent-soft font-semibold text-accent'
                    : 'text-ink-secondary hover:bg-subtle')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
        ) : (
          <TaskTable
            tasks={data?.tasks}
            showAssignee={effectiveScope !== 'mine'}
            showCreator
            showDept
            showAssignedOn
            emptyText={emptyText}
          />
        )}
      </div>
    </AppShell>
  )
}
