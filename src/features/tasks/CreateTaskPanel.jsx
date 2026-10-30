// New Task — a short form by default (what, who, when, priority, instructions); everything else
// sits under "More details". Only "what" and "who" are required; the rest get sensible defaults.
import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, ChevronDown, Repeat } from 'lucide-react'
import { api } from '../../data/api'
import { useAuth, initials } from '../../auth/AuthContext'
import VoiceRecorder from '../../components/VoiceRecorder'
import { CATEGORIES } from './taskMeta'
import { t as tr } from '../../i18n'

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">
        {tr(label)} {required && <span className="text-[12px] font-normal text-ink-tertiary">{tr('(required)')}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-tertiary">{tr(hint)}</span>}
    </label>
  )
}

const inputCls =
  'focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-tertiary'

const TASK_TYPES = [
  'General', 'Background Removal', 'Mockup Creation', 'Production Artwork', 'Artwork Extraction',
  'QA Review', 'Gangsheet Preparation', 'Follow-up', 'Bug Fix', 'Hardware', 'Access Request',
]
const ENTITY_TYPES = ['General', 'Artwork', 'Sales Order', 'Lead', 'System']
const PRIORITIES = [
  { value: 'Low', tone: '#5B6474' },
  { value: 'Medium', tone: '#B98500' },
  { value: 'High', tone: '#E5383B' },
  { value: 'Urgent', tone: '#B4232A' },
]

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const at = (daysAhead, hour = 17) => {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return toLocalInput(d)
}
const DUE_PICKS = [
  { label: 'Today, 5 PM', value: () => at(0) },
  { label: 'Tomorrow', value: () => at(1) },
  { label: 'In 3 days', value: () => at(3) },
  { label: 'Next week', value: () => at(7) },
]

