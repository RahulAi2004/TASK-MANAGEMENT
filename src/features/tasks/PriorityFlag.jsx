import { Flag } from 'lucide-react'

const COLORS = {
  Urgent: '#B4232A',
  High: '#E5383B',
  Medium: '#E8A200',
  Low: '#98A1B0',
}

export default function PriorityFlag({ priority }) {
  const color = COLORS[priority] || COLORS.Low
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
      <Flag size={14} style={{ color }} fill={color} />
      {priority}
    </span>
  )
}
