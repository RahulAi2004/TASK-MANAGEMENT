import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityFlag from './PriorityFlag'
import { initials } from '../../auth/AuthContext'

function EntityChip({ type, id }) {
  return (
    <div className="leading-tight">
      <span className="inline-block rounded-chip bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
        {type}
      </span>
      <div className="mt-0.5 text-xs text-ink-tertiary">{id}</div>
    </div>
  )
}

function fmtDue(iso) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function isOverdue(t) {
  return (
    t.dueAt &&
    new Date(t.dueAt) < new Date() &&
    !['Completed', 'Cancelled', 'Submitted'].includes(t.status)
  )
}

export default function TaskTable({ tasks, showAssignee = false, showCreator = false, showDept = false, showAssignedOn = false, emptyText = 'No tasks' }) {
  const navigate = useNavigate()
  if (!tasks?.length) {
    return <div className="px-5 py-10 text-center text-sm text-ink-tertiary">{emptyText}</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-y border-border text-[11px] uppercase tracking-wide text-ink-tertiary">
            <th className="px-5 py-2.5 font-semibold">Task No</th>
            <th className="py-2.5 font-semibold">Task Title</th>
            <th className="py-2.5 font-semibold">Entity</th>
            {showDept && <th className="py-2.5 font-semibold">Department</th>}
            {showAssignee && <th className="py-2.5 font-semibold">Assigned To</th>}
            {showCreator && <th className="py-2.5 font-semibold">Assigned By</th>}
            {showAssignedOn && <th className="py-2.5 font-semibold">Assigned On</th>}
            <th className="py-2.5 font-semibold">Priority</th>
            <th className="py-2.5 font-semibold">Due Date</th>
            <th className="py-2.5 font-semibold">Status</th>
            <th className="py-2.5 pr-5 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const due = fmtDue(t.dueAt)
            const late = isOverdue(t)
            return (
              <tr
                key={t.id}
                onClick={() => navigate('/task/' + t.id)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle"
              >
                <td className="px-5 py-3 text-sm font-medium text-accent">{t.taskNo}</td>
                <td className="py-3">
                  <div className="text-sm font-medium text-ink">{t.title}</div>
                  {t.subtitle && <div className="text-xs text-ink-secondary">{t.subtitle}</div>}
                </td>
                <td className="py-3">
                  <EntityChip type={t.entityType} id={t.entityId} />
                </td>
                {showDept && (
                  <td className="py-3">
                    {t.department ? (
                      <div className="leading-tight">
                        <div className="text-sm text-ink">{t.department.name}</div>
                        <div className="text-xs text-ink-tertiary">{t.department.code}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-tertiary">—</span>
                    )}
                  </td>
                )}
                {showAssignee && (
                  <td className="py-3">
                    {t.assignedUser ? (
                      <span className="flex items-center gap-2 text-sm text-ink">
                        <span
                          className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: t.assignedUser.color }}
                        >
                          {initials(t.assignedUser.name)}
                        </span>
                        {t.assignedUser.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-tertiary">Unassigned</span>
                    )}
                  </td>
                )}
                {showCreator && (
                  <td className="py-3">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: t.createdBy?.color || '#605E5C' }}
                      >
                        {initials(t.createdBy?.name || '?')}
                      </span>
                      {t.createdBy?.name || '—'}
                    </span>
                  </td>
                )}
                {showAssignedOn && (
                  <td className="py-3">
                    {(() => {
                      const on = fmtDue(t.createdAt)
                      return (
                        <>
                          <div className="text-sm text-ink">{on.date}</div>
                          <div className="text-xs text-ink-tertiary">{on.time}</div>
                        </>
                      )
                    })()}
                  </td>
                )}
                <td className="py-3">
                  <PriorityFlag priority={t.priority} />
                </td>
                <td className="py-3">
                  <div className={'text-sm ' + (late ? 'font-medium text-status-danger' : 'text-ink')}>
                    {due.date}
                  </div>
                  <div className="text-xs text-ink-tertiary">{due.time}</div>
                </td>
                <td className="py-3">
                  <StatusBadge status={late && t.status !== 'Completed' ? 'Overdue' : t.status} />
                </td>
                <td className="py-3 pr-5 text-ink-tertiary">
                  <ChevronRight size={16} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