export default function CreateTaskPanel({ open, onClose, onCreated, initial }) {
  const { user } = useAuth()
  const [assignees, setAssignees] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [form, setForm] = useState({
    title: '', taskType: 'General', priority: 'Medium',
    entityType: 'General', entityId: '', assignedUserId: '',
    category: 'General', customerName: '', routineTaskId: '',
    dueAt: '', estimatedMinutes: '', description: '', groupId: '',
  })
  const [checklist, setChecklist] = useState([{ item: '', isRequired: true }])
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [routines, setRoutines] = useState([])
  const [groups, setGroups] = useState([])
  const MAX_VOICE_NOTES = 5
  const [voiceNotes, setVoiceNotes] = useState([]) // [{ audio, transcript }]
  const [activeNote, setActiveNote] = useState(null) // recording not yet added to the list
  const voiceNotesRef = useRef(voiceNotes)
  useEffect(() => {
    voiceNotesRef.current = voiceNotes
  }, [voiceNotes])

  // Handles both the initial emit and the late Groq-transcript upgrade — if the
  // audio was already moved into the list, update it there instead of the slot.
  const onVoice = (audio, transcript) => {
    if (!audio) return setActiveNote(null)
    if (voiceNotesRef.current.some((n) => n.audio === audio)) {
      setVoiceNotes((list) => list.map((n) => (n.audio === audio ? { ...n, transcript } : n)))
    } else {
      setActiveNote({ audio, transcript })
    }
  }

  const addAnotherNote = () => {
    if (!activeNote) return
    setVoiceNotes((list) => [...list, activeNote])
    setActiveNote(null)
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setMissing([])
    setVoiceNotes([])
    setActiveNote(null)
    setSaveAsTemplate(false)
    setForm((f) => ({ ...f, routineTaskId: '', groupId: '' }))
    api.routines({ active: 1 }).then((d) => setRoutines(d.routines)).catch(() => setRoutines([]))
    api.groups().then((d) => setGroups(d.groups)).catch(() => setGroups([]))
    // Apply template prefill (if any) when the panel opens
    if (initial) {
      setForm((f) => ({ ...f, ...initial }))
      if (initial.checklist) setChecklist(initial.checklist)
    }
    api
      .assignableUsers()
      .then((d) => {
        setAssignees(d.users)
        // No pre-selected person: picking who does the work should be a deliberate choice.
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Routine task → prefill title, description, priority, target time, and (via its template)
  // work type + checklist. The server snapshots the routine's SLA thresholds onto the task.
  const routine = routines.find((r) => r.id === form.routineTaskId)
  const pickRoutine = (id) => {
    const r = routines.find((x) => x.id === id)
    if (!r) return setForm((f) => ({ ...f, routineTaskId: '' }))
    setForm((f) => ({
      ...f,
      routineTaskId: r.id,
      title: r.title,
      description: r.description || f.description,
      priority: r.priority,
      estimatedMinutes: String(r.normalMinutes),
      taskType: r.template?.taskType && TASK_TYPES.includes(r.template.taskType) ? r.template.taskType : f.taskType,
    }))
    let items = []
    try { items = JSON.parse(r.template?.checklistJson || '[]') } catch { items = [] }
    if (items.length) setChecklist(items.map((c) => ({ item: typeof c === 'string' ? c : c.item, isRequired: c.isRequired !== false })))
  }
  const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ' ' + (min % 60) + 'm' : ''}` : `${min}m`)

  const submit = async () => {
    const need = []
    if (!form.title.trim()) need.push('What needs to be done')
    if (!form.assignedUserId) need.push('Who should do it')
    setMissing(need)
    if (need.length) return
    setBusy(true)
    setError(null)
    const cleanChecklist = checklist.filter((c) => c.item.trim())
    const taskType = form.taskType || 'General'
    try {
      await api.createTask({
        title: form.title.trim(),
        taskType,
        priority: form.priority,
        entityType: form.entityType || 'General',
        entityId: form.entityId.trim() || 'GENERAL',
        category: form.category,
        customerName: form.customerName.trim() || undefined,
        routineTaskId: form.routineTaskId || undefined,
        groupId: form.groupId || undefined,
        assignedUserId: form.assignedUserId,
        description: form.description || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
        voiceNotes: [...voiceNotes, ...(activeNote ? [activeNote] : [])].map((n) => ({
          audioData: n.audio,
          transcript: n.transcript || undefined,
        })),
        checklist: cleanChecklist,
      })

      // Optionally save the same details as a reusable template (admin only).
      if (saveAsTemplate && user.role === 'ADMIN') {
        try {
          await api.createTemplate({
            name: form.title.trim(),
            taskType,
            entityType: form.entityType || 'General',
            priority: form.priority,
            description: form.description || undefined,
            estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
            checklist: cleanChecklist.map((c) => ({ item: c.item.trim(), isRequired: c.isRequired !== false })),
          })
        } catch (e) {
          // Task was created; only the template failed (e.g. a template with that
          // name already exists). Keep the panel open so the note is seen.
          onCreated?.()
          setError(tr('Task created — but the template was not saved:') + ' ' + e.message)
          setBusy(false)
          return
        }
      }

      onCreated?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const person = assignees.find((a) => a.id === form.assignedUserId)
  const extrasSet = [
    form.category !== 'General', form.taskType && form.taskType !== 'General', form.entityId.trim(),
    form.customerName.trim(), form.estimatedMinutes, checklist.some((c) => c.item.trim()), saveAsTemplate,
  ].filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-app shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{user.role === 'SALES' ? tr('New design task') : tr('New task')}</h2>
            <p className="text-[13px] text-ink-secondary">{tr("Fill in what, who and when — that’s all you need.")}</p>
          </div>
          <button onClick={onClose} aria-label={tr("Close")} className="focus-ring grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="rounded-control border border-status-danger/30 bg-status-dangersoft px-4 py-2 text-sm text-status-danger">{error}</div>
          )}

          {routines.length > 0 && (
            <div className="rounded-card border border-accent-softborder bg-accent-soft/40 p-3.5">
              <Field label="Start from a routine task" hint="Optional — fills in the title, instructions and time limits for a task you do often.">
                <span className="relative block">
                  <Repeat size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
                  <select className={inputCls + ' pl-9'} value={form.routineTaskId} onChange={(e) => pickRoutine(e.target.value)}>
                    <option value="">{tr("No — a new, one-off task")}</option>
                    {routines.map((r) => (
                      <option key={r.id} value={r.id}>{r.title} · {r.department?.name}</option>
                    ))}
                  </select>
                </span>
              </Field>
              {routine && (
                <p className="mt-2 text-[12px] text-ink-secondary">
                  {tr('Target {a} · at risk after {b} · delayed after {c} · goes to {d}', { a: hm(routine.normalMinutes), b: hm(routine.criticalMinutes), c: hm(routine.delayedMinutes), d: routine.department?.name })}
                </p>
              )}
            </div>
          )}

          <Field label="What needs to be done?" required>
            <input
              className={inputCls + (missing.includes('What needs to be done') ? ' border-status-danger' : '')}
              value={form.title}
              onChange={set('title')}
              maxLength={255}
              placeholder={tr("e.g. Check print placement for order SO-7819")}
            />
          </Field>

          <Field label="Who should do it?" required>
            <select
              className={inputCls + (missing.includes('Who should do it') ? ' border-status-danger' : '')}
              value={form.assignedUserId}
              onChange={set('assignedUserId')}
            >
              <option value="">{assignees.length ? tr('Choose a person…') : tr('Nobody available to assign')}</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title || u.role.toLowerCase()}
                </option>
              ))}
            </select>
            {person && (
              <span className="mt-2 flex items-center gap-2.5 text-[12px] text-ink-secondary">
                <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: person.color }}>
                  {initials(person.name)}
                </span>
                {person.openTasks === 0 ? tr('Has no open tasks right now') : tr('Has {n} open task(s)', { n: person.openTasks })}
                {person.overdue > 0 && <span className="text-status-danger">· {tr('{n} late', { n: person.overdue })}</span>}
              </span>
            )}
          </Field>

          <Field label="When is it due?" hint="Leave empty if there is no deadline.">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DUE_PICKS.map((d) => {
                const value = d.value()
                const on = form.dueAt === value
                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setValue('dueAt', on ? '' : value)}
                    className={'focus-ring rounded-full border px-3 py-1 text-[13px] ' + (on ? 'border-accent bg-accent text-white' : 'border-border-strong text-ink-secondary hover:bg-subtle')}
                  >
                    {tr(d.label)}
                  </button>
                )
              })}
            </div>
            <input className={inputCls} type="datetime-local" value={form.dueAt} onChange={set('dueAt')} />
          </Field>

          <div>
            <span className="mb-1.5 block text-[14px] font-semibold text-ink">{tr("How urgent is it?")}</span>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={tr("Priority")}>
              {PRIORITIES.map((p) => {
                const on = form.priority === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setValue('priority', p.value)}
                    className={'focus-ring rounded-control border py-2 text-[13px] font-medium ' + (on ? 'text-white' : 'border-border-strong bg-surface text-ink-secondary hover:bg-subtle')}
                    style={on ? { background: p.tone, borderColor: p.tone } : undefined}
                  >
                    {tr(p.value)}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Task group">
            <select className={inputCls} value={form.groupId} onChange={set('groupId')}>
              <option value="">{tr('No group')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{tr(g.name)}</option>)}
            </select>
          </Field>

          <Field label="Instructions" hint="Type them, or record a voice note below.">
            <textarea
              className={inputCls + ' h-24 resize-none'}
              value={form.description}
              onChange={set('description')}
              placeholder={tr("e.g. Compare the printed sample with the approved mockup and note any differences.")}
            />
          </Field>
          <div className="-mt-2 space-y-2">
            {voiceNotes.map((n, i) => (
              <div key={i} className="space-y-1 rounded-control bg-subtle p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-semibold text-ink-tertiary">#{i + 1}</span>
                  <audio controls src={n.audio} className="h-9 min-w-0 flex-1" />
                  <button
                    type="button"
                    title={tr("Delete voice note")}
                    onClick={() => setVoiceNotes((list) => list.filter((_, j) => j !== i))}
                    className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-control text-ink-tertiary hover:bg-surface hover:text-status-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {n.transcript && <p className="pl-7 text-xs italic leading-relaxed text-ink-secondary">"{n.transcript}"</p>}
              </div>
            ))}
            {voiceNotes.length + (activeNote ? 1 : 0) < MAX_VOICE_NOTES && (
              <>
                <VoiceRecorder value={activeNote?.audio || null} onChange={onVoice} />
                {activeNote?.transcript && (
                  <p className="rounded-control bg-subtle p-2.5 text-xs italic leading-relaxed text-ink-secondary">"{activeNote.transcript}"</p>
                )}
                {activeNote && (
                  <button type="button" onClick={addAnotherNote} className="focus-ring flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                    <Plus size={14} /> {tr("Record another voice note")}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Everything else, out of the way until needed */}
          <div className="rounded-card border border-border bg-surface">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className="focus-ring flex w-full items-center justify-between rounded-card px-4 py-3 text-left"
            >
              <span>
                <span className="block text-[14px] font-semibold text-ink">{tr("More details")}</span>
                <span className="block text-[12px] text-ink-tertiary">
                  {tr('Optional — category, linked order, customer, target time, checklist')}{extrasSet ? ' · ' + tr('{n} filled in', { n: extrasSet }) : ''}
                </span>
              </span>
              <ChevronDown size={18} className={'shrink-0 text-ink-secondary transition-transform ' + (moreOpen ? 'rotate-180' : '')} />
            </button>
            {moreOpen && (
              <div className="space-y-4 border-t border-border p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Category">
                    <select className={inputCls} value={form.category} onChange={set('category')}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
                    </select>
                  </Field>
                  <Field label="Type of work">
                    <select className={inputCls} value={form.taskType} onChange={set('taskType')}>
                      {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Linked to">
                    <select
                      className={inputCls}
                      value={form.entityType}
                      onChange={(e) => {
                        const entityType = e.target.value
                        // Order records default to "Order Related"; the user can still change it.
                        setForm((f) => ({ ...f, entityType, category: entityType === 'Sales Order' ? 'Order Related' : f.category }))
                      }}
                    >
                      {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t === 'General' ? tr('Nothing specific') : tr(t)}</option>)}
                    </select>
                  </Field>
                  <Field label="Order / reference number">
                    <input className={inputCls} value={form.entityId} onChange={set('entityId')} placeholder={tr("e.g. SO-7819")} />
                  </Field>
                  <Field label="Customer">
                    <input className={inputCls} value={form.customerName} onChange={set('customerName')} maxLength={160} placeholder={tr("e.g. Bright Wear Co.")} />
                  </Field>
                  <Field label="Target time (minutes)" hint="How long it should normally take.">
                    <input className={inputCls} type="number" min="1" value={form.estimatedMinutes} onChange={set('estimatedMinutes')} placeholder={tr("e.g. 45")} />
                  </Field>
                </div>

                <div>
                  <span className="mb-1.5 block text-[14px] font-semibold text-ink">{tr("Checklist")}</span>
                  <div className="space-y-2">
                    {checklist.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          className={inputCls + ' flex-1'}
                          value={c.item}
                          placeholder={tr('Step {n}', { n: i + 1 })}
                          onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
                        />
                        <button
                          type="button"
                          title={tr("Remove step")}
                          onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))}
                          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-tertiary hover:bg-subtle hover:text-status-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setChecklist((l) => [...l, { item: '', isRequired: true }])}
                    className="focus-ring mt-2 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <Plus size={14} /> {tr("Add a step")}
                  </button>
                </div>

                {user.role === 'ADMIN' && (
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong accent-accent"
                    />
                    <span>{tr("Also save this as a template, so it can be reused from")} <span className="font-medium text-ink">{tr("Task Templates")}</span>.</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer: always visible; says what's missing instead of silently disabling */}
        <div className="border-t border-border bg-surface px-5 py-3">
          {missing.length > 0 && (
            <p className="mb-2 text-[13px] text-status-danger">{tr('Please fill in: {fields}.', { fields: missing.map((m) => tr(m)).join(tr(' and ')) })}</p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="focus-ring rounded-control border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-subtle">
              {tr("Cancel")}
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="focus-ring rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? tr('Creating…') : saveAsTemplate ? tr('Create task + template') : tr('Create task')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
