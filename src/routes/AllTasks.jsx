// ADMIN — full org task list with filters.
import { useState } from 'react'
import { Search } from 'lucide-react'
import AppShell from '../app/AppShell'
import TaskTable from '../features/tasks/TaskTable'
import { api } from '../data/api'
import { useApi } from '../auth/AuthContext'

const STATUSES = ['All', 'Assigned', 'In Progress', 'Submitted', 'Completed', 'Overdue']

export default function AllTasks() {
  const [status, setStatus] = useState('All')
  const [q, setQ] = useState('')
  const { data, loading, reload } = useApi(
    () => api.tasks({ scope: 'all', ...(status !== 'All' ? { status } : {}), ...(q ? { q } : {}) }),
    [status, q]
  )

  return (
    <AppShell title="All Tasks" subtitle="Every task across the organization" onTasksChanged={reload}>
      <div className="rounded-card border border-border bg-surface shadow-card">
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
          <div className="flex gap-1.5">
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
          <TaskTable tasks={data?.tasks} showAssignee showCreator showDept showAssignedOn emptyText="No tasks match the filter" />
        )}
      </div>
    </AppShell>
  )
}
