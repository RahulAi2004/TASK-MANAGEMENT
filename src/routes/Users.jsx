// ADMIN — user directory with working Invite User.
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import AppShell from '../app/AppShell'
import Modal, { modalInput, Toast } from '../components/Modal'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

const ROLE_CHIP = {
  ADMIN: { label: 'Admin', bg: '#2564CF' },
  SALES: { label: 'Sales', bg: '#0F7B6C' },
  DESIGNER: { label: 'Designer', bg: '#5B4BE6' },
  IT: { label: 'IT', bg: '#605E5C' },
}

function InviteModal({ open, onClose, onInvited }) {
  const { data } = useApi(() => api.departments(), [open])
  const [form, setForm] = useState({ name: '', email: '', role: 'DESIGNER', departmentId: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api.inviteUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        departmentId: form.departmentId || undefined,
      })
      setDone(r)
      onInvited(`${r.user.name} invited`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const close = () => { setForm({ name: '', email: '', role: 'DESIGNER', departmentId: '' }); setError(null); setDone(null); onClose() }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite user"
      subtitle="Add a new person and assign their role"
      footer={
        done ? (
          <button onClick={close} className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">Done</button>
        ) : (
          <>
            <button onClick={close} className="focus-ring rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">Cancel</button>
            <button onClick={submit} disabled={busy || !form.name || !form.email} className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {busy ? 'Inviting…' : 'Send invite'}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-2 text-sm">
          <div className="rounded-control bg-status-successsoft px-3 py-2 text-status-success">
            {done.user.name} added as {ROLE_CHIP[done.user.role].label}.
          </div>
          <div className="text-ink-secondary">
            Temporary password: <span className="font-mono font-semibold text-ink">{done.tempPassword}</span>
            <div className="text-xs text-ink-tertiary">Share this so they can sign in and change it.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div className="rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{error}</div>}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Full name</span>
            <input className={modalInput} value={form.name} onChange={set('name')} placeholder="e.g. Sana Iqbal" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Email</span>
            <input className={modalInput} type="email" value={form.email} onChange={set('email')} placeholder="name@decoinks.com" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-secondary">Role</span>
              <select className={modalInput} value={form.role} onChange={set('role')}>
                <option value="ADMIN">Admin</option>
                <option value="SALES">Sales</option>
                <option value="DESIGNER">Designer</option>
                <option value="IT">IT</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-secondary">Department</span>
              <select className={modalInput} value={form.departmentId} onChange={set('departmentId')}>
                <option value="">— none —</option>
                {data?.departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Users() {
  const { data, loading, reload } = useApi(() => api.users(), [])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); reload() }

  return (
    <AppShell title="Users" subtitle="People, roles and current load" onTasksChanged={reload}>
      <div className="rounded-card border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-[15px] font-semibold text-ink">{data?.users?.length ?? '…'} users</h3>
          <button onClick={() => setInviteOpen(true)} className="focus-ring flex items-center gap-2 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
            <UserPlus size={15} /> Invite User
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-tertiary">
              <th className="px-5 py-2.5 font-semibold">Name</th>
              <th className="py-2.5 font-semibold">Email</th>
              <th className="py-2.5 font-semibold">Department</th>
              <th className="py-2.5 font-semibold">Role</th>
              <th className="py-2.5 font-semibold">Open Tasks</th>
              <th className="py-2.5 pr-5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</td></tr>}
            {data?.users?.map((u) => {
              const chip = ROLE_CHIP[u.role]
              const overloaded = u.openTasks > 6
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-subtle">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: u.color }}>{initials(u.name)}</span>
                      <span className="text-sm font-medium text-ink">{u.name}</span>
                    </span>
                  </td>
                  <td className="py-3 text-sm text-ink-secondary">{u.email}</td>
                  <td className="py-3 text-sm text-ink-secondary">{u.department?.name || '—'}</td>
                  <td className="py-3">
                    <span className="rounded-chip px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: chip.bg }}>{chip.label}</span>
                  </td>
                  <td className="py-3"><span className={'text-sm font-semibold ' + (overloaded ? 'text-status-danger' : 'text-ink')}>{u.openTasks}</span></td>
                  <td className="py-3 pr-5">
                    <span className="flex items-center gap-1.5 text-sm text-ink-secondary"><span className="h-2 w-2 rounded-full bg-status-success" /> Active</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={flash} />
      <Toast toast={toast} />
    </AppShell>
  )
}
