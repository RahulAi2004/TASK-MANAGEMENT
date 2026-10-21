// Task status → chip styling (soft fill + matching hairline border).
const MAP = {
  Pending: { bg: '#F1F4F9', fg: '#5B6474' },
  Assigned: { bg: '#EAF2FF', fg: '#1A66E5' },
  Accepted: { bg: '#EAF2FF', fg: '#1A66E5' },
  'In Progress': { bg: '#EAF2FF', fg: '#1A66E5' },
  Waiting: { bg: '#FFF4CE', fg: '#8A6D00' },
  'On Hold': { bg: '#FFF1E0', fg: '#C25E00', label: 'Hold' },
  Submitted: { bg: '#F1EBFD', fg: '#6B47D6' },
  Completed: { bg: '#E7F6EC', fg: '#1E7B34' },
  Rejected: { bg: '#FDE7E9', fg: '#D13438' },
  Reopened: { bg: '#FFF4CE', fg: '#8A6D00' },
  Overdue: { bg: '#FDE7E9', fg: '#D13438' },
  Cancelled: { bg: '#F1F4F9', fg: '#98A1B0' },
}

export default function StatusBadge({ status, size = 'md' }) {
  const s = MAP[status] || MAP.Pending
  return (
    <span
      className={
        'inline-flex items-center whitespace-nowrap rounded-chip border font-medium ' +
        (size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs')
      }
      style={{ background: s.bg, color: s.fg, borderColor: s.fg + '33' }}
    >
      {s.label || status}
    </span>
  )
}
