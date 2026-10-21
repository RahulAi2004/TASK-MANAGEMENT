// Global brand bar — spans the full width above the sidebar (logo · search · notifications · help · user).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, HelpCircle, LogOut, X, CheckSquare, ChevronDown } from 'lucide-react'
import { api } from '../data/api'
import { useAuth, initials } from '../auth/AuthContext'

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const iconBtn = 'focus-ring relative grid h-10 w-10 place-items-center rounded-full text-ink-secondary hover:bg-subtle'

export default function TopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(null) // 'notif' | 'search' | 'help' | 'user' | null
  const [q, setQ] = useState('')
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const toggle = (k) => setOpen((o) => (o === k ? null : k))
  // Admins land on Task Management at "/", other roles reach it at /all-tasks.
  const tasksPath = user.role === 'ADMIN' ? '/' : '/all-tasks'

  // Poll notifications every 60s so overdue reminders show up without a refresh
  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .notifications()
        .then((d) => {
          if (!alive) return
          setNotifs(d.notifications)
          setUnread(d.unread)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead()
      setUnread(0)
      setNotifs((l) => l.map((n) => ({ ...n, isRead: true })))
    } catch {
      /* ignore */
    }
  }

  const runSearch = () => {
    const term = q.trim()
    if (!term) return
    setOpen(null)
    setQ('')
    navigate(tasksPath + '?q=' + encodeURIComponent(term))
  }

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5">
      <button onClick={() => navigate('/')} className="focus-ring flex items-center gap-3 rounded-control text-left">
        <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent text-white shadow-sm">
          <CheckSquare size={22} />
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-semibold text-ink">Task Management</span>
          <span className="block text-[13px] text-ink-secondary">Decoinks ERP</span>
        </span>
      </button>

      <div className="flex items-center gap-2">
        {/* Search → Task Management list filtered by the term */}
        {open === 'search' ? (
          <div className="flex items-center gap-1 rounded-full border border-border-strong bg-surface px-3">
            <Search size={16} className="text-ink-tertiary" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
                if (e.key === 'Escape') setOpen(null)
              }}
              placeholder="Search tasks, customers…"
              className="w-56 bg-transparent py-2 text-sm outline-none placeholder:text-ink-tertiary"
            />
            <button onClick={() => { setOpen(null); setQ('') }} className="text-ink-tertiary hover:text-ink">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button onClick={() => toggle('search')} className={iconBtn} title="Search">
            <Search size={20} />
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => toggle('notif')} className={iconBtn} title="Notifications">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-status-danger px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
          {open === 'notif' && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-card border border-border bg-surface shadow-pop">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-ink">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifs.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-ink-tertiary">No notifications</li>
                )}
                {notifs.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      setOpen(null)
                      if (n.task) navigate(tasksPath + '?task=' + n.task.id)
                    }}
                    className={
                      'border-b border-border px-4 py-2.5 last:border-0 hover:bg-subtle ' +
                      (n.task ? 'cursor-pointer ' : '') +
                      (n.isRead ? '' : 'bg-accent-soft/50')
                    }
                  >
                    <div className={'text-sm ' + (n.isRead ? 'text-ink-secondary' : 'font-medium text-ink')}>
                      {n.message}
                    </div>
                    <div className="text-[11px] text-ink-tertiary">{timeAgo(n.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative">
          <button onClick={() => toggle('help')} className={iconBtn} title="Help">
            <HelpCircle size={20} />
          </button>
          {open === 'help' && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-card border border-border bg-surface p-4 text-sm shadow-pop">
              <div className="font-semibold text-ink">Need help?</div>
              <p className="mt-1 text-ink-secondary">
                You're signed in as {user.title}. Open any task to see its details, SLA and recordings.
              </p>
              <a href="mailto:support@decoinks.com" className="mt-2 inline-block text-accent hover:underline">
                Contact support
              </a>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative ml-2">
          <button onClick={() => toggle('user')} className="focus-ring flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-subtle">
            <span
              className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ background: user.color }}
            >
              {initials(user.name)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-semibold text-ink">{user.name}</span>
              <span className="block text-xs text-ink-secondary">{user.title}</span>
            </span>
            <ChevronDown size={14} className="text-ink-tertiary" />
          </button>
          {open === 'user' && (
            <div className="absolute right-0 top-14 z-50 w-48 rounded-card border border-border bg-surface py-1 shadow-pop">
              <div className="border-b border-border px-3 py-2 text-xs text-ink-tertiary">{user.email}</div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-secondary hover:bg-subtle hover:text-status-danger"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* click-away */}
      {open && open !== 'search' && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />}
    </header>
  )
}
