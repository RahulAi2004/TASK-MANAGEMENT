import { ClipboardList, PlayCircle, Clock, Upload, CheckCircle2, AlertCircle } from 'lucide-react'

const CARDS = [
  { key: 'assigned', label: 'Assigned', sub: 'Tasks', icon: ClipboardList, color: '#2564CF', soft: '#EAF1FC' },
  { key: 'inProgress', label: 'In Progress', sub: 'Tasks', icon: PlayCircle, color: '#3B7AD9', soft: '#E6F0FB' },
  { key: 'waiting', label: 'Waiting / On Hold', sub: 'Tasks', icon: Clock, color: '#C19C00', soft: '#FFF4CE' },
  { key: 'submitted', label: 'Submitted', sub: 'Tasks', icon: Upload, color: '#5B4BE6', soft: '#F0EBFA' },
  { key: 'completedToday', label: 'Completed Today', sub: 'Tasks', icon: CheckCircle2, color: '#107C10', soft: '#DFF6DD' },
  { key: 'overdue', label: 'Overdue', sub: 'Tasks', icon: AlertCircle, color: '#D13438', soft: '#FDE7E9' },
]

export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {CARDS.map(({ key, label, sub, icon: Icon, color, soft }) => (
        <div key={key} className="rounded-card border border-border bg-surface p-4 shadow-card">
          <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: soft }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div className="mt-3 text-[13px] font-medium text-ink-secondary">{label}</div>
          <div className="mt-0.5 text-2xl font-semibold text-ink">{stats?.[key] ?? '—'}</div>
          <div className="text-[11px] text-ink-tertiary">{sub}</div>
        </div>
      ))}
    </div>
  )
}
