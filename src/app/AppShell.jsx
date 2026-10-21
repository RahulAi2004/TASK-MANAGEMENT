// Layout: full-width brand bar on top; sidebar · page (title + actions + content) · optional
// right-docked panel (e.g. Task Detail) below it. On phones: compact top bar, no sidebar,
// bottom navigation (Home · Task Management · Settings) and a floating "+" for new tasks.
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Plus, Home, ListChecks, Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import CreateTaskPanel from '../features/tasks/CreateTaskPanel'
import TaskSettingsModal from '../features/settings/TaskSettingsModal'
import { useAuth } from '../auth/AuthContext'

function BottomNav({ onSettings }) {
  const { user } = useAuth()
  const isAdmin = user.role === 'ADMIN'
  const item = (active) =>
    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ' + (active ? 'font-semibold text-accent' : 'text-ink-secondary')
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      <NavLink to={isAdmin ? '/overview' : '/'} end className={({ isActive }) => item(isActive)}>
        <Home size={22} /> Home
      </NavLink>
      <NavLink to={isAdmin ? '/' : '/all-tasks'} end={isAdmin} className={({ isActive }) => item(isActive)}>
        <ListChecks size={22} /> Task Management
      </NavLink>
      {isAdmin && (
        <button onClick={onSettings} className={item(false)}>
          <Settings size={22} /> Settings
        </button>
      )}
    </nav>
  )
}

export default function AppShell({ title, subtitle, children, onTasksChanged, actions, aside, hideMobileHeader = false }) {
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const canCreate = user.role === 'ADMIN' || user.role === 'SALES'
  // Handed to a page's `actions` render function so its buttons can open the shared panels.
  const shell = { openCreate: () => setCreateOpen(true), openSettings: () => setSettingsOpen(true) }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 md:py-5">
          {title && (
            <div className={'mb-5 flex-wrap items-start justify-between gap-3 ' + (hideMobileHeader ? 'hidden md:flex' : 'flex')}>
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-semibold leading-tight text-ink md:text-[26px]">{title}</h1>
                {subtitle && <p className="mt-0.5 text-sm text-ink-secondary">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2.5">
                {typeof actions === 'function' ? actions(shell) : actions}
                {canCreate && (
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="focus-ring hidden items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover md:flex"
                  >
                    <Plus size={18} /> {user.role === 'SALES' ? 'New Design Task' : 'New Task'}
                  </button>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
        {aside}
      </div>
      <BottomNav onSettings={() => setSettingsOpen(true)} />
      {canCreate && (
        <button
          onClick={() => setCreateOpen(true)}
          aria-label="New task"
          className="focus-ring fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-pop md:hidden"
        >
          <Plus size={28} />
        </button>
      )}
      <CreateTaskPanel open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onTasksChanged} />
      {user.role === 'ADMIN' && <TaskSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
