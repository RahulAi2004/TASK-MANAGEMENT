import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, Upload, Bot } from 'lucide-react'
import { api } from '../../data/api'
import { useAuth, initials } from '../../auth/AuthContext'
import VoiceRecorder from '../../components/VoiceRecorder'

function SectionHead({ n, title, optional }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
        {n}
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {optional && <span className="text-xs text-ink-tertiary">(Optional)</span>}
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-secondary">
        {label} {required && <span className="text-status-danger">*</span>}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  'focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary'

const TASK_TYPES = [
  'Background Removal', 'Mockup Creation', 'Production Artwork', 'Artwork Extraction',
  'QA Review', 'Gangsheet Preparation', 'Follow-up', 'Bug Fix', 'Hardware', 'Access Request',
]
const ENTITY_TYPES = ['Artwork', 'Sales Order', 'Lead', 'System']

export default function CreateTaskPanel({ open, onClose, onCreated, initial }) {
  const { user } = useAuth()
  const [assignees, setAssignees] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    title: '', taskType: TASK_TYPES[0], priority: 'High',
    entityType: 'Artwork', entityId: '', assignedUserId: '',
    dueAt: '', estimatedMinutes: '', description: '',
  })
  const [checklist, setChecklist] = useState([{ item: '', isRequired: true }])
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
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
    setVoiceNotes([])
    setActiveNote(null)
    setSaveAsTemplate(false)
    // Apply template prefill (if any) when the panel opens
    if (initial) {
      setForm((f) => ({ ...f, ...initial }))
      if (initial.checklist) setChecklist(initial.checklist)
    }
    api
      .assignableUsers()
      .then((d) => {
        setAssignees(d.users)
        setForm((f) => ({ ...f, assignedUserId: f.assignedUserId || d.users[0]?.id || '' }))
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    const cleanChecklist = checklist.filter((c) => c.item.trim())
    try {
      await api.createTask({
        title: form.title,
        taskType: form.taskType,
        priority: form.priority,
        entityType: form.entityType,
        entityId: form.entityId || 'GENERAL',
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
            name: form.title,
            taskType: form.taskType,
            entityType: form.entityType,
            priority: form.priority,
            description: form.description || undefined,
            estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
            checklist: cleanChecklist.map((c) => ({ item: c.item.trim(), isRequired: c.isRequired !== false })),
          })
        } catch (e) {
          // Task was created; only the template failed (e.g. a template with that
          // name already exists). Keep the panel open so the note is seen.
          onCreated?.()
          setError('Task created — but template not saved: ' + e.message)
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-app shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {user.role === 'SALES' ? 'Create Design Task' : 'Create New Task'}
            </h2>
            <p className="text-xs text-ink-secondary">
              {user.role === 'SALES'
                ? 'Assign a design task to a designer with clear instructions.'
                : 'Assign a new task to anyone in the organization.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="focus-ring rounded-control border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !form.title || !form.assignedUserId}
              className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? 'Creating…' : saveAsTemplate ? 'Create Task + Template' : 'Create Task'}
            </button>
            <button
              onClick={onClose}
              className="focus-ring ml-1 grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-control border border-status-danger/30 bg-status-dangersoft px-4 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="grid flex-1 grid-cols-2 gap-5 overflow-y-auto p-6">
          {/* Left column */}
          <div className="space-y-6">
            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={1} title="Task Information" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Task Title" required>
                    <input className={inputCls} value={form.title} onChange={set('title')} placeholder="e.g. Background Removal" />
                  </Field>
                </div>
                <Field label="Task Type" required>
                  <select className={inputCls} value={form.taskType} onChange={set('taskType')}>
                    {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Priority" required>
                  <select className={inputCls} value={form.priority} onChange={set('priority')}>
                    {['Urgent', 'High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Related Module" required>
                  <select className={inputCls} value={form.entityType} onChange={set('entityType')}>
                    {ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Related Record" required>
                  <input className={inputCls} value={form.entityId} onChange={set('entityId')} placeholder="AW-2026-000125" />
                </Field>
              </div>
            </section>

            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={2} title="Assignment" />
              <Field label="Assign To" required>
                <select className={inputCls} value={form.assignedUserId} onChange={set('assignedUserId')}>
                  {assignees.length === 0 && <option value="">No assignable users</option>}
                  {assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toLowerCase()}) · {u.openTasks} open · {u.dueToday} due today
                    </option>
                  ))}
                </select>
              </Field>
              {form.assignedUserId && (
                <div className="mt-3 flex items-center gap-2.5 rounded-control bg-subtle p-3">
                  {(() => {
                    const u = assignees.find((a) => a.id === form.assignedUserId)
                    if (!u) return null
                    return (
                      <>
                        <div
                          className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
                          style={{ background: u.color }}
                        >
                          {initials(u.name)}
                        </div>
                        <div className="text-xs leading-tight">
                          <div className="font-semibold text-ink">{u.name}</div>
                          <div className="text-ink-tertiary">
                            {u.title} · {u.openTasks} open task{u.openTasks !== 1 && 's'} · {u.overdue} overdue
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </section>

            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={3} title="Schedule & SLA" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Due Date & Time" required>
                  <input className={inputCls} type="datetime-local" value={form.dueAt} onChange={set('dueAt')} />
                </Field>
                <Field label="Estimated (min)">
                  <input className={inputCls} type="number" value={form.estimatedMinutes} onChange={set('estimatedMinutes')} placeholder="45" />
                </Field>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={4} title="Checklist" optional />
              <div className="space-y-2">
                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls + ' flex-1'}
                      value={c.item}
                      placeholder={`Checklist item ${i + 1}`}
                      onChange={(e) =>
                        setChecklist((l) => l.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))
                      }
                    />
                    <button
                      onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))}
                      className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-control text-ink-tertiary hover:bg-subtle hover:text-status-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setChecklist((l) => [...l, { item: '', isRequired: true }])}
                className="focus-ring mt-3 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <Plus size={14} /> Add Item
              </button>
            </section>

            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={5} title="Instructions" />
              <textarea
                className={inputCls + ' h-28 resize-none'}
                value={form.description}
                onChange={set('description')}
                placeholder="Remove the white background from the artwork. Clean the edges. Save as transparent PNG."
              />
              <div className="mt-3 space-y-2">
                {voiceNotes.map((n, i) => (
                  <div key={i} className="space-y-1 rounded-control bg-subtle p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-semibold text-ink-tertiary">#{i + 1}</span>
                      <audio controls src={n.audio} className="h-9 min-w-0 flex-1" />
                      <button
                        type="button"
                        title="Delete voice note"
                        onClick={() => setVoiceNotes((list) => list.filter((_, j) => j !== i))}
                        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-control text-ink-tertiary hover:bg-surface hover:text-status-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {n.transcript && (
                      <p className="pl-7 text-xs italic leading-relaxed text-ink-secondary">"{n.transcript}"</p>
                    )}
                  </div>
                ))}
                {voiceNotes.length + (activeNote ? 1 : 0) < MAX_VOICE_NOTES && (
                  <>
                    <VoiceRecorder value={activeNote?.audio || null} onChange={onVoice} />
                    {activeNote?.transcript && (
                      <p className="rounded-control bg-subtle p-2.5 text-xs italic leading-relaxed text-ink-secondary">
                        "{activeNote.transcript}"
                      </p>
                    )}
                    {activeNote && (
                      <button
                        type="button"
                        onClick={addAnotherNote}
                        className="focus-ring flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                      >
                        <Plus size={14} /> Record another voice note
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={6} title="Attachments" optional />
              <div className="grid place-items-center rounded-control border-2 border-dashed border-border-strong bg-subtle py-6 text-center text-sm text-ink-secondary opacity-60">
                <Upload size={20} className="mb-1 text-ink-tertiary" />
                File uploads arrive with the storage service
              </div>
            </section>

            <section className="rounded-card border border-border bg-surface p-5 shadow-card">
              <SectionHead n={7} title="Automation & AI" optional />
              <div className="flex items-center gap-2 text-sm text-ink-secondary opacity-60">
                <Bot size={16} className="text-accent" /> AI First Attempt — enabled per template in a later phase
              </div>
            </section>

            {user.role === 'ADMIN' && (
              <section className="rounded-card border border-border bg-surface p-5 shadow-card">
                <SectionHead n={8} title="Save as Template" optional />
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border-strong accent-accent"
                  />
                  <span>
                    Also save these details as a reusable template — it will appear under{' '}
                    <span className="font-medium text-ink">Task Templates</span> for next time.
                    <span className="mt-1 block text-xs text-ink-tertiary">
                      Saves the title, type, priority, module, instructions and checklist.
                    </span>
                  </span>
                </label>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
