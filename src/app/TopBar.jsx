import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, HelpCircle, LogOut, X } from 'lucide-react'
import { api } from '../data/api'
import { useAuth, initials } from '../auth/AuthContext'

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function TopBar({ title, subtitle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(null) // 'notif' | 'search' | 'help' | null
  const [q, setQ] = useState('')
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const toggle = (k) => setOpen((o) => (o === k ? null : k))

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

  return (
    <header className="relative flex items-center justify-between gap-4 border-b border-border bg-app px-8 py-4">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-secondary">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          {open === 'search' ? (
            <div className="flex items-center gap-1 rounded-control border border-border-strong bg-surface px-2">
              <Search size={16} className="text-ink-tertiary" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tasks…"
                className="w-44 bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-tertiary"
              />
              <button onClick={() => { setOpen(null); setQ('') }} className="text-ink-tertiary hover:text-ink"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => toggle('search')} className="focus-ring grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
              <Search size={18} />
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => toggle('notif')} className="focus-ring relative grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-danger px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </button>
          {open === 'notif' && (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-card border border-border bg-surface shadow-pop">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold text-ink">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {notifs.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-ink-tertiary">No notifications</li>
                )}
                {notifs.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      setOpen(null)
                      if (n.task) navigate('/task/' + n.task.id)
                    }}
                    className={
                      'border-b border-border px-4 py-2.5 last:border-0 hover:bg-subtle ' +
                      (n.task ? 'cursor-pointer ' : '') +
                      (n.isRead ? '' : 'bg-accent-soft/40')
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
          <button onClick={() => toggle('help')} className="focus-ring grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <HelpCircle size={18} />
          </button>
          {open === 'help' && (
            <div className="absolute right-0 top-11 z-50 w-64 rounded-card border border-border bg-surface p-4 text-sm shadow-pop">
              <div className="font-semibold text-ink">Need help?</div>
              <p className="mt-1 text-ink-secondary">You're signed in as {user.title}. Use the sidebar to navigate your portal.</p>
              <a href="mailto:support@decoinks.com" className="mt-2 inline-block text-accent hover:underline">Contact support</a>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-l border-border pl-3">
          <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: user.color }}>
            {initials(user.name)}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">{user.name}</div>
            <div className="text-[11px] text-ink-tertiary">{user.title}</div>
          </div>
          <button onClick={logout} title="Sign out" className="focus-ring ml-1 grid h-8 w-8 place-items-center rounded-control text-ink-tertiary hover:bg-subtle hover:text-status-danger">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* click-away */}
      {open && open !== 'search' && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />}
    </header>
  )
}
