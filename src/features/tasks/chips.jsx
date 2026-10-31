import { CATEGORY_STYLE, SLA_STYLE } from './taskMeta'
import { t as tr } from '../../i18n'

export function CategoryChip({ category }) {
  const s = CATEGORY_STYLE[category] || { bg: '#F1F3F5', fg: '#5B6474' } // categories added later
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-chip border px-1 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.fg + '26' }}
    >
      {tr(category)}
    </span>
  )
}

export function SlaChip({ status }) {
  if (!status) return <span className="text-xs text-ink-tertiary">—</span>
  const s = SLA_STYLE[status]
  return (
    <span
      title={tr(s.hint)}
      className="inline-flex whitespace-nowrap rounded-chip border px-1 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.fg + '33' }}
    >
      {tr(s.label)}
    </span>
  )
}
