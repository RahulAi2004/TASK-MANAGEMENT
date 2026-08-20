// ADMIN — task templates (real, backed by /api/templates). Blueprints that create tasks;
// New/Edit/Delete persist to the DB, the card toggle flips isActive, "Use" opens Create prefilled.
import { useEffect, useState } from 'react'
import { Plus, Bot, Pencil, CheckCircle2, Trash2 } from 'lucide-react'
import AppShell from '../app/AppShell'
import Modal, { modalInput, Toast } from '../components/Modal'
import CreateTaskPanel from '../features/tasks/CreateTaskPanel'
import { api } from '../data/api'

const DEPT_COLOR = { DESIGN: '#5B4BE6', PRODUCTION: '#0F7B6C', QA: '#C19C00', PROCUREMENT: '#E8710A', IT: '#605E5C', SALES: '#2564CF' }
const PRIOS = ['Urgent', 'High', 'Medium', 'Low']
const ENTITY_TYPES = ['Artwork', 'Sales Order', 'Lead', 'System']
const SLA_OPTS = [['Rush — 2h', 2], ['Same day — 8h', 8], ['Standard — 24h', 24], ['No SLA', null]]
const slaLabel = (h) => (h == null ? 'No SLA' : `${h}h`)
const parseChecklist = (json) => { try { return JSON.parse(json || '[]') } catch { return [] } }

