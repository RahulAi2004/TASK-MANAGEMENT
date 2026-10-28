import { NavLink } from 'react-router-dom'
import {
  LayoutGrid, LayoutDashboard, PieChart, FileStack, BarChart3, Users2, CheckCircle2, Ticket, Inbox, ListChecks,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { t as tr } from '../i18n'

// Role-scoped navigation — items a role cannot use are NOT rendered.
// "Task Management" is the main workspace (task list + detail panel) for every role.
const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/', label: 'Task Management', icon: LayoutGrid, end: true },
    { to: '/overview', label: 'Overview', icon: PieChart },
    { to: '/workload', label: 'Team Workload', icon: Users2 },
    { to: '/templates', label: 'Task Templates', icon: FileStack },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ],
  SALES: [
    { to: '/all-tasks', label: 'Task Management', icon: LayoutGrid },
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/approvals', label: 'Approvals', icon: CheckCircle2 },
  ],
  DESIGNER: [
    { to: '/all-tasks', label: 'Task Management', icon: LayoutGrid },
    { to: '/', label: 'My Queue', icon: ListChecks, end: true },
    { to: '/submitted', label: 'Submitted', icon: Inbox },
  ],
  IT: [
    { to: '/all-tasks', label: 'Task Management', icon: LayoutGrid },
    { to: '/', label: 'My Tickets', icon: Ticket, end: true },
  ],
}

export default function Sidebar() {
  const { user } = useAuth()
  const nav = NAV_BY_ROLE[user.role] || []

  return (
    <aside className="hidden w-48 shrink-0 flex-col border-r border-border bg-app md:flex">
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'focus-ring flex items-center gap-2.5 whitespace-nowrap rounded-control px-2.5 py-2.5 text-[14px] transition-colors',
                isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-secondary hover:bg-subtle hover:text-ink',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={isActive ? 'text-accent' : 'text-ink-tertiary'} />
                {tr(label)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
