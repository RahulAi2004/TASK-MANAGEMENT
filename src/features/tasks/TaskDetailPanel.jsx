// Task Detail — right-docked panel on the Task Management page (overlay below xl widths).
// Header + status actions · SLA / elapsed / normal time · task information · description ·
// current status · reason for delay · recordings. Checklist/files/comments/activity live in
// the full working view (/task/:id), linked at the bottom.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  X, ChevronDown, AlertCircle, Clock, CheckCircle2, Mic, Paperclip, Play, Pause,
  MoreHorizontal, Pencil, ExternalLink, Download, Trash2,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityFlag from './PriorityFlag'
import VoiceRecorder from '../../components/VoiceRecorder'
import { CategoryChip } from './chips'
import useNow from './useNow'
import {
  taskMeta, taskCategory, elapsedMs, slaStatus, SLA_STYLE, fmtDuration, fmtMinutes, fmtDate,
  fmtTime, fmtClock, allowedEvents, DELAY_REASONS,
} from './taskMeta'
import { api } from '../../data/api'
import { useApi, useAuth, initials } from '../../auth/AuthContext'

const SLA_ICON = { Delayed: AlertCircle, Critical: Clock, Normal: CheckCircle2 }
const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const card = 'rounded-card border border-border bg-surface p-4'
const inputCls =
  'focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary'

function Avatar({ u, size = 26 }) {
  if (!u) return null
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ background: u.color || '#5B6474', width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(u.name)}
    </span>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid min-h-[34px] grid-cols-[84px_1fr] items-center gap-2 py-1">
      <span className="text-[13px] text-ink-secondary">{label}</span>
      <span className="min-w-0 text-[13px] text-ink">{children}</span>
    </div>
  )
}

const readAsDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })

// Duration of an uploaded audio file (mp3/m4a/wav report it reliably); null if unknown.
const probeDuration = (src) =>
  new Promise((res) => {
    const a = new Audio()
    const done = (v) => { a.src = ''; res(v) }
    const timer = setTimeout(() => done(null), 4000)
    a.onloadedmetadata = () => { clearTimeout(timer); done(isFinite(a.duration) ? Math.round(a.duration) : null) }
    a.onerror = () => { clearTimeout(timer); done(null) }
    a.preload = 'metadata'
    a.src = src
  })

