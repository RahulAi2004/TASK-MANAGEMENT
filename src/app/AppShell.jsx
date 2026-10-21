// Layout: full-width brand bar on top; sidebar · page (title + actions + content) · optional
// right-docked panel (e.g. Task Detail) below it.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import CreateTaskPanel from '../features/tasks/CreateTaskPanel'
import { useAuth } from '../auth/AuthContext'

export default function AppShell({ title, subtitle, children, onTasksChanged, actions, aside }) {
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const canCreate = user.role === 'ADMIN' || user.role === 'SALES'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5">
          {title && (
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-[26px] font-semibold leading-tight text-ink">{title}</h1>
                {subtitle && <p className="mt-0.5 text-sm text-ink-secondary">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2.5">
                {actions}
                {canCreate && (
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="focus-ring flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
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
      <CreateTaskPanel open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onTasksChanged} />
    </div>
  )
}
