import { useState } from 'react'
import { CheckSquare, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

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
                  onClick={() => setError('Password resets are handled by your admin — contact them to reset.')}
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

        </div>
      </div>
    </div>
  )
}
