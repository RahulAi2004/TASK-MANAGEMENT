// Task Detail — right-docked panel on the Task Management page (overlay below xl widths).
// Header + status actions · SLA / elapsed / normal time · task information · description ·
// current status · reason for delay · recordings. Checklist/files/comments/activity live in
// the full working view (/task/:id), linked at the bottom.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  X, AlertCircle, Clock, CheckCircle2, Mic, Paperclip, Play, Pause,
  MoreHorizontal, Pencil, ExternalLink, Download, Trash2,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityFlag from './PriorityFlag'
import VoiceRecorder from '../../components/VoiceRecorder'
import { CategoryChip } from './chips'
import TaskTabs from './TaskTabs'
import useNow from './useNow'
import {
  taskMeta, taskCategory, elapsedMs, slaStatus, SLA_STYLE, fmtDuration, fmtMinutes, fmtDate,
  fmtTime, fmtClock, allowedEvents, statusSentence, DELAY_REASONS,
} from './taskMeta'
import { api } from '../../data/api'
import { useApi, useAuth, initials } from '../../auth/AuthContext'
import { t as tr } from '../../i18n'

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
    <div className="grid min-h-[34px] grid-cols-[78px_1fr] items-center gap-2 py-1">
      <span className="text-[13px] text-ink-secondary">{tr(label)}</span>
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

  // ── Task group (same permission as the server: admin or creator, while the task is open) ──
  const groups = useApi(() => api.groups(), [])
  const canMoveGroup = t && (user.role === 'ADMIN' || t.createdBy?.id === user.id) && !['Completed', 'Cancelled'].includes(t.status)
  const moveToGroup = (groupId) => run(() => api.updateTask(t.id, { groupId }))

  // ── Status actions ────────────────────────────────────────────────────────
  const [pending, setPending] = useState(null) // { event, label } needing a note (submit / reject)
  const [pendingText, setPendingText] = useState('')
  const fire = async (x) => {
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
    a.play().then(() => setPlayingId(n.id)).catch(() => setErr(tr('This recording could not be played')))
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
    body = <div className="py-16 text-center text-sm text-ink-tertiary">{tr("Loading…")}</div>
  } else if (error || !t) {
    body = <div className="py-16 text-center text-sm text-status-danger">{error || 'Task not found'}</div>
  } else {
    const meta = taskMeta(t)
    const sla = slaStatus(t, now)
    const slaStyle = sla ? SLA_STYLE[sla] : null
    const SlaIcon = sla ? SLA_ICON[sla] : null
    const events = allowedEvents(t, user)
    // Only ask for a reason once a task is actually late (or one was already given).
    const showDelay = sla === 'Delayed' || meta.delay
    const isOpen = !['Completed', 'Cancelled'].includes(t.status)
    const recordings = [
      ...(t.voiceNote
        ? [{ id: 'legacy', fileName: tr('Voice instruction'), audioData: t.voiceNote, transcript: t.voiceTranscript, createdAt: t.createdAt, legacy: true }]
        : []),
      ...(t.voiceNotes || []),
    ]
    const canDeleteRec = (n) =>
      !n.legacy && (user.role === 'ADMIN' || t.createdBy?.id === user.id || n.recordedBy?.id === user.id)

    body = (
      <div className="space-y-3 p-4">
        {/* Title + status */}
        <div className="px-1">
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink-tertiary">
              {t.taskNo}
              {t.taskType && t.taskType !== 'General' ? ' · ' + t.taskType : ''}
            </div>
            <h2 className="mt-0.5 text-xl font-semibold leading-snug text-ink">{t.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={t.status} />
              <span className="text-[13px] text-ink-secondary">{statusSentence(t, user)}</span>
            </div>
          </div>

          {/* Next step: the action that moves the task forward is a big button, the rest sit beside it. */}
          {events.length > 0 && !pending && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {events.filter((x) => x.primary).map((x) => (
                <button
                  key={x.event}
                  onClick={() => fire(x)}
                  disabled={busy}
                  className="focus-ring flex h-10 items-center gap-1.5 rounded-control bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                >
                  {x.event === 'start' || x.event === 'resume' ? <Play size={15} fill="currentColor" /> : null}
                  {x.label}
                </button>
              ))}
              {events.filter((x) => !x.primary && x.event !== 'cancel').map((x) => (
                <button
                  key={x.event}
                  onClick={() => fire(x)}
                  disabled={busy}
                  className={
                    'focus-ring h-10 rounded-control border px-3.5 text-[13px] font-medium disabled:opacity-60 ' +
                    (x.danger ? 'border-status-danger/30 text-status-danger hover:bg-status-dangersoft' : 'border-border-strong text-ink-secondary hover:bg-subtle')
                  }
                >
                  {x.label}
                </button>
              ))}
              {/* Cancelling is rare and final — a quiet link, not a button next to the main action. */}
              {events.some((x) => x.event === 'cancel') && (
                <button
                  onClick={() => fire(events.find((x) => x.event === 'cancel'))}
                  disabled={busy}
                  className="focus-ring ml-auto rounded-control px-2 py-1 text-[12px] text-ink-tertiary underline-offset-2 hover:text-status-danger hover:underline disabled:opacity-60"
                >
                  {tr("Cancel task")}
                </button>
              )}
            </div>
          )}

          {pending && (
            <div className="mt-3 rounded-card border border-accent-softborder bg-accent-soft/50 p-3">
              <div className="mb-1.5 text-[13px] font-semibold text-ink">
                {pending.event === 'submit' ? tr('Send for review') : tr('Send back for changes')}
              </div>
              <textarea
                autoFocus
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                maxLength={2000}
                placeholder={pending.event === 'submit' ? tr('What did you do? (optional)') : tr('What needs to change? (optional)')}
                className={inputCls + ' h-20 resize-none'}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setPending(null)} className="focus-ring rounded-control px-3 py-1.5 text-sm text-ink-secondary hover:bg-subtle">
                  {tr("Cancel")}
                </button>
                <button
                  onClick={confirmPending}
                  disabled={busy}
                  className={
                    'focus-ring rounded-control px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ' +
                    (pending.event === 'reject' ? 'bg-status-danger' : 'bg-accent hover:bg-accent-hover')
                  }
                >
                  {pending.event === 'submit' ? tr('Send') : tr('Send back')}
                </button>
              </div>
            </div>
          )}
        </div>

        {err && <div className="rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{err}</div>}

        {isOpen && (sla === 'Delayed' || sla === 'Critical') && (
          <div
            className="flex items-start gap-3 rounded-card border px-3.5 py-3 md:hidden"
            style={sla === 'Delayed' ? { background: '#FDECEE', borderColor: '#F6C6CB', color: '#D13438' } : { background: '#FFF4E5', borderColor: '#FBD9AE', color: '#C25E00' }}
          >
            <AlertCircle size={22} className="mt-0.5 shrink-0" />
            <div className="text-[13px] leading-snug">
              <div className="text-[15px] font-semibold">{tr(slaStyle.label)}</div>
              {meta.delay
                ? <>{tr('Reason recorded:')} {tr(meta.delay.reason)}</>
                : sla === 'Delayed' ? tr('Task is delayed. Please provide a reason.') : tr('This task is close to its time limit.')}
            </div>
          </div>
        )}

        {/* SLA · elapsed · normal */}
        <div className="grid grid-cols-3 divide-x divide-border rounded-card border border-border bg-surface py-3 text-center">
          <div className="px-2">
            {sla ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[15px] font-semibold"
                style={{ background: slaStyle.bg, color: slaStyle.fg }}
                title={slaStyle.hint}
              >
                <SlaIcon size={17} /> {tr(slaStyle.label)}
              </span>
            ) : (
              <span className="text-[15px] font-semibold text-ink-tertiary">—</span>
            )}
            <div className="mt-1 text-xs text-ink-secondary">{tr("On time?")}</div>
          </div>
          <div className="px-2">
            <div className="text-[19px] font-semibold text-ink">{t.startedAt ? fmtDuration(elapsedMs(t, now)) : '—'}</div>
            <div className="mt-0.5 text-xs text-ink-secondary">{t.startedAt ? tr('Time spent') : tr('Not started yet')}</div>
          </div>
          <div className="px-2">
            <div className="text-[19px] font-semibold text-ink">{fmtMinutes(t.estimatedMinutes)}</div>
            <div className="mt-0.5 text-xs text-ink-secondary">{tr("Target time")}</div>
          </div>
        </div>

        {/* Description · current status · delay */}
        <section className={card + ' space-y-4'}>
          <div>
            <h3 className="mb-1.5 text-[15px] font-semibold text-ink">{tr("What to do")}</h3>
            <p className="whitespace-pre-wrap rounded-control bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink-secondary">
              {t.description || tr('No instructions were added.')}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink">{tr("Latest update")}</h3>
              {!editingStatus && isOpen && (
                <button
                  onClick={() => { setStatusText(meta.currentStatus || ''); setEditingStatus(true) }}
                  className="focus-ring flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  <Pencil size={12} /> {meta.currentStatus ? tr('Update') : tr('Add')}
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
                  placeholder={tr("Where does this task stand right now? Anything blocking it?")}
                  className={inputCls + ' h-20 resize-none'}
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <button onClick={() => setEditingStatus(false)} className="focus-ring rounded-control px-3 py-1.5 text-sm text-ink-secondary hover:bg-subtle">{tr("Cancel")}</button>
                  <button onClick={saveStatus} disabled={busy} className="focus-ring rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">{tr("Save")}</button>
                </div>
              </div>
            ) : (
              <p className="rounded-control bg-subtle px-3 py-2.5 text-[13px] text-ink-secondary">
                {meta.currentStatus || <span className="text-ink-tertiary">{tr("No update yet.")}</span>}
              </p>
            )}
          </div>

          {showDelay && (
            <div>
              {meta.delay && (
                <div className="mb-2.5 rounded-control border border-status-danger/20 bg-status-dangersoft/60 px-3 py-2 text-[13px]">
                  <span className="font-semibold text-status-danger">{tr(meta.delay.reason)}</span>
                  <span className="text-ink-secondary"> — {meta.delay.remarks}</span>
                  <div className="mt-0.5 text-[11px] text-ink-tertiary">
                    {tr('Reported by {name}', { name: meta.delay.byName || tr('team') })} · {fmtDate(meta.delay.at)} {fmtTime(meta.delay.at)}
                  </div>
                </div>
              )}
              {isOpen && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <h3 className="text-[15px] font-semibold text-ink sm:col-span-2">{tr("Why is this late?")}</h3>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                      {tr("Reason")}
                    </span>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                      <option value="">{tr("Select a reason")}</option>
                      {DELAY_REASONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                      {tr("More details")}
                    </span>
                    <div className="relative">
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        maxLength={500}
                        placeholder={tr("A sentence or two for your manager…")}
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
                      {meta.delay ? tr('Update reason') : tr('Save reason')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Task information */}
        <section className={card}>
          <h3 className="mb-1.5 text-[15px] font-semibold text-ink">{tr("Details")}</h3>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
            <div>
              <Row label="Category"><CategoryChip category={taskCategory(t)} /></Row>
              <Row label="Department">{t.department?.name || '—'}</Row>
              <Row label="Order / Ref"><span className="font-medium text-accent">{t.entityId}</span></Row>
              <Row label="Customer">{meta.customerName || '—'}</Row>
              <Row label="Priority"><PriorityFlag priority={t.priority} /></Row>
              <Row label="Task group">
                {canMoveGroup ? (
                  <select
                    value={t.groupId || ''}
                    onChange={(e) => moveToGroup(e.target.value || null)}
                    className="focus-ring h-8 w-full max-w-[150px] rounded-control border border-border-strong bg-surface px-1.5 text-[13px] text-ink"
                  >
                    <option value="">{tr('No group')}</option>
                    {(groups.data?.groups || []).map((g) => <option key={g.id} value={g.id}>{tr(g.name)}</option>)}
                  </select>
                ) : (
                  tr((groups.data?.groups || []).find((g) => g.id === t.groupId)?.name || 'No group')
                )}
              </Row>
            </div>
            <div className="sm:pl-4">
                            <Row label="Created">
                <span className="block whitespace-nowrap leading-tight">{fmtDate(t.createdAt)}</span>
                <span className="block text-xs leading-tight text-ink-secondary">{fmtTime(t.createdAt)}</span>
              </Row>
              <Row label="Due">
                {t.dueAt ? (
                  <span className={sla === 'Delayed' && isOpen ? 'font-medium text-status-danger' : ''}>
                    <span className="block whitespace-nowrap leading-tight">{fmtDate(t.dueAt)}</span>
                    <span className="block text-xs leading-tight opacity-80">{fmtTime(t.dueAt)}</span>
                  </span>
                ) : '—'}
              </Row>
            </div>
          </div>
          {/* People get a full-width row: names are often too long for half the panel. */}
          <div className="mt-2 grid grid-cols-2 gap-3 border-t border-border pt-3">
            {[['Assigned to', t.assignedUser], ['Created by', t.createdBy]].map(([label, u]) => (
              <div key={label} className="min-w-0">
                <div className="mb-1 text-[13px] text-ink-secondary">{tr(label)}</div>
                {u ? (
                  <div className="flex items-center gap-2">
                    <Avatar u={u} />
                    <span className="min-w-0 break-words text-[13px] leading-tight text-ink">{u.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-ink-tertiary">{tr("Nobody yet")}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <TaskTabs t={t} user={user} onChanged={refresh} onError={setErr} />

        {/* Recordings */}
        <section className={card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <Mic size={16} className="text-accent md:hidden" />
              <span className="md:hidden">Voice Recordings ({recordings.length})</span>
              <span className="hidden md:inline">Recordings ({recordings.length})</span>
            </h3>
            <div className="hidden gap-2 md:flex">
              <button
                onClick={() => { setDraft(null); setRecording(true) }}
                disabled={recording}
                className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Mic size={15} /> {tr("Record voice")}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="focus-ring flex items-center gap-1.5 rounded-control border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
              >
                <Paperclip size={15} /> {tr("Add recording")}
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
                  {tr("Cancel")}
                </button>
                <button onClick={saveDraft} disabled={!draft || busy} className="focus-ring rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                  {tr("Save recording")}
                </button>
              </div>
            </div>
          )}

          {recordings.length === 0 && !recording && (
            <p className="py-3 text-center text-[13px] text-ink-tertiary">{tr("No recordings yet.")}</p>
          )}
          <ul className="divide-y divide-border">
            {recordings.map((n) => (
              <li key={n.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => togglePlay(n)}
                  title={playingId === n.id ? tr('Pause') : tr('Play')}
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
                    title={tr("More")}
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
                          <Download size={14} /> {tr("Download")}
                        </a>
                        {canDeleteRec(n) && (
                          <button onClick={() => deleteRecording(n)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-danger hover:bg-subtle">
                            <Trash2 size={14} /> {tr("Delete")}
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
          {!recording && (
            <div className="mt-3 space-y-2 md:hidden">
              <button
                onClick={() => { setDraft(null); setRecording(true) }}
                className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-white"
              >
                <Mic size={19} /> {tr("Record Voice Note")}
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="focus-ring flex w-full items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium text-accent disabled:opacity-60">
                <Paperclip size={15} /> {tr("Upload an audio file")}
              </button>
            </div>
          )}
        </section>

        <Link
          to={'/task/' + t.id}
          className="focus-ring flex items-center justify-center gap-1.5 rounded-control py-2 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          Open the full page — dependencies and AI check <ExternalLink size={14} />
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 min-[1500px]:hidden" onClick={onClose} />
      {/* Phone: bottom sheet · tablet/laptop: right overlay · ≥1500px: docked beside the table */}
      <aside className="fixed inset-x-0 bottom-0 top-10 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-app shadow-pop md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:w-full md:max-w-[420px] md:rounded-none md:border-l md:border-border min-[1500px]:static min-[1500px]:z-auto min-[1500px]:w-[420px] min-[1500px]:max-w-none min-[1500px]:shadow-none">
        <div className="shrink-0 bg-surface pt-2 md:hidden"><div className="mx-auto h-1 w-10 rounded-full bg-border-strong" /></div>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <h2 className="text-lg font-semibold text-ink"><span className="md:hidden">{tr("Task Details")}</span><span className="hidden md:inline">{tr("Task Detail")}</span></h2>
          <button onClick={onClose} title={tr("Close")} className="focus-ring grid h-9 w-9 place-items-center rounded-control text-ink-secondary hover:bg-subtle">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </aside>
    </>
  )
}
