// IT portal — internal ticket queue (tasks from the Admin).
import { Link } from 'react-router-dom'
import { Play, Bug, HardDrive, KeyRound, Wrench, Clock } from 'lucide-react'
import AppShell from '../app/AppShell'
import StatusBadge from '../features/tasks/StatusBadge'
import PriorityFlag from '../features/tasks/PriorityFlag'
import { isOverdue } from '../features/tasks/TaskTable'
import { api } from '../data/api'
import { useApi } from '../auth/AuthContext'

const TYPE_ICON = {
  'Bug Fix': { Icon: Bug, color: '#D13438', soft: '#FDE7E9' },
  Hardware: { Icon: HardDrive, color: '#C19C00', soft: '#FFF4CE' },
  'Access Request': { Icon: KeyRound, color: '#2564CF', soft: '#EAF1FC' },
}

function slaLeft(dueAt) {
  if (!dueAt) return null
  const ms = new Date(dueAt) - new Date()
  if (ms <= 0) return { label: 'SLA breached', danger: true }
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return { label: h > 0 ? `${h}h ${m}m left` : `${m}m left`, danger: h < 2 }
}

function TicketRow({ t, onChanged }) {
  const meta = TYPE_ICON[t.taskType] || { Icon: Wrench, color: '#605E5C', soft: '#F3F2F1' }
  const sla = slaLeft(t.dueAt)
  const late = isOverdue(t)

  const start = async (e) => {
    e.preventDefault()
    try {
      await api.transition(t.id, { event: 'start' })
      onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Link
      to={'/task/' + t.id}
      className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0 hover:bg-subtle"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: meta.soft }}>
        <meta.Icon size={18} style={{ color: meta.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{t.title}</div>
        <div className="text-xs text-ink-tertiary">
          {t.taskNo} · {t.affectedSystem || t.entityId} · from {t.createdBy?.name}
        </div>
      </div>
      <span className="rounded-chip bg-subtle px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">
        {t.taskType}
      </span>
      <PriorityFlag priority={t.priority} />
      {sla && !['Completed', 'Submitted'].includes(t.status) && (
        <span
          className={
            'flex items-center gap-1 text-xs ' +
            (sla.danger || late ? 'font-semibold text-status-danger' : 'text-ink-secondary')
          }
        >
          <Clock size={12} /> {late ? 'SLA breached' : sla.label}
        </span>
      )}
      <StatusBadge status={late && t.status !== 'Completed' ? 'Overdue' : t.status} />
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

export default function ItTickets() {
  const { data, loading, reload } = useApi(() => api.tasks({ scope: 'mine' }), [])
  const open = data?.tasks?.filter((t) => !['Completed', 'Cancelled'].includes(t.status)) || []
  const resolved = data?.tasks?.filter((t) => t.status === 'Completed') || []

  return (
    <AppShell title="My Tickets" subtitle="Internal tickets assigned to you by the manager" onTasksChanged={reload}>
      <div className="space-y-6">
        <div className="rounded-card border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[15px] font-semibold text-ink">Open Tickets ({open.length})</h3>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
          ) : open.length ? (
            open.map((t) => <TicketRow key={t.id} t={t} onChanged={reload} />)
          ) : (
            <div className="px-5 py-12 text-center text-sm text-ink-tertiary">No open tickets</div>
          )}
        </div>

        {resolved.length > 0 && (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-[15px] font-semibold text-ink">Resolved ({resolved.length})</h3>
            </div>
            {resolved.map((t) => <TicketRow key={t.id} t={t} onChanged={reload} />)}
          </div>
        )}
      </div>
    </AppShell>
  )
}
