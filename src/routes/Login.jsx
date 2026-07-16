import { useState } from 'react'
import { CheckSquare, ShieldCheck, Palette, Briefcase, Wrench, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth, initials } from '../auth/AuthContext'

const WORKSPACES = [
  { email: 'bilal@decoinks.com', password: 'Admin@123', name: 'Bilal Ahmed', title: 'Manager', role: 'Admin', chip: 'linear-gradient(135deg,#2564CF,#3B7AD9)', Icon: ShieldCheck },
  { email: 'areeba@decoinks.com', password: 'Sales@123', name: 'Areeba Khan', title: 'Sales Agent', role: 'Sales', chip: '#0F7B6C', Icon: Briefcase },
  { email: 'hassan@decoinks.com', password: 'Design@123', name: 'Hassan Raza', title: 'Designer', role: 'Designer', chip: '#5B4BE6', Icon: Palette },
  { email: 'usman@decoinks.com', password: 'It@123', name: 'Usman Tariq', title: 'IT Support', role: 'IT', chip: '#605E5C', Icon: Wrench },
]

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const quickFill = (ws) => {
    setEmail(ws.email)
    setPassword(ws.password)
    setError(null)
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent-grad p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-white/15 backdrop-blur">
            <CheckSquare size={22} />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Task Management</div>
            <div className="text-xs text-white/70">Decoinks ERP</div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Every job, from artwork to shipment — one controlled workflow.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Managers assign and monitor. Sales delegate to designers. Designers execute.
            IT handles tickets. Everyone sees exactly what their role allows — nothing more.
          </p>
          <div className="mt-8 flex gap-6">
            {[
              ['Role-based', 'portals'],
              ['SLA', 'tracked'],
              ['Full', 'audit trail'],
            ].map(([a, b]) => (
              <div key={a}>
                <div className="text-lg font-semibold">{a}</div>
                <div className="text-xs text-white/70">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-white/60">© 2026 Decoinks · Technocas</div>
        {/* soft decorative circles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-white/5" />
      </div>

      {/* Right — sign-in form */}
      <div className="flex items-center justify-center bg-app p-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent-grad text-white">
              <CheckSquare size={20} />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-ink">Task Management</div>
              <div className="text-xs text-ink-secondary">Decoinks ERP</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-secondary">Welcome back. Enter your credentials to continue.</p>

          {error && (
            <div className="mt-4 rounded-control border border-status-danger/30 bg-status-dangersoft px-4 py-2.5 text-sm text-status-danger">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-secondary">Email address</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@decoinks.com"
                className="focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-secondary">
                Password
                <button
                  type="button"
                  onClick={() => setError('Password resets are handled by your admin — contact Bilal Ahmed to reset.')}
                  className="text-accent hover:underline"
                  tabIndex={-1}
                >
                  Forgot?
                </button>
              </span>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-tertiary"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-ink-tertiary hover:bg-subtle"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong accent-accent"
              />
              Keep me signed in
            </label>

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Quick demo access */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
              <span className="h-px flex-1 bg-border" /> Quick demo access <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WORKSPACES.map((ws) => (
                <button
                  key={ws.email}
                  onClick={() => quickFill(ws)}
                  className="focus-ring flex items-center gap-2 rounded-control border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-accent-softborder hover:bg-subtle"
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: ws.chip }}
                  >
                    {initials(ws.name)}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs font-semibold text-ink">{ws.role}</span>
                    <span className="block truncate text-[10px] text-ink-tertiary">{ws.title}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-tertiary">
              Tap a role to fill credentials, then Sign in · access is enforced by the API
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
