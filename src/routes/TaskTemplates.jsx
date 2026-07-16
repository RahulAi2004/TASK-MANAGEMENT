// ADMIN — task templates. New/Edit persist to local list; Use opens Create Task prefilled.
import { useState } from 'react'
import { Plus, Bot, Pencil, CheckCircle2 } from 'lucide-react'
import AppShell from '../app/AppShell'
import Modal, { modalInput, Toast } from '../components/Modal'
import CreateTaskPanel from '../features/tasks/CreateTaskPanel'

const SEED = [
  { name: 'Background Removal', dept: 'Design', type: 'Background Removal', desc: 'Remove background, clean edges, deliver transparent PNG at 300 DPI.', checklist: 3, sla: 'Rush — 2h', ai: true, used: 42, active: true },
  { name: 'Artwork Extraction', dept: 'Design', type: 'Artwork Extraction', desc: 'Extract vector/raster artwork from a customer-supplied file.', checklist: 2, sla: 'Standard — 24h', ai: true, used: 31, active: true },
  { name: 'Customer Mockup', dept: 'Design', type: 'Mockup Creation', desc: 'Place approved artwork on garment templates for customer approval.', checklist: 4, sla: 'Same day — 8h', ai: true, used: 28, active: true },
  { name: 'Production Artwork', dept: 'Design', type: 'Production Artwork', desc: 'Prepare print-ready 300 DPI artwork for DTF/DTG production.', checklist: 5, sla: 'Standard — 24h', ai: false, used: 19, active: true },
  { name: 'Gangsheet Preparation', dept: 'Production', type: 'Gangsheet Preparation', desc: 'Nest approved designs on a gangsheet for a DTF run.', checklist: 3, sla: 'Same day — 8h', ai: false, used: 12, active: true },
  { name: 'QA Review', dept: 'QA', type: 'QA Review', desc: 'Check resolution, transparency, halos and dimensions before approval.', checklist: 6, sla: 'Rush — 2h', ai: false, used: 37, active: true },
  { name: 'Purchase Order Prep', dept: 'Procurement', type: 'Follow-up', desc: 'Draft the supplier purchase order from the approved order.', checklist: 2, sla: 'Standard — 24h', ai: false, used: 9, active: false },
  { name: 'Fix / Bug Ticket', dept: 'IT', type: 'Bug Fix', desc: 'Internal IT ticket — bug fix, hardware or access request.', checklist: 1, sla: 'Standard — 24h', ai: false, used: 6, active: true },
]
const DEPT_COLOR = { Design: '#5B4BE6', Production: '#0F7B6C', QA: '#C19C00', Procurement: '#E8710A', IT: '#605E5C' }
const DEPTS = ['Design', 'Production', 'QA', 'Procurement', 'IT', 'Sales']
const PRIOS = ['Urgent', 'High', 'Medium', 'Low']

