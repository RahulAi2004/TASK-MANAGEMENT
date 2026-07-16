import { CheckCircle2, Upload, Clock, XCircle } from 'lucide-react'
import { activity } from '../../data/mock/tasks'

const ICON = {
  completed: { Icon: CheckCircle2, color: '#107C10' },
  submitted: { Icon: Upload, color: '#5B4BE6' },
  waiting: { Icon: Clock, color: '#C19C00' },
  rejected: { Icon: XCircle, color: '#D13438' },
}

export default function ActivityFeed() {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Activity Feed</h3>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <ul className="space-y-3">
        {activity.map((a, i) => {
          const { Icon, color } = ICON[a.type]
          return (
            <li key={i} className="flex gap-3">
              <Icon size={18} style={{ color }} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-ink">{a.text}</div>
                <div className="text-[11px] text-ink-tertiary">
                  by {a.by} · {a.time}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
