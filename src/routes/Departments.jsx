// ADMIN — department overview cards with working New Department.
import { useState } from 'react'
import { Plus, Building2 } from 'lucide-react'
import AppShell from '../app/AppShell'
import Modal, { modalInput, Toast } from '../components/Modal'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

export default function Departments() {
  const { data, loading, reload } = useApi(() => api.departments(), [])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const create = async () => {
    setBusy(true); setError(null)
    try {
      await api.createDepartment({ name: name.trim() })
      setOpen(false); setName('')
      setToast(`Department "${name.trim()}" created`); setTimeout(() => setToast(null), 2500)
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Departments" subtitle="Teams, heads and current load" onTasksChanged={reload}>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setOpen(true)} className="focus-ring flex items-center gap-2 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={15} /> New Department
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setError(null) }}
        title="New department"
        subtitle="Create a department to route tasks and people"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="focus-ring rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">Cancel</button>
            <button onClick={create} disabled={busy || !name.trim()} className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {busy ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{error}</div>}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Department name</span>
          <input className={modalInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production" autoFocus />
        </label>
      </Modal>
      <Toast toast={toast} />
      {loading ? (
        <div className="py-16 text-center text-sm text-ink-tertiary">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.departments.map((d) => (
            <div key={d.id} className="rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-control bg-accent-soft">
                  <Building2 size={20} className="text-accent" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">{d.name}</div>
                  <div className="text-xs text-ink-tertiary">{d.teams} team{d.teams !== 1 && 's'} · {d.members} member{d.members !== 1 && 's'}</div>
                </div>
              </div>

              {d.head && (
                <div className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: d.head.color }}>
                    {initials(d.head.name)}
                  </span>
                  Head · {d.head.name}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-control bg-subtle p-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-ink">{d.open}</div>
                  <div className="text-[11px] text-ink-tertiary">Open</div>
                </div>
                <div>
                  <div className={'text-lg font-semibold ' + (d.overdue > 0 ? 'text-status-danger' : 'text-ink')}>{d.overdue}</div>
                  <div className="text-[11px] text-ink-tertiary">Overdue</div>
                </div>
                <div>
                  <div className={'text-lg font-semibold ' + (d.sla >= 90 ? 'text-status-success' : 'text-status-warning')}>{d.sla}%</div>
                  <div className="text-[11px] text-ink-tertiary">SLA</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
