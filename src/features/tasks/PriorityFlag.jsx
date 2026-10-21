import { Flag } from 'lucide-react'

const COLORS = {
  Urgent: '#B4232A',
  High: '#E5383B',
  Medium: '#E8A200',
  Low: '#98A1B0',
}

export default function PriorityFlag({ priority, size = 'md' }) {
  const color = COLORS[priority] || COLORS.Low
  return (
    <span className={'inline-flex items-center text-ink ' + (size === 'sm' ? 'gap-1 text-[11.5px]' : 'gap-1.5 text-[13px]')}>
      <Flag size={size === 'sm' ? 12 : 14} style={{ color }} fill={color} />
      {priority}
    </span>
  )
}
