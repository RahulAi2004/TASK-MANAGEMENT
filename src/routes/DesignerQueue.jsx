// DESIGNER portal — To Do-style execution queue.
import { Link } from 'react-router-dom'
import { Play, Check } from 'lucide-react'
import AppShell from '../app/AppShell'
import StatusBadge from '../features/tasks/StatusBadge'
import PriorityFlag from '../features/tasks/PriorityFlag'
import { isOverdue } from '../features/tasks/TaskTable'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

function QueueRow({ t, onChanged }) {
  const start = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await api.transition(t.id, { event: 'start' })
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }
  const done = t.status === 'Completed'
  const late = isOverdue(t)

  return (
    <Link
      to={'/task/' + t.id}
      className="group flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0 hover:bg-subtle"
    >
      {/* MS To Do circular check */}
      <span
        className={
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ' +
          (done ? 'border-accent bg-accent text-white' : 'border-border-strong text-transparent group-hover:text-border-strong')
        }
      >
        <Check size={12} strokeWidth={3} />
      </span>

      <div className="min-w-0 flex-1">
        <div className={'text-sm font-medium ' + (done ? 'text-ink-tertiary line-through' : 'text-ink')}>
          {t.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-tertiary">
          <span>{t.taskNo}</span>·<span>{t.entityId}</span>·
          <span
            className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-semibold text-white"
            style={{ background: t.createdBy?.color }}
            title={'Assigned by ' + t.createdBy?.name}
          >
            {initials(t.createdBy?.name || '?')}
          </span>
          <span>from {t.createdBy?.name}</span>
        </div>
      </div>

      <PriorityFlag priority={t.priority} />
      {t.dueAt && (
        <span className={'text-xs ' + (late ? 'font-semibold text-status-danger' : 'text-ink-secondary')}>
          {new Date(t.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
          {new Date(t.dueAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <StatusBadge status={late && !done ? 'Overdue' : t.status} />
      {['Assigned', 'Accepted', 'Reopened'].includes(t.status) && (
        <button
          onClick={start}
          className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
        >
          <Play size={12} /> Start
        </button>
      )}
    </Link>
  )
}

export default function DesignerQueue({ filter = 'queue', title = 'My Queue' }) {
  const { data, loading, reload } = useApi(() => api.tasks({ scope: 'mine' }), [])
  let tasks = data?.tasks || []
  if (filter === 'submitted') tasks = tasks.filter((t) => ['Submitted', 'Completed'].includes(t.status))
  else tasks = tasks.filter((t) => !['Submitted', 'Completed', 'Cancelled'].includes(t.status))

  const inProgress = tasks.find((t) => t.status === 'In Progress')

  return (
    <AppShell title={title} subtitle="Accept, work, and submit — one task at a time" onTasksChanged={reload}>
      {inProgress && filter === 'queue' && (
        <Link
          to={'/task/' + inProgress.id}
          className="mb-5 flex items-center justify-between rounded-card border border-accent-softborder bg-accent-soft px-5 py-4 shadow-card transition-transform hover:-translate-y-0.5"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">Continue working</div>
            <div className="text-[15px] font-semibold text-ink">{inProgress.title}</div>
            <div className="text-xs text-ink-secondary">{inProgress.taskNo} · started {inProgress.startedAt ? new Date(inProgress.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </div>
          <span className="rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white">
            Open Focus View →
          </span>
        </Link>
      )}

      <div className="rounded-card border border-border bg-surface shadow-card">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
        ) : tasks.length ? (
          tasks.map((t) => <QueueRow key={t.id} t={t} onChanged={reload} />)
        ) : (
          <div className="px-5 py-16 text-center text-sm text-ink-tertiary">Queue is empty 🎉</div>
        )}
      </div>
    </AppShell>
  )
}
