// Task Settings — create and manage routine tasks (reusable definitions with SLA rules).
// Opened from the Settings button on Task Management (admin). Routine tasks are then offered
// in Create Task, which prefills the task and snapshots the SLA thresholds onto it.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Settings, X, FilePlus2, List, Search, ChevronDown, ChevronUp, Clock, AlertTriangle, AlertCircle,
  Info, FileText, Flag, Save, Pencil, Copy, Trash2,
} from 'lucide-react'
import { api } from '../../data/api'

const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low']
const PRIORITY_STYLE = {
  Urgent: { bg: '#FDE7E9', fg: '#B4232A' },
  High: { bg: '#FDE7E9', fg: '#E5383B' },
  Medium: { bg: '#FFF4CE', fg: '#B98500' },
  Low: { bg: '#E7F6EC', fg: '#1E9E4A' },
}
const EMPTY = {
  title: '', description: '', departmentId: '', priority: 'Medium', templateId: '', isActive: true,
  normal: { h: 1, m: 0 }, critical: { h: 4, m: 0 }, delayed: { h: 8, m: 0 },
}
const toMin = ({ h, m }) => (Number(h) || 0) * 60 + (Number(m) || 0)
const fromMin = (min) => ({ h: Math.floor(min / 60), m: min % 60 })
const fmtHM = (min) => `${Math.floor(min / 60)}h ${min % 60}m`

const inputCls =
  'focus-ring w-full rounded-control border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-tertiary'

function Label({ children, required }) {
  return (
    <span className="mb-2 block text-[15px] font-semibold text-ink">
      {children} {required && <span className="text-status-danger">*</span>}
    </span>
  )
}

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={'focus-ring relative h-7 w-[52px] shrink-0 rounded-full transition-colors ' + (on ? 'bg-accent' : 'bg-border-strong')}
    >
      <span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[28px]' : 'left-1')} />
    </button>
  )
}

function Stepper({ value, onChange, max, label }) {
  const clamp = (v) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0))
  return (
    <div className="text-center">
      <div className="flex h-11 items-center rounded-control border border-border-strong bg-surface pl-3">
        <input
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(clamp(parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))}
          className="w-full min-w-0 bg-transparent text-center text-[15px] text-ink outline-none"
        />
        <span className="flex flex-col pr-1.5">
          <button type="button" tabIndex={-1} onClick={() => onChange(clamp(value + 1))} className="text-ink-secondary hover:text-accent" title="Increase">
            <ChevronUp size={15} />
          </button>
          <button type="button" tabIndex={-1} onClick={() => onChange(clamp(value - 1))} className="text-ink-secondary hover:text-accent" title="Decrease">
            <ChevronDown size={15} />
          </button>
        </span>
      </div>
      <div className="mt-1.5 text-[13px] text-ink-secondary">{label}</div>
    </div>
  )
}

const BANDS = [
  { key: 'normal', label: 'Normal', icon: Clock, fg: '#1E7B34', bg: '#ECF8F0' },
  { key: 'critical', label: 'Critical', icon: AlertTriangle, fg: '#C25E00', bg: '#FFF6E8' },
  { key: 'delayed', label: 'Delayed', icon: AlertCircle, fg: '#D13438', bg: '#FDECEE' },
]

function PriorityChip({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.Medium
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[13px] font-medium" style={{ background: s.bg, color: s.fg }}>
      <Flag size={14} fill={s.fg} style={{ color: s.fg }} /> {priority}
    </span>
  )
}