export default function TaskDetailPanel({ taskId, onClose, onChanged }) {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(() => api.task(taskId), [taskId])
  const now = useNow(30_000)
  const t = data?.task
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    reload()
    onChanged?.()
  }
  const run = async (fn) => {
    setErr(null)
    setBusy(true)
    try {
      await fn()
      refresh()
      return true
    } catch (e) {
      setErr(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  // ── Status actions ────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState(null) // { event, label } needing a note (submit / reject)
  const [pendingText, setPendingText] = useState('')
  const fire = async (x) => {
    setMenuOpen(false)
    if (x.event === 'submit' || x.event === 'reject') {
      setPending(x)
      setPendingText('')
      return
    }
    if (x.event === 'cancel' && !window.confirm(`Cancel ${t.taskNo}? This cannot be undone.`)) return
    await run(() => api.transition(t.id, { event: x.event }))
  }
  const confirmPending = async () => {
    const body =
      pending.event === 'submit'
        ? { event: 'submit', completionSummary: pendingText.trim() || undefined }
        : { event: 'reject', notes: pendingText.trim() || undefined }
    if (await run(() => api.transition(t.id, body))) setPending(null)
  }

  // ── Current status (issue) ────────────────────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusText, setStatusText] = useState('')
  const saveStatus = async () => {
    if (await run(() => api.updateNotes(t.id, { currentStatus: statusText }))) setEditingStatus(false)
  }

  // ── Reason for delay ──────────────────────────────────────────────────────
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const saveDelay = async () => {
    if (await run(() => api.updateNotes(t.id, { delayReason: reason, delayRemarks: remarks }))) {
      setReason('')
      setRemarks('')
    }
  }

  // ── Recordings ────────────────────────────────────────────────────────────
  const audioRef = useRef(null)
  const fileRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [rowMenu, setRowMenu] = useState(null)
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState(null) // { audio, transcript, duration }

  const togglePlay = (n) => {
    const a = audioRef.current
    if (!a) return
    if (playingId === n.id) {
      a.pause()
      setPlayingId(null)
      return
    }
    a.src = n.audioData
    a.play().then(() => setPlayingId(n.id)).catch(() => setErr('This recording could not be played'))
  }
  const saveDraft = async () => {
    if (!draft) return
    const ok = await run(() =>
      api.addRecording(t.id, {
        audioData: draft.audio,
        transcript: draft.transcript || undefined,
        durationSeconds: draft.duration || undefined,
      })
    )
    if (ok) {
      setDraft(null)
      setRecording(false)
    }
  }
  const uploadAudio = async (file) => {
    if (!file) return
    if (!file.type.startsWith('audio/')) return setErr('Choose an audio file (mp3, m4a, wav, webm…)')
    if (file.size > MAX_AUDIO_BYTES) return setErr('Recording must be under 10 MB')
    const dataUrl = await readAsDataUrl(file)
    const durationSeconds = await probeDuration(dataUrl)
    await run(() => api.addRecording(t.id, { audioData: dataUrl, fileName: file.name, ...(durationSeconds != null ? { durationSeconds } : {}) }))
  }
  const deleteRecording = async (n) => {
    setRowMenu(null)
    if (!window.confirm(`Delete ${n.fileName}?`)) return
    if (playingId === n.id) audioRef.current?.pause()
    await run(() => api.deleteRecording(t.id, n.id))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  let body
  if (loading && !t) {
    body = <div className="py-16 text-center text-sm text-ink-tertiary">Loading…</div>
  } else if (error || !t) {
    body = <div className="py-16 text-center text-sm text-status-danger">{error || 'Task not found'}</div>
  } else {
    const meta = taskMeta(t)
    const sla = slaStatus(t, now)
    const slaStyle = sla ? SLA_STYLE[sla] : null
    const SlaIcon = sla ? SLA_ICON[sla] : null
    const events = allowedEvents(t, user)
    const showDelay = sla === 'Delayed' || sla === 'Critical' || meta.delay
    const isOpen = !['Completed', 'Cancelled'].includes(t.status)
    const recordings = [
      ...(t.voiceNote
        ? [{ id: 'legacy', fileName: 'Voice instruction', audioData: t.voiceNote, transcript: t.voiceTranscript, createdAt: t.createdAt, legacy: true }]
        : []),
      ...(t.voiceNotes || []),
    ]
    const canDeleteRec = (n) =>
      !n.legacy && (user.role === 'ADMIN' || t.createdBy?.id === user.id || n.recordedBy?.id === user.id)

    body = (
      <div className="space-y-3 p-4">
        {/* Title + status */}
        <div className="px-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-accent">{t.taskNo}</div>
              <h2 className="mt-0.5 text-xl font-semibold leading-snug text-ink">{t.title}</h2>
              <div className="mt-0.5 text-xs text-ink-tertiary">{t.taskType}</div>
            </div>
            <div className="relative shrink-0">
              {events.length > 0 ? (
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  disabled={busy}
                  className="focus-ring flex items-center gap-1.5 rounded-control border border-accent-softborder bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent hover:bg-accent-softborder/60 disabled:opacity-60"
                >
                  {t.status} <ChevronDown size={15} />
                </button>
              ) : (
                <StatusBadge status={t.status} />
              )}
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-card border border-border bg-surface py-1 shadow-pop">
                    {events.map((x) => (
                      <button
                        key={x.event}
                        onClick={() => fire(x)}
                        className={
                          'block w-full px-3 py-2 text-left text-sm hover:bg-subtle ' +
                          (x.danger ? 'text-status-danger' : 'text-ink')
                        }
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {pending && (
            <div className="mt-3 rounded-card border border-accent-softborder bg-accent-soft/50 p-3">
              <div className="mb-1.5 text-[13px] font-semibold text-ink">
                {pending.event === 'submit' ? 'Submit for review' : 'Reject submission'}
              </div>
              <textarea
                autoFocus
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                maxLength={2000}
                placeholder={pending.event === 'submit' ? 'Completion summary — what was done (optional)' : 'What needs to change? (optional)'}
                className={inputCls + ' h-20 resize-none'}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setPending(null)} className="focus-ring rounded-control px-3 py-1.5 text-sm text-ink-secondary hover:bg-subtle">
                  Cancel
                </button>
                <button
                  onClick={confirmPending}
                  disabled={busy}
                  className={
                    'focus-ring rounded-control px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ' +
                    (pending.event === 'reject' ? 'bg-status-danger' : 'bg-accent hover:bg-accent-hover')
                  }
                >
                  {pending.event === 'submit' ? 'Submit' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>

        {err && <div className="rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{err}</div>}

        {/* SLA · elapsed · normal */}
        <div className="grid grid-cols-3 divide-x divide-border rounded-card border border-border bg-surface py-3 text-center">
          <div className="px-2">
            {sla ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[15px] font-semibold"
                style={{ background: slaStyle.bg, color: slaStyle.fg }}
                title={slaStyle.hint}
              >
                <SlaIcon size={17} /> {sla}
              </span>
            ) : (
              <span className="text-[15px] font-semibold text-ink-tertiary">—</span>
            )}
            <div className="mt-1 text-xs text-ink-secondary">SLA Status</div>
          </div>
          <div className="px-2">
            <div className="text-[19px] font-semibold text-ink">{t.startedAt ? fmtDuration(elapsedMs(t, now)) : '—'}</div>
            <div className="mt-0.5 text-xs text-ink-secondary">{t.startedAt ? 'Elapsed Time' : 'Not started'}</div>
          </div>
          <div className="px-2">
            <div className="text-[19px] font-semibold text-ink">{fmtMinutes(t.estimatedMinutes)}</div>
            <div className="mt-0.5 text-xs text-ink-secondary">Normal Time (Target)</div>
          </div>
        </div>

        {/* Task information */}
        <section className={card}>
          <h3 className="mb-1.5 text-[15px] font-semibold text-ink">Task Information</h3>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
            <div>
              <Row label="Task Type"><CategoryChip category={taskCategory(t)} /></Row>
              <Row label="Module">{t.department?.name || '—'}</Row>
              <Row label="Entity / Order"><span className="font-medium text-accent">{t.entityId}</span></Row>
              <Row label="Customer Name">{meta.customerName || '—'}</Row>
              <Row label="Priority"><PriorityFlag priority={t.priority} /></Row>
            </div>
            <div className="sm:pl-4">
              <Row label="Owner">
                {t.assignedUser ? (
                  <span className="flex items-center gap-1.5"><Avatar u={t.assignedUser} /> <span className="leading-tight">{t.assignedUser.name}</span></span>
                ) : 'Unassigned'}
              </Row>
              <Row label="Assigned by">
                <span className="flex items-center gap-1.5"><Avatar u={t.createdBy} /> <span className="leading-tight">{t.createdBy?.name}</span></span>
              </Row>
              <Row label="Task Status"><StatusBadge status={t.status} size="sm" /></Row>
              <Row label="Created at">
                <span className="block leading-tight">{fmtDate(t.createdAt)}</span>
                <span className="block text-xs leading-tight text-ink-secondary">{fmtTime(t.createdAt)}</span>
              </Row>
              <Row label="Due at">
                {t.dueAt ? (
                  <span className={sla === 'Delayed' && isOpen ? 'font-medium text-status-danger' : ''}>
                    <span className="block leading-tight">{fmtDate(t.dueAt)}</span>
                    <span className="block text-xs leading-tight opacity-80">{fmtTime(t.dueAt)}</span>
                  </span>
                ) : '—'}
              </Row>
            </div>
          </div>
        </section>

        {/* Description · current status · delay */}
        <section className={card + ' space-y-4'}>
          <div>
            <h3 className="mb-1.5 text-[15px] font-semibold text-ink">Description</h3>
            <p className="whitespace-pre-wrap rounded-control bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink-secondary">
              {t.description || 'No description provided.'}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">Issue / Current status</h3>
              {!editingStatus && isOpen && (
                <button
                  onClick={() => { setStatusText(meta.currentStatus || ''); setEditingStatus(true) }}
                  className="focus-ring flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  <Pencil size={12} /> {meta.currentStatus ? 'Update' : 'Add'}
                </button>
              )}
            </div>
            {editingStatus ? (
              <div>
                <textarea
                  autoFocus
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  maxLength={500}
                  placeholder="What is happening on this task right now?"
                  className={inputCls + ' h-20 resize-none'}
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <button onClick={() => setEditingStatus(false)} className="focus-ring rounded-control px-3 py-1.5 text-sm text-ink-secondary hover:bg-subtle">Cancel</button>
                  <button onClick={saveStatus} disabled={busy} className="focus-ring rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">Save</button>
                </div>
              </div>
            ) : (
              <p className="rounded-control bg-subtle px-3 py-2.5 text-[13px] text-ink-secondary">
                {meta.currentStatus || <span className="text-ink-tertiary">No status update yet.</span>}
              </p>
            )}
          </div>

          {showDelay && (
            <div>
              {meta.delay && (
                <div className="mb-2.5 rounded-control border border-status-danger/20 bg-status-dangersoft/60 px-3 py-2 text-[13px]">
                  <span className="font-semibold text-status-danger">{meta.delay.reason}</span>
                  <span className="text-ink-secondary"> — {meta.delay.remarks}</span>
                  <div className="mt-0.5 text-[11px] text-ink-tertiary">
                    Reported by {meta.delay.byName || 'team'} · {fmtDate(meta.delay.at)} {fmtTime(meta.delay.at)}
                  </div>
                </div>
              )}
              {isOpen && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                      Reason for delay <span className="text-status-danger">*</span>
                    </span>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                      <option value="">Select a reason</option>
                      {DELAY_REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                      Remarks <span className="text-status-danger">*</span>
                    </span>
                    <div className="relative">
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        maxLength={500}
                        placeholder="Enter remarks / additional details…"
                        className={inputCls + ' h-[74px] resize-none pb-5'}
                      />
                      <span className="pointer-events-none absolute bottom-1.5 right-2.5 text-[11px] text-ink-tertiary">{remarks.length}/500</span>
                    </div>
                  </label>
                  <div className="flex justify-end sm:col-span-2">
                    <button
                      onClick={saveDelay}
                      disabled={busy || !reason || !remarks.trim()}
                      className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {meta.delay ? 'Update delay reason' : 'Save delay reason'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recordings */}
        <section className={card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Recordings ({recordings.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setDraft(null); setRecording(true) }}
                disabled={recording}
                className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Mic size={15} /> Record voice
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="focus-ring flex items-center gap-1.5 rounded-control border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
              >
                <Paperclip size={15} /> Add recording
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadAudio(f) }}
              />
            </div>
          </div>

          {recording && (
            <div className="mb-3 rounded-control border border-accent-softborder bg-accent-soft/40 p-3">
              <VoiceRecorder
                autoStart
                value={draft?.audio || null}
                onChange={(audio, transcript, duration) =>
                  setDraft(audio ? { audio, transcript, duration: duration ?? draft?.duration } : null)
                }
              />
              {draft?.transcript && <p className="mt-2 text-xs italic text-ink-secondary">"{draft.transcript}"</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setRecording(false); setDraft(null) }} className="focus-ring rounded-control px-3 py-1.5 text-sm text-ink-secondary hover:bg-subtle">
                  Cancel
                </button>
                <button onClick={saveDraft} disabled={!draft || busy} className="focus-ring rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                  Save recording
                </button>
              </div>
            </div>
          )}

          {recordings.length === 0 && !recording && (
            <p className="py-3 text-center text-[13px] text-ink-tertiary">No recordings yet.</p>
          )}
          <ul className="divide-y divide-border">
            {recordings.map((n) => (
              <li key={n.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => togglePlay(n)}
                  title={playingId === n.id ? 'Pause' : 'Play'}
                  className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent-softborder"
                >
                  {playingId === n.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{n.fileName || `Recording ${n.sequenceNo}`}</div>
                  {n.transcript && <div className="truncate text-[11px] italic text-ink-tertiary" title={n.transcript}>"{n.transcript}"</div>}
                </div>
                <span className="hidden shrink-0 text-xs text-ink-secondary sm:block">{fmtDate(n.createdAt)} {fmtTime(n.createdAt)}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-secondary">{fmtClock(n.durationSeconds)}</span>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setRowMenu((m) => (m === n.id ? null : n.id))}
                    className="focus-ring grid h-7 w-7 place-items-center rounded-control text-ink-secondary hover:bg-subtle"
                    title="More"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {rowMenu === n.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setRowMenu(null)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-card border border-border bg-surface py-1 shadow-pop">
                        <a
                          href={n.audioData}
                          download={n.fileName || 'recording'}
                          onClick={() => setRowMenu(null)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-subtle"
                        >
                          <Download size={14} /> Download
                        </a>
                        {canDeleteRec(n) && (
                          <button onClick={() => deleteRecording(n)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-danger hover:bg-subtle">
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <audio ref={audioRef} className="hidden" onEnded={() => setPlayingId(null)} />
        </section>

        <Link
          to={'/task/' + t.id}
          className="focus-ring flex items-center justify-center gap-1.5 rounded-control py-2 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          Open full view — checklist, files, comments, activity <ExternalLink size={14} />
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 xl:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[480px] flex-col border-l border-border bg-app shadow-pop xl:static xl:z-auto xl:w-[480px] xl:max-w-none xl:shadow-none">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <h2 className="text-lg font-semibold text-ink">Task Detail</h2>
          <button onClick={onClose} title="Close" className="focus-ring grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </aside>
    </>
  )
}
