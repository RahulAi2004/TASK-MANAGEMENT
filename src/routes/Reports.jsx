// ADMIN — monitoring: KPIs, throughput chart, task-type mix, SLA by department.
import { TrendingUp, Download } from 'lucide-react'
import AppShell from '../app/AppShell'
import { api } from '../data/api'
import { useApi } from '../auth/AuthContext'

const TYPE_COLORS = ['#2564CF', '#5B4BE6', '#0F7B6C', '#E8710A', '#C19C00', '#605E5C']

function BarChart({ perDay }) {
  const max = Math.max(1, ...perDay.map((d) => Math.max(d.completed, d.created)))
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Tasks per day</h3>
        <div className="flex items-center gap-4 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-status-submitted" /> Created</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3" style={{ height: 160 }}>
        {perDay.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-end justify-center gap-1" style={{ height: 130 }}>
              <div className="w-3.5 rounded-t bg-accent" style={{ height: (d.completed / max) * 130 || 2 }} title={`${d.completed} completed`} />
              <div className="w-3.5 rounded-t bg-status-submitted" style={{ height: (d.created / max) * 130 || 2 }} title={`${d.created} created`} />
            </div>
            <span className="text-[11px] text-ink-tertiary">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ByType({ byType }) {
  const total = byType.reduce((a, t) => a + t.n, 0) || 1
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-4 text-[15px] font-semibold text-ink">By task type</h3>
      <ul className="space-y-3">
        {byType.map((t, i) => (
          <li key={t.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink">{t.label}</span>
              <span className="font-semibold text-ink-secondary">{t.n}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full" style={{ width: (t.n / total) * 100 + '%', background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function exportCsv(data) {
  const rows = [
    ['Section', 'Label', 'Value'],
    ...data.kpis.map((k) => ['KPI', k.label, k.value]),
    ...data.perDay.map((d) => ['Per day', d.day, `completed=${d.completed};created=${d.created}`]),
    ...data.byType.map((t) => ['By type', t.label, t.n]),
    ...data.slaByDept.map((s) => ['SLA by dept', s.dept, `done=${s.done};breached=${s.breached};avg=${s.avg};compliance=${s.pct}%`]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `decoinks-report-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { data, loading, reload } = useApi(() => api.reports(), [])

  return (
    <AppShell title="Reports" subtitle="This week · throughput, cycle time and SLA" onTasksChanged={reload}>
      {loading ? (
        <div className="py-16 text-center text-sm text-ink-tertiary">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => exportCsv(data)} className="focus-ring flex items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">
              <Download size={15} /> Export CSV
            </button>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.kpis.map((k) => (
              <div key={k.label} className="rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="text-[13px] font-medium text-ink-secondary">{k.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-ink">{k.value}</span>
                  <TrendingUp size={15} className="text-status-success" />
                </div>
                <div className="mt-0.5 text-[11px] text-ink-tertiary">{k.note}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><BarChart perDay={data.perDay} /></div>
            <ByType byType={data.byType} />
          </div>

          {/* SLA by department */}
          <div className="rounded-card border border-border bg-surface shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-[15px] font-semibold text-ink">SLA compliance by department</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-tertiary">
                  <th className="px-5 py-2.5 font-semibold">Department</th>
                  <th className="py-2.5 font-semibold">Completed</th>
                  <th className="py-2.5 font-semibold">Breached</th>
                  <th className="py-2.5 font-semibold">Avg time</th>
                  <th className="py-2.5 pr-5 font-semibold">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {data.slaByDept.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-tertiary">No completed tasks yet</td></tr>
                )}
                {data.slaByDept.map((s) => (
                  <tr key={s.dept} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-sm font-medium text-ink">{s.dept}</td>
                    <td className="py-3 text-sm text-ink">{s.done}</td>
                    <td className="py-3 text-sm text-ink">{s.breached}</td>
                    <td className="py-3 text-sm text-ink-secondary">{s.avg}</td>
                    <td className="py-3 pr-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle">
                          <div className="h-full rounded-full" style={{ width: s.pct + '%', background: s.pct >= 90 ? '#107C10' : s.pct >= 70 ? '#C19C00' : '#D13438' }} />
                        </div>
                        <span className="text-sm font-semibold text-ink">{s.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  )
}
