import { CATEGORY_STYLE, SLA_STYLE } from './taskMeta'

export function CategoryChip({ category }) {
  const s = CATEGORY_STYLE[category] || CATEGORY_STYLE.General
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-chip border px-1 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.fg + '26' }}
    >
      {category}
    </span>
  )
}

export function SlaChip({ status }) {
  if (!status) return <span className="text-xs text-ink-tertiary">—</span>
  const s = SLA_STYLE[status]
  return (
    <span
      title={s.hint}
      className="inline-flex whitespace-nowrap rounded-chip border px-1 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.fg + '33' }}
    >
      {status}
    </span>
  )
}