function TemplateForm({ open, onClose, onSave, editing }) {
  const blank = { name: '', dept: 'Design', type: 'Background Removal', desc: '', checklist: 3, sla: 'Standard — 24h', ai: false, priority: 'High' }
  const [f, setF] = useState(editing || blank)
  // re-sync when opening for a different template
  const [key, setKey] = useState(0)
  if (open && editing && f !== editing && key === 0) { setF(editing); setKey(1) }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <Modal
      open={open}
      onClose={() => { setKey(0); onClose() }}
      title={editing ? 'Edit template' : 'New template'}
      subtitle="Blueprint that auto-creates tasks on a business event"
      width="max-w-lg"
      footer={
        <>
          <button onClick={() => { setKey(0); onClose() }} className="focus-ring rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">Cancel</button>
          <button onClick={() => { onSave(f); setKey(0) }} disabled={!f.name.trim()} className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
            {editing ? 'Save changes' : 'Create template'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Template name</span>
          <input className={modalInput} value={f.name} onChange={set('name')} placeholder="e.g. Background Removal" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Department</span>
            <select className={modalInput} value={f.dept} onChange={set('dept')}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Default priority</span>
            <select className={modalInput} value={f.priority} onChange={set('priority')}>{PRIOS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-secondary">Description</span>
          <textarea className={modalInput + ' h-16 resize-none'} value={f.desc} onChange={set('desc')} placeholder="What this task involves…" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Checklist items</span>
            <input className={modalInput} type="number" min="0" value={f.checklist} onChange={set('checklist')} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">SLA template</span>
            <select className={modalInput} value={f.sla} onChange={set('sla')}>
              {['Rush — 2h', 'Same day — 8h', 'Standard — 24h', 'None'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={f.ai} onChange={set('ai')} className="h-4 w-4 rounded border-border-strong accent-accent" />
          AI first attempt — an agent tries the task before the assignee
        </label>
      </div>
    </Modal>
  )
}

export default function TaskTemplates() {
  const [templates, setTemplates] = useState(SEED)
  const [formOpen, setFormOpen] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [createInitial, setCreateInitial] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500) }

  const openNew = () => { setEditingIdx(null); setFormOpen(true) }
  const openEdit = (i) => { setEditingIdx(i); setFormOpen(true) }
  const save = (data) => {
    if (editingIdx == null) {
      setTemplates((t) => [{ ...data, used: 0, active: true }, ...t])
      flash(`Template "${data.name}" created`)
    } else {
      setTemplates((t) => t.map((x, i) => (i === editingIdx ? { ...x, ...data } : x)))
      flash(`Template "${data.name}" updated`)
    }
    setFormOpen(false)
  }
  const use = (t) => {
    setCreateInitial({
      title: t.name,
      taskType: t.type,
      priority: t.priority || 'High',
      checklist: Array.from({ length: Math.max(1, Number(t.checklist) || 1) }, () => ({ item: '', isRequired: true })),
    })
    setCreateOpen(true)
  }

  return (
    <AppShell title="Task Templates" subtitle="Blueprints that auto-create tasks on business events">
      <div className="mb-4 flex justify-end">
        <button onClick={openNew} className="focus-ring flex items-center gap-2 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
          <Plus size={15} /> New Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t, i) => (
          <div key={i} className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-semibold text-ink">{t.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-tertiary">
                  <span className="rounded-chip px-1.5 py-0.5 font-semibold text-white" style={{ background: DEPT_COLOR[t.dept] || '#605E5C' }}>{t.dept}</span>
                  · {t.type}
                </div>
              </div>
              <button
                onClick={() => setTemplates((list) => list.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}
                className={'relative h-5 w-9 shrink-0 rounded-full transition-colors ' + (t.active ? 'bg-accent' : 'bg-border-strong')}
                title={t.active ? 'Active' : 'Inactive'}
              >
                <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (t.active ? 'right-0.5' : 'left-0.5')} />
              </button>
            </div>

            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary">{t.desc}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-chip bg-subtle px-2 py-0.5 text-ink-secondary">{t.checklist} checklist items</span>
              <span className="rounded-chip bg-subtle px-2 py-0.5 text-ink-secondary">SLA {t.sla}</span>
              {t.ai && <span className="flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 font-semibold text-accent"><Bot size={11} /> AI first attempt</span>}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] text-ink-tertiary">Used {t.used}× this month</span>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(i)} className="focus-ring flex items-center gap-1 rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => use(t)} className="focus-ring flex items-center gap-1 rounded-control bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent-softborder">
                  <CheckCircle2 size={12} /> Use
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <TemplateForm
        open={formOpen}
        editing={editingIdx != null ? templates[editingIdx] : null}
        onClose={() => setFormOpen(false)}
        onSave={save}
      />
      <CreateTaskPanel
        open={createOpen}
        initial={createInitial}
        onClose={() => setCreateOpen(false)}
        onCreated={() => flash('Task created from template')}
      />
      <Toast toast={toast} />
    </AppShell>
  )
}