export default function TaskSettingsModal({ open, onClose }) {
  const scrollRef = useRef(null)
  const [routines, setRoutines] = useState([])
  const [departments, setDepartments] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [q, setQ] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const load = () =>
    api.routines().then((d) => setRoutines(d.routines)).catch((e) => setError(e.message))

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    Promise.all([
      load(),
      api.departments().then((d) => setDepartments(d.departments)),
      api.templates().then((d) => setTemplates(d.templates)),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2500)
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return routines.filter(
      (r) =>
        (!deptFilter || r.departmentId === deptFilter) &&
        (!term || [r.title, r.description, r.department?.name, r.template?.name].some((v) => v?.toLowerCase().includes(term)))
    )
  }, [routines, q, deptFilter])

  if (!open) return null

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setBand = (band, part, v) => setForm((f) => ({ ...f, [band]: { ...f[band], [part]: v } }))
  const normal = toMin(form.normal)
  const critical = toMin(form.critical)
  const delayed = toMin(form.delayed)
  const orderError =
    normal < 1 ? 'Normal time must be at least 1 minute'
      : !(normal <= critical && critical < delayed) ? 'SLA timeline must escalate: Normal ≤ Critical < Delayed'
        : null

  const reset = () => {
    setForm(EMPTY)
    setEditingId(null)
    setError(null)
  }
  const startEdit = (r) => {
    setEditingId(r.id)
    setError(null)
    setForm({
      title: r.title, description: r.description || '', departmentId: r.departmentId, priority: r.priority,
      templateId: r.templateId || '', isActive: r.isActive,
      normal: fromMin(r.normalMinutes), critical: fromMin(r.criticalMinutes), delayed: fromMin(r.delayedMinutes),
    })
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    if (!form.title.trim()) return setError('Task title is required')
    if (!form.departmentId) return setError('Department is required')
    if (orderError) return setError(orderError)
    setBusy(true)
    setError(null)
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null, departmentId: form.departmentId,
      priority: form.priority, templateId: form.templateId || null, isActive: form.isActive,
      normalMinutes: normal, criticalMinutes: critical, delayedMinutes: delayed,
    }
    try {
      if (editingId) await api.updateRoutine(editingId, payload)
      else await api.createRoutine(payload)
      await load()
      flash(editingId ? 'Routine task updated' : 'Routine task saved')
      reset()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn, msg) => {
    setError(null)
    try {
      await fn()
      await load()
      if (msg) flash(msg)
    } catch (e) {
      setError(e.message)
    }
  }
  const remove = (r) => {
    if (!window.confirm(`Delete routine task "${r.title}"? Tasks already created from it keep their SLA.`)) return
    if (editingId === r.id) reset()
    act(() => api.deleteRoutine(r.id), 'Routine task deleted')
  }

  const th = 'px-4 py-3 text-left text-[14px] font-semibold text-ink'
  const td = 'px-4 py-3 text-[14px]'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1B2333]/40 p-4" onMouseDown={onClose}>
      <div
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full max-w-[1480px] overflow-y-auto rounded-[14px] bg-app p-5 shadow-pop"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Settings size={28} />
            </span>
            <div>
              <h2 id="task-settings-title" className="text-[26px] font-semibold leading-tight text-ink">Task Settings</h2>
              <p className="text-[15px] text-ink-secondary">Create and manage routine task definitions that can be assigned to team members.</p>
            </div>
          </div>
          <button onClick={onClose} title="Close" className="focus-ring grid h-10 w-10 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <X size={24} />
          </button>
        </div>

        {/* Add / edit routine task */}
        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-control bg-accent-soft text-accent">
              {editingId ? <Pencil size={22} /> : <FilePlus2 size={22} />}
            </span>
            <div>
              <h3 className="text-[21px] font-semibold leading-tight text-ink">{editingId ? 'Edit Routine Task' : 'Add Routine Task'}</h3>
              <p className="text-sm text-ink-secondary">Define a routine task template with SLA rules and settings.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-5 lg:grid-cols-2">
            <label className="block">
              <Label required>Task Title</Label>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={120}
                placeholder="Enter task title (e.g. Review Print Placement)"
                className={inputCls + ' h-11'}
              />
            </label>
            <label className="block">
              <Label>Task Description</Label>
              <span className="relative block">
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={500}
                  placeholder="Enter a brief description of this task, purpose and when it should be used…"
                  className={inputCls + ' h-[74px] resize-none py-2.5 pb-6'}
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-ink-tertiary">{form.description.length}/500</span>
              </span>
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="block">
              <Label required>Department</Label>
              <span className="relative block">
                <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} className={inputCls + ' h-11 appearance-none pr-10'}>
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
              </span>
            </label>

            <div className="rounded-card border border-border p-3.5">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-[15px] font-semibold text-ink">SLA Timeline</span>
                <span className="text-[15px] text-ink-secondary">(Target completion time)</span>
                <span
                  className="text-accent"
                  title="Measured on working time from when the task is started. Normal is the target time; at Critical the task is flagged at risk; at Delayed the SLA is breached."
                >
                  <Info size={16} />
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {BANDS.map(({ key, label, icon: Icon, fg, bg }) => (
                  <div key={key} className="rounded-card p-3" style={{ background: bg }}>
                    <div className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold" style={{ color: fg }}>
                      <Icon size={22} /> {label} <span className="text-status-danger">*</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Stepper label="Hours" max={720} value={form[key].h} onChange={(v) => setBand(key, 'h', v)} />
                      <Stepper label="Minutes" max={59} value={form[key].m} onChange={(v) => setBand(key, 'm', v)} />
                    </div>
                  </div>
                ))}
              </div>
              {orderError && <p className="mt-2 text-xs text-status-danger">{orderError}</p>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <label className="block">
              <Label required>Priority</Label>
              <span className="relative block">
                <Flag size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: PRIORITY_STYLE[form.priority].fg }} fill={PRIORITY_STYLE[form.priority].fg} />
                <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCls + ' h-11 appearance-none pl-10 pr-10'}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
              </span>
            </label>
            <label className="block">
              <Label>Template</Label>
              <span className="relative block">
                <FileText size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent" />
                <select value={form.templateId} onChange={(e) => set('templateId', e.target.value)} className={inputCls + ' h-11 appearance-none pl-10 pr-10'}>
                  <option value="">Select a task template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isActive ? '' : ' (inactive)'}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
              </span>
            </label>
            <div>
              <Label>Active</Label>
              <div className="flex h-11 items-center gap-3">
                <Toggle on={form.isActive} onChange={(v) => set('isActive', v)} label="Active" />
                <span className="text-sm text-ink-secondary">
                  {form.isActive ? 'Task template is active and can be assigned' : 'Inactive — hidden from Create Task'}
                </span>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{error}</div>}

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-5">
            {notice && <span className="mr-auto text-sm font-medium text-status-success">{notice}</span>}
            <button onClick={reset} className="focus-ring h-11 rounded-control border border-accent px-6 text-[15px] font-medium text-accent hover:bg-accent-soft">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="focus-ring flex h-11 items-center gap-2 rounded-control bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              <Save size={18} /> {busy ? 'Saving…' : editingId ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </section>

        {/* Existing routine tasks */}
        <section className="mt-4 rounded-card border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-control bg-accent-soft text-accent">
                <List size={24} />
              </span>
              <div>
                <h3 className="text-[21px] font-semibold leading-tight text-ink">Existing Routine Tasks</h3>
                <p className="text-sm text-ink-secondary">Manage your routine task templates. These can be assigned to team members when creating tasks.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="relative block w-64">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search routine tasks…" className={inputCls + ' h-10 pl-10'} />
              </span>
              <span className="relative block w-52">
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={inputCls + ' h-10 appearance-none pr-10'}>
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead className="bg-subtle">
                <tr>
                  <th className={th}>Task Title</th>
                  <th className={th}>Department</th>
                  <th className={th}>Normal</th>
                  <th className={th}>Critical</th>
                  <th className={th}>Delayed</th>
                  <th className={th}>Priority</th>
                  <th className={th}>Template</th>
                  <th className={th}>Active</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-tertiary">Loading…</td></tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-tertiary">
                      {routines.length ? 'No routine tasks match.' : 'No routine tasks yet — add one above.'}
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => (
                    <tr key={r.id} className={'border-t border-border ' + (editingId === r.id ? 'bg-accent-soft/50' : '')}>
                      <td className={td + ' font-semibold text-ink'}>
                        {r.title}
                        {r.description && <div className="max-w-[260px] truncate text-xs font-normal text-ink-tertiary" title={r.description}>{r.description}</div>}
                      </td>
                      <td className={td + ' text-ink-secondary'}>{r.department?.name}</td>
                      <td className={td + ' text-ink-secondary'}>{fmtHM(r.normalMinutes)}</td>
                      <td className={td + ' text-ink-secondary'}>{fmtHM(r.criticalMinutes)}</td>
                      <td className={td + ' text-ink-secondary'}>{fmtHM(r.delayedMinutes)}</td>
                      <td className={td}><PriorityChip priority={r.priority} /></td>
                      <td className={td + ' text-ink-secondary'}>{r.template?.name || <span className="text-ink-tertiary">—</span>}</td>
                      <td className={td}>
                        <Toggle
                          on={r.isActive}
                          label={`${r.title} active`}
                          onChange={(v) => act(() => api.updateRoutine(r.id, { isActive: v }), v ? 'Activated' : 'Deactivated')}
                        />
                      </td>
                      <td className={td}>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(r)} title="Edit" className="focus-ring grid h-9 w-9 place-items-center rounded-control bg-accent-soft text-accent hover:bg-accent-softborder">
                            <Pencil size={17} />
                          </button>
                          <button onClick={() => act(() => api.duplicateRoutine(r.id), 'Routine task duplicated')} title="Duplicate" className="focus-ring grid h-9 w-9 place-items-center rounded-control bg-subtle text-ink-secondary hover:bg-border">
                            <Copy size={17} />
                          </button>
                          <button onClick={() => remove(r)} title="Delete" className="focus-ring grid h-9 w-9 place-items-center rounded-control bg-status-dangersoft text-status-danger hover:bg-[#F9D3D7]">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
