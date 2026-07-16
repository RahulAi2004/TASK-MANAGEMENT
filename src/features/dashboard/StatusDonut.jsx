import { statusOverview } from '../../data/mock/tasks'

// Pure-SVG donut (no chart lib) — segments from statusOverview.
export default function StatusDonut() {
  const total = statusOverview.reduce((a, s) => a + s.value, 0)
  const R = 54
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-4 text-[15px] font-semibold text-ink">Task Status Overview</h3>
      <div className="flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#F3F2F1" strokeWidth="16" />
            {statusOverview.map((s) => {
              const len = (s.value / total) * C
              const seg = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += len
              return seg
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <div className="text-2xl font-semibold text-ink">{total}</div>
              <div className="text-[11px] text-ink-tertiary">Total</div>
            </div>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {statusOverview.map((s) => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold text-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
