// Task Management table: task no · task · type · module · entity/order · customer · owner ·
// priority · started · elapsed · normal time · SLA · status · Open (opens the Task Detail panel).
import PriorityFlag from './PriorityFlag'
import StatusBadge from './StatusBadge'
import { CategoryChip, SlaChip } from './chips'
import { taskMeta, taskCategory, elapsedMs, slaStatus, fmtDuration, fmtMinutes, fmtDate, fmtTime } from './taskMeta'

const th = 'px-3 py-3 text-left text-[12px] font-medium leading-tight text-ink-secondary'
const td = 'px-3 py-3 align-middle'

export default function TaskGrid({ tasks, now, selectedId, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={th + ' pl-5'}>Task No.</th>
            <th className={th}>Task</th>
            <th className={th}>Task Type</th>
            <th className={th}>Module</th>
            <th className={th}>Entity / Order</th>
            <th className={th}>Customer Name</th>
            <th className={th}>Owner</th>
            <th className={th}>Priority</th>
            <th className={th}>Started at</th>
            <th className={th}>Elapsed<br />Time</th>
            <th className={th}>Normal<br />Time</th>
            <th className={th}>SLA<br />Status</th>
            <th className={th}>Task<br />Status</th>
            <th className={th + ' pr-5 text-center'}>Action</th>
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
                  'cursor-pointer border-b border-border text-[13px] last:border-0 ' +
                  (selected ? 'bg-accent-soft/60' : 'hover:bg-subtle/70')
                }
              >
                <td className={td + ' pl-5'}>
                  <span className="font-semibold text-accent">{t.taskNo}</span>
                </td>
                <td className={td + ' max-w-[190px]'}>
                  <div className="font-medium leading-snug text-ink">{t.title}</div>
                  <div className="truncate text-[11px] text-ink-tertiary">{t.taskType}</div>
                </td>
                <td className={td}>
                  <CategoryChip category={taskCategory(t)} />
                </td>
                <td className={td + ' text-ink'}>{t.department?.name || <span className="text-ink-tertiary">—</span>}</td>
                <td className={td}>
                  <span className="font-medium text-ink">{t.entityId}</span>
                </td>
                <td className={td + ' max-w-[150px] leading-snug text-ink'}>
                  {meta.customerName || <span className="text-ink-tertiary">—</span>}
                </td>
                <td className={td + ' whitespace-nowrap text-ink'}>
                  {t.assignedUser?.name || <span className="text-ink-tertiary">Unassigned</span>}
                </td>
                <td className={td + ' whitespace-nowrap'}>
                  <PriorityFlag priority={t.priority} />
                </td>
                <td className={td + ' whitespace-nowrap text-xs text-ink-secondary'}>
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
                <td className={td + ' pr-5 text-center'}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(t.id)
                    }}
                    className="focus-ring rounded-control border border-accent px-4 py-1.5 text-[13px] font-medium text-accent hover:bg-accent-soft"
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
