// ADMIN — team workload board across all departments.
import AppShell from '../app/AppShell'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

const ROLE_CHIP = {
  ADMIN: { label: 'Admin', bg: '#2564CF' },
  SALES: { label: 'Sales', bg: '#0F7B6C' },
  DESIGNER: { label: 'Designer', bg: '#5B4BE6' },
  IT: { label: 'IT', bg: '#605E5C' },
}

export default function Workload() {
  const { data, loading, reload } = useApi(() => api.workload(), [])

  return (
    <AppShell title="Team Workload" subtitle="Capacity and load per person, all departments" onTasksChanged={reload}>
      <div className="rounded-card border border-border bg-surface shadow-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-tertiary">
              <th className="px-5 py-3 font-semibold">Person</th>
              <th className="py-3 font-semibold">Department</th>
              <th className="py-3 font-semibold">Capacity</th>
              <th className="py-3 font-semibold">Open</th>
              <th className="py-3 font-semibold">In Progress</th>
              <th className="py-3 font-semibold">Overdue</th>
              <th className="py-3 pr-5 font-semibold">Done Today</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</td></tr>
            )}
            {data?.workload?.map((u) => {
              const chip = ROLE_CHIP[u.role]
              const pct = Math.min(100, (u.openTasks / u.capacity) * 100)
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-subtle">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
                        style={{ background: u.color }}
                      >
                        {initials(u.name)}
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-ink">{u.name}</span>
                        <span
                          className="inline-block rounded-chip px-1.5 py-px text-[9px] font-semibold text-white"
                          style={{ background: chip.bg }}
                        >
                          {chip.label}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 text-sm text-ink-secondary">{u.department?.name || '—'}</td>
                  <td className="py-3">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full"
                        style={{ width: pct + '%', background: pct > 80 ? '#D13438' : '#2564CF' }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-ink-tertiary">{u.openTasks} of {u.capacity}</div>
                  </td>
                  <td className="py-3 text-sm font-semibold text-ink">{u.openTasks}</td>
                  <td className="py-3 text-sm text-ink">{u.inProgress}</td>
                  <td className="py-3">
                    {u.overdue > 0 ? (
                      <span className="rounded-chip bg-status-dangersoft px-2 py-0.5 text-xs font-semibold text-status-danger">
                        {u.overdue}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-tertiary">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-5 text-sm text-status-success">{u.completedToday}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
