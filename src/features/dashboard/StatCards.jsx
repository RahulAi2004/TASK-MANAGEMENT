import { ClipboardList, PlayCircle, Clock, Upload, CheckCircle2, AlertCircle } from 'lucide-react'

// `filter` is the Task Management status filter a card applies when clicked.
const CARDS = [
  { key: 'assigned', label: 'To do', icon: ClipboardList, color: '#1A66E5', soft: '#EAF2FF', filter: 'Assigned' },
  { key: 'inProgress', label: 'In progress', icon: PlayCircle, color: '#1A66E5', soft: '#EAF2FF', filter: 'In Progress' },
  { key: 'waiting', label: 'Paused or blocked', icon: Clock, color: '#E8A200', soft: '#FFF6DB', filter: 'Waiting / On Hold' },
  { key: 'submitted', label: 'In review', icon: Upload, color: '#6B47D6', soft: '#F1EBFD', filter: 'Submitted' },
  { key: 'completedToday', label: 'Done today', icon: CheckCircle2, color: '#1E9E4A', soft: '#E7F6EC', filter: 'Completed' },
  { key: 'overdue', label: 'Late', icon: AlertCircle, color: '#D13438', soft: '#FDE7E9', filter: 'Overdue' },
]

export default function StatCards({ stats, active, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {CARDS.map(({ key, label, icon: Icon, color, soft, filter }) => {
        const selected = onSelect && active === filter
        const Tag = onSelect ? 'button' : 'div'
        return (
          <Tag
            key={key}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(selected ? 'All' : filter) } : {})}
            className={
              'rounded-card border bg-surface p-4 text-left shadow-card transition-colors ' +
              (selected ? 'border-accent ring-1 ring-accent' : 'border-border') +
              (onSelect ? ' focus-ring hover:border-accent-softborder' : '')
            }
          >
            <div className="grid h-11 w-11 place-items-center rounded-full" style={{ background: soft }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div className="mt-3 text-sm text-ink-secondary">{label}</div>
            <div className="mt-0.5 text-[26px] font-semibold leading-tight text-ink">{stats?.[key] ?? '—'}</div>
            <div className="text-xs text-ink-tertiary">Tasks</div>
          </Tag>
        )
      })}
    </div>
  )
}
