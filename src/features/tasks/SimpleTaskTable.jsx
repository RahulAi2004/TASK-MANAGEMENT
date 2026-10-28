// Default ("Simple") Task Management table: only what people need to act on a task —
// what it is, who has it, when it's due, where it stands, and the one next step.
// The full 14-column layout stays available as "Detailed" (TaskGrid).
import { Flag, Play } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { SlaChip } from './chips'
import { initials } from '../../auth/AuthContext'
import { taskMeta, slaStatus, dueLabel, DUE_TONE, statusSentence, allowedEvents } from './taskMeta'

// Steps that need nothing more than a click run straight from the list.
const INLINE = new Set(['start', 'resume', 'accept'])

function NextStep({ t, user, onOpen, onAction, busy }) {
  const next = allowedEvents(t, user).find((x) => x.primary)
  const btn = 'focus-ring whitespace-nowrap rounded-control px-3 py-1.5 text-[13px] font-semibold disabled:opacity-60'
  if (next && INLINE.has(next.event)) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onAction(t, next.event) }}
        disabled={busy}
        className={btn + ' inline-flex items-center gap-1 bg-accent text-white hover:bg-accent-hover'}
      >
        <Play size={13} fill="currentColor" /> {next.label}
      </button>
    )
  }
  const label = next?.event === 'approve' ? 'Review' : next?.event === 'submit' ? 'Finish' : 'Open'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(t.id) }}
      className={btn + (next ? ' border border-accent bg-accent-soft text-accent hover:bg-accent-softborder' : ' border border-border-strong text-ink-secondary hover:bg-subtle')}
    >
      {label}
    </button>
  )
}

export default function SimpleTaskTable({ tasks, now, user, selectedId, onOpen, onAction, busyId }) {
  const th = 'px-3 py-2.5 text-left text-[12px] font-semibold text-ink-secondary'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border bg-subtle/60">
            <th className={th + ' pl-5'}>Task</th>
            <th className={th}>Assigned to</th>
            <th className={th}>Due</th>
            <th className={th}>Status</th>
            <th className={th}>On time?</th>
            <th className={th + ' pr-5 text-right'}>Next step</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const meta = taskMeta(t)
            const due = dueLabel(t, now)
            const urgent = t.priority === 'Urgent' || t.priority === 'High'
            const sub = [t.taskNo, t.entityId && t.entityId !== 'GENERAL' && t.entityId !== 'nil' ? t.entityId : null, meta.customerName].filter(Boolean).join(' · ')
            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t.id)}
                className={'cursor-pointer border-b border-border last:border-0 ' + (t.id === selectedId ? 'bg-accent-soft/60' : 'hover:bg-subtle/70')}
              >
                <td className="max-w-[340px] py-3 pl-5 pr-3">
                  <div className="flex items-center gap-1.5">
                    {urgent && (
                      <Flag
                        size={14}
                        aria-label={t.priority + ' priority'}
                        className="shrink-0"
                        style={{ color: t.priority === 'Urgent' ? '#B4232A' : '#E5383B' }}
                        fill={t.priority === 'Urgent' ? '#B4232A' : '#E5383B'}
                      />
                    )}
                    <span className="truncate text-[14px] font-semibold text-ink">{t.title}</span>
                  </div>
                  <div className="truncate text-[12px] text-ink-tertiary">{sub}</div>
                </td>
                <td className="px-3 py-3">
                  {t.assignedUser ? (
                    <span className="flex items-center gap-2 text-[13px] text-ink">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: t.assignedUser.color || '#5B6474' }}>
                        {initials(t.assignedUser.name)}
                      </span>
                      <span className="max-w-[140px] truncate">{t.assignedUser.name}</span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-tertiary">Nobody yet</span>
                  )}
                </td>
                <td className={'whitespace-nowrap px-3 py-3 text-[13px] ' + DUE_TONE[due.tone]}>{due.text}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={t.status} />
                  <div className="mt-0.5 max-w-[190px] truncate text-[11px] text-ink-tertiary">{statusSentence(t, user)}</div>
                </td>
                <td className="px-3 py-3"><SlaChip status={slaStatus(t, now)} /></td>
                <td className="py-3 pl-3 pr-5 text-right">
                  <NextStep t={t} user={user} onOpen={onOpen} onAction={onAction} busy={busyId === t.id} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