function TemplateForm({ open, onClose, onSave, editing, departments, saving }) {
  const blank = { name: '', taskType: '', entityType: 'Artwork', departmentId: '', priority: 'High', description: '', slaHours: 24, aiFirstAttempt: false, requiresReview: true, checklistText: '' }
  const toForm = (t) => t ? {
    name: t.name || '', taskType: t.taskType || '', entityType: t.entityType || 'Artwork',
    departmentId: t.departmentId || '', priority: t.priority || 'High', description: t.description || '',
    slaHours: t.slaHours ?? null, aiFirstAttempt: !!t.aiFirstAttempt, requiresReview: t.requiresReview !== false,
    checklistText: parseChecklist(t.checklistJson).map((c) => (typeof c === 'string' ? c : c.item)).join('\n'),
  } : blank
  const [f, setF] = useState(toForm(editing))
  const [seededFor, setSeededFor] = useState(editing?.id || 'new')
  if (open && (editing?.id || 'new') !== seededFor) { setF(toForm(editing)); setSeededFor(editing?.id || 'new') }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = () => {
    const checklist = f.checklistText.split('\n').map((s) => s.trim()).filter(Boolean).map((item) => ({ item, isRequired: true }))
    onSave({
      name: f.name.trim(), taskType: f.taskType.trim() || f.name.trim(), entityType: f.entityType,
      departmentId: f.departmentId || null, priority: f.priority, description: f.description.trim() || undefined,
      slaHours: f.slaHours === '' ? null : (f.slaHours == null ? null : Number(f.slaHours)),
      aiFirstAttempt: f.aiFirstAttempt, requiresReview: f.requiresReview, checklist,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit template' : 'New template'}
      subtitle="Blueprint that creates a task (and auto-creates on a business event)" width="max-w-lg"
      footer={<>
        <button onClick={onClose} className="focus-ring rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">Cancel</button>
        <button onClick={submit} disabled={!f.name.trim() || saving} className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
        </button>
      </>}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Template name</span>
          <input className={modalInput} value={f.name} onChange={set('name')} placeholder="e.g. Background Removal" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Task type</span>
            <input className={modalInput} value={f.taskType} onChange={set('taskType')} placeholder="Background Removal" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Related module</span>
            <select className={modalInput} value={f.entityType} onChange={set('entityType')}>{ENTITY_TYPES.map((e) => <option key={e}>{e}</option>)}</select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Department</span>
            <select className={modalInput} value={f.departmentId} onChange={set('departmentId')}>
              <option value="">— none —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Default priority</span>
            <select className={modalInput} value={f.priority} onChange={set('priority')}>{PRIOS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Description</span>
          <textarea className={modalInput + ' h-16 resize-none'} value={f.description} onChange={set('description')} placeholder="What this task involves…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Checklist items <span className="text-ink-tertiary">(one per line)</span></span>
          <textarea className={modalInput + ' h-20 resize-none'} value={f.checklistText} onChange={set('checklistText')} placeholder={'Transparency verified\nClean edges\nNo halos'} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">SLA (due-time)</span>
            <select className={modalInput} value={f.slaHours == null ? '' : f.slaHours} onChange={(e) => setF((s) => ({ ...s, slaHours: e.target.value === '' ? null : Number(e.target.value) }))}>
              {SLA_OPTS.map(([label, h]) => <option key={label} value={h == null ? '' : h}>{label}</option>)}
            </select>
          </label>
          <div className="flex flex-col justify-center gap-1.5 pt-4">
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              <input type="checkbox" checked={f.aiFirstAttempt} onChange={set('aiFirstAttempt')} className="h-4 w-4 rounded border-border-strong accent-accent" /> AI first attempt
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              <input type="checkbox" checked={f.requiresReview} onChange={set('requiresReview')} className="h-4 w-4 rounded border-border-strong accent-accent" /> Requires review
            </label>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function TaskTemplates() {
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createInitial, setCreateInitial] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500) }

  const load = () => {
    setLoading(true)
    Promise.all([api.templates(), api.departments().catch(() => ({ departments: [] }))])
      .then(([t, d]) => { setTemplates(t.templates || []); setDepartments(d.departments || []) })
      .catch((e) => flash(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    setSaving(true)
    try {
      if (editing) { await api.updateTemplate(editing.id, data); flash(`Template "${data.name}" updated`) }
      else { await api.createTemplate(data); flash(`Template "${data.name}" created`) }
      setFormOpen(false); setEditing(null); load()
    } catch (e) { flash(e.message) } finally { setSaving(false) }
  }
  const toggleActive = async (t) => {
    setTemplates((list) => list.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x)))
    try { await api.updateTemplate(t.id, { isActive: !t.isActive }) } catch (e) { flash(e.message); load() }
  }
  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return
    try { await api.deleteTemplate(t.id); flash('Template deleted'); load() } catch (e) { flash(e.message) }
  }
  const use = (t) => {
    setCreateInitial({
      title: t.name, taskType: t.taskType, priority: t.priority || 'High',
      checklist: parseChecklist(t.checklistJson).map((c) => ({ item: typeof c === 'string' ? c : c.item, isRequired: true })),
    })
    setCreateOpen(true)
  }

  return (
    <AppShell title="Task Templates" subtitle="Blueprints that create tasks on business events">
      <div className="mb-4 flex justify-end">
        <button onClick={() => { setEditing(null); setFormOpen(true) }} className="focus-ring flex items-center gap-2 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={15} /> New Template
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-tertiary">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink-tertiary">No templates yet. Click <span className="font-semibold">New Template</span> to create one.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold text-ink">{t.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-tertiary">
                    {t.department && <span className="rounded-chip px-1.5 py-0.5 font-semibold text-white" style={{ background: DEPT_COLOR[t.department.code] || '#605E5C' }}>{t.department.name}</span>}
                    · {t.taskType}
                  </div>
                </div>
                <button onClick={() => toggleActive(t)} title={t.isActive ? 'Active' : 'Inactive'}
                  className={'relative h-5 w-9 shrink-0 rounded-full transition-colors ' + (t.isActive ? 'bg-accent' : 'bg-border-strong')}>
                  <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (t.isActive ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>

              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary">{t.description || '—'}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-chip bg-subtle px-2 py-0.5 text-ink-secondary">{parseChecklist(t.checklistJson).length} checklist items</span>
                <span className="rounded-chip bg-subtle px-2 py-0.5 text-ink-secondary">SLA {slaLabel(t.slaHours)}</span>
                {t.aiFirstAttempt && <span className="flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 font-semibold text-accent"><Bot size={11} /> AI first attempt</span>}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-ink-tertiary">Used {t.usageCount || 0}×</span>
                <div className="flex gap-1.5">
                  <button onClick={() => remove(t)} title="Delete" className="focus-ring flex items-center rounded-control border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-tertiary hover:bg-subtle hover:text-danger"><Trash2 size={12} /></button>
                  <button onClick={() => { setEditing(t); setFormOpen(true) }} className="focus-ring flex items-center gap-1 rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle"><Pencil size={12} /> Edit</button>
                  <button onClick={() => use(t)} className="focus-ring flex items-center gap-1 rounded-control bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent-softborder"><CheckCircle2 size={12} /> Use</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateForm open={formOpen} editing={editing} departments={departments} saving={saving}
        onClose={() => { setFormOpen(false); setEditing(null) }} onSave={save} />
      <CreateTaskPanel open={createOpen} initial={createInitial} onClose={() => setCreateOpen(false)} onCreated={() => flash('Task created from template')} />
      <Toast toast={toast} />
    </AppShell>
  )
}
