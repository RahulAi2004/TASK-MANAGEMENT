// Status → badge styling per docs/TECHNICAL_DESIGN.md §2.2.
const MAP = {
  Pending: { bg: '#F3F2F1', fg: '#605E5C' },
  Assigned: { bg: '#EAF1FC', fg: '#2564CF' },
  Accepted: { bg: '#EAF1FC', fg: '#2564CF' },
  'In Progress': { bg: '#EAF1FC', fg: '#2564CF' },
  'Waiting / On Hold': { bg: '#FFF4CE', fg: '#8A6D00' },
  Waiting: { bg: '#FFF4CE', fg: '#8A6D00' },
  Submitted: { bg: '#F0EBFA', fg: '#5B4BE6' },
  Completed: { bg: '#DFF6DD', fg: '#107C10' },
  Rejected: { bg: '#FDE7E9', fg: '#D13438' },
  Reopened: { bg: '#FFF4CE', fg: '#8A6D00' },
  Overdue: { bg: '#FDE7E9', fg: '#D13438' },
  Cancelled: { bg: '#F3F2F1', fg: '#A19F9D' },
}

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.Pending
  return (
    <span
      className="inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  )
}
