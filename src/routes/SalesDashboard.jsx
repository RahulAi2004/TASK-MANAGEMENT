// SALES portal — two-sided: my tasks (from admin) + delegated to designers.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Inbox, Send, Bell } from 'lucide-react'
import AppShell from '../app/AppShell'
import TaskTable from '../features/tasks/TaskTable'
import StatusBadge from '../features/tasks/StatusBadge'
import { Toast } from '../components/Modal'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

function DelegatedRow({ t, onRemind }) {
  const navigate = useNavigate()
  const remind = async (e) => {
    e.stopPropagation()
    try {
      await api.comment(t.id, `Reminder from Sales: please prioritise "${t.title}".`)
      onRemind(`Reminder sent to ${t.assignedUser?.name || 'designer'}`)
    } catch (err) {
      onRemind(err.message)
    }
  }
  return (
    <div
      onClick={() => navigate('/task/' + t.id)}
      className="flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-subtle"
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
        style={{ background: t.assignedUser?.color || '#605E5C' }}
        title={t.assignedUser?.name}
      >
        {initials(t.assignedUser?.name || '?')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{t.title}</div>
        <div className="text-xs text-ink-tertiary">
          {t.taskNo} · {t.entityId} · {t.assignedUser?.name}
        </div>
      </div>
      <StatusBadge status={t.status} />
      {t.status === 'Submitted' ? (
        <button
          onClick={(e) => { e.stopPropagation(); navigate('/approvals') }}
          className="focus-ring rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
        >
          Review
        </button>
      ) : (
        <button
          onClick={remind}
          className="focus-ring flex items-center gap-1 rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle"
        >
          <Bell size={12} /> Remind
        </button>
      )}
    </div>
  )
}

export default function SalesDashboard() {
  const mine = useApi(() => api.tasks({ scope: 'mine' }), [])
  const delegated = useApi(() => api.tasks({ scope: 'delegated' }), [])
  const reload = () => {
    mine.reload()
    delegated.reload()
  }
  const submittedCount = delegated.data?.tasks?.filter((t) => t.status === 'Submitted').length || 0
  const [toast, setToast] = useState(null)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500) }

  return (
    <AppShell
      title="Sales Dashboard"
      subtitle="Your tasks from the manager, and work you delegated to designers"
      onTasksChanged={reload}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* MY TASKS */}
        <div className="rounded-card border border-border bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <Inbox size={18} className="text-accent" />
            <h3 className="text-[15px] font-semibold text-ink">My Tasks</h3>
            <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              {mine.data?.tasks?.length ?? '…'}
            </span>
            <span className="ml-auto text-xs text-ink-tertiary">assigned to me</span>
          </div>
          {mine.loading ? (
            <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
          ) : (
            <TaskTable tasks={mine.data?.tasks} emptyText="No tasks assigned to you" />
          )}
        </div>

        {/* DELEGATED BY ME */}
        <div className="rounded-card border border-border bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <Send size={18} className="text-[#0F7B6C]" />
            <h3 className="text-[15px] font-semibold text-ink">Delegated by Me</h3>
            <span className="rounded-chip bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary">
              {delegated.data?.tasks?.length ?? '…'}
            </span>
            {submittedCount > 0 && (
              <Link
                to="/approvals"
                className="ml-auto flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                {submittedCount} awaiting review <ArrowRight size={13} />
              </Link>
            )}
          </div>
          {delegated.loading ? (
            <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
          ) : delegated.data?.tasks?.length ? (
            delegated.data.tasks.map((t) => <DelegatedRow key={t.id} t={t} onRemind={flash} />)
          ) : (
            <div className="px-5 py-10 text-center text-sm text-ink-tertiary">
              You haven't delegated any tasks yet
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </AppShell>
  )
}
