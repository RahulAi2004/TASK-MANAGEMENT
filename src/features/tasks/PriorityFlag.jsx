import { Flag } from 'lucide-react'

const COLORS = {
  Urgent: '#D13438',
  High: '#E8710A',
  Medium: '#C19C00',
  Low: '#605E5C',
}

export default function PriorityFlag({ priority }) {
  const color = COLORS[priority] || COLORS.Low
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
      <Flag size={13} style={{ color }} fill={color} />
      {priority}
    </span>
  )
}
