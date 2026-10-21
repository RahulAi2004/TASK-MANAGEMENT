// Task Management table: task no · task · type · module · entity/order · customer · owner ·
// priority · started · elapsed · normal time · SLA · status · Open (opens the Task Detail panel).
// Compact on purpose: it must still fit beside the docked Task Detail panel.
import PriorityFlag from './PriorityFlag'
import StatusBadge from './StatusBadge'
import { CategoryChip, SlaChip } from './chips'
import { taskMeta, taskCategory, elapsedMs, slaStatus, fmtDuration, fmtMinutes, fmtDate, fmtTime } from './taskMeta'

const th = 'px-1.5 py-2.5 text-left align-bottom text-[11px] font-medium leading-tight text-ink-secondary'
const td = 'px-1.5 py-2.5 align-middle'

// "TASK-2026-00128" → "TASK-2026-" / "00128" (two short lines instead of three broken ones)
function TaskNo({ value }) {
  const i = value.lastIndexOf('-')
  if (i < 0) return value
  return (
    <>
      <span className="block whitespace-nowrap">{value.slice(0, i + 1)}</span>
      <span className="block whitespace-nowrap">{value.slice(i + 1)}</span>
    </>
  )
}

export default function TaskGrid({ tasks, now, selectedId, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={th + ' pl-3'}>Task No.</th>
            <th className={th}>Task</th>
            <th className={th}>Task Type</th>
            <th className={th}>Module</th>
            <th className={th}>Entity / Order</th>
            <th className={th}>Customer Name</th>
            <th className={th}>Owner</th>
            <th className={th}>Priority</th>
            <th className={th}>Started at</th>
            <th className={th}>Elapsed Time</th>
            <th className={th}>Normal Time</th>
            <th className={th}>SLA Status</th>
            <th className={th}>Task Status</th>
            <th className={th + ' pr-3 text-center'}>Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const meta = taskMeta(t)
            const selected = t.id === selectedId
            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t.id)}
                className={
                  'cursor-pointer border-b border-border text-[11.5px] leading-snug last:border-0 ' +
                  (selected ? 'bg-accent-soft/70' : 'hover:bg-subtle/70')
                }
              >
                <td className={td + ' pl-3 font-medium text-accent'}>
                  <TaskNo value={t.taskNo} />
                </td>
                <td className={td + ' min-w-[86px] max-w-[160px] font-medium text-ink'}>{t.title}</td>
                <td className={td}>
                  <CategoryChip category={taskCategory(t)} />
                </td>
                <td className={td + ' text-ink'}>{t.department?.name || <span className="text-ink-tertiary">—</span>}</td>
                <td className={td + ' max-w-[110px] break-words font-medium text-ink'}>{t.entityId}</td>
                <td className={td + ' max-w-[120px] text-ink'}>
                  {meta.customerName || <span className="text-ink-tertiary">—</span>}
                </td>
                <td className={td + ' max-w-[110px] text-ink'}>
                  {t.assignedUser?.name || <span className="text-ink-tertiary">Unassigned</span>}
                </td>
                <td className={td + ' whitespace-nowrap'}>
                  <PriorityFlag priority={t.priority} size="sm" />
                </td>
                <td className={td + ' whitespace-nowrap text-[10.5px] text-ink-secondary'}>
                  {t.startedAt ? (
                    <>
                      <div>{fmtDate(t.startedAt)}</div>
                      <div>{fmtTime(t.startedAt)}</div>
                    </>
                  ) : (
                    <span className="text-ink-tertiary">Not started</span>
                  )}
                </td>
                <td className={td + ' whitespace-nowrap font-semibold text-ink'}>{fmtDuration(elapsedMs(t, now))}</td>
                <td className={td + ' whitespace-nowrap text-ink-secondary'}>{fmtMinutes(t.estimatedMinutes)}</td>
                <td className={td}>
                  <SlaChip status={slaStatus(t, now)} />
                </td>
                <td className={td}>
                  <StatusBadge status={t.status} size="sm" />
                </td>
                <td className={td + ' pr-3 text-center'}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(t.id)
                    }}
                    className={
                      'focus-ring rounded-control border px-2 py-1 text-[11.5px] font-medium ' +
                      (selected ? 'border-accent bg-accent text-white' : 'border-accent text-accent hover:bg-accent-soft')
                    }
                  >
                    Open
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
