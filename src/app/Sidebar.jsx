import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Plus, FileStack, BarChart3, Users2,
  Building2, UserCog, Settings, CheckSquare, ListChecks,
  CheckCircle2, Ticket, Inbox,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

// Role-scoped navigation — items a role cannot use are NOT rendered.
const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/all-tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/workload', label: 'Team Workload', icon: Users2 },
    { to: '/templates', label: 'Task Templates', icon: FileStack },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/departments', label: 'Departments', icon: Building2 },
    { to: '/users', label: 'Users', icon: UserCog },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  SALES: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/all-tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/approvals', label: 'Approvals', icon: CheckCircle2 },
  ],
  DESIGNER: [
    { to: '/', label: 'My Queue', icon: ListChecks, end: true },
    { to: '/all-tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/submitted', label: 'Submitted', icon: Inbox },
  ],
  IT: [
    { to: '/', label: 'My Tickets', icon: Ticket, end: true },
    { to: '/all-tasks', label: 'Tasks', icon: ClipboardList },
  ],
}

const ROLE_CHIP = {
  ADMIN: { label: 'Admin', bg: 'linear-gradient(135deg,#2564CF,#3B7AD9)' },
  SALES: { label: 'Sales', bg: '#0F7B6C' },
  DESIGNER: { label: 'Designer', bg: '#5B4BE6' },
  IT: { label: 'IT', bg: '#605E5C' },
}

export default function Sidebar({ onCreate }) {
  const { user } = useAuth()
  const nav = NAV_BY_ROLE[user.role] || []
  const chip = ROLE_CHIP[user.role]
  const canCreate = user.role === 'ADMIN' || user.role === 'SALES'

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-subtle">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-control bg-accent-grad text-white shadow-sm">
          <CheckSquare size={18} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold text-ink">Task Management</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-tertiary">Decoinks ERP</span>
            <span
              className="rounded-chip px-1.5 py-px text-[9px] font-semibold text-white"
              style={{ background: chip.bg }}
            >
              {chip.label}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent-soft font-semibold text-accent'
                  : 'text-ink-secondary hover:bg-border',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-accent' : 'text-ink-tertiary'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {canCreate && (
        <div className="space-y-2 border-t border-border p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
            Quick Actions
          </div>
          <button
            onClick={onCreate}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-control bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} /> {user.role === 'SALES' ? 'New Design Task' : 'New Task'}
          </button>
        </div>
      )}
    </aside>
  )
}
