// Checklist · Comments · Files · Activity inside the Task Detail panel, so working on a task
// never means leaving the list. Same API calls and permissions as the full task page.
import { useRef, useState } from 'react'
import { Check, Send, Upload, Download, Trash2 } from 'lucide-react'
import VoiceRecorder from '../../components/VoiceRecorder'
import { api } from '../../data/api'
import { initials } from '../../auth/AuthContext'
import { fmtDate, fmtTime } from './taskMeta'
import { t as tr } from '../../i18n'

const MAX_FILE = 25 * 1024 * 1024
const fmtSize = (b) => (b == null ? '' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const readAsDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
// Activity types in plain words
const ACTIVITY = {
  Created: 'Created the task', Assigned: 'Assigned it', Reassigned: 'Gave it to someone else', Accepted: 'Accepted it',
  Started: 'Started', Paused: 'Paused', Resumed: 'Resumed', Submitted: 'Sent it for review', Approved: 'Approved it',
  Rejected: 'Sent it back', Reopened: 'Reopened it', Cancelled: 'Cancelled it', Waiting: 'Blocked by another task',
  Activated: 'Unblocked', FileAdded: 'Added a file', FileRemoved: 'Removed a file', RecordingAdded: 'Added a recording',
  RecordingRemoved: 'Removed a recording', DelayReported: 'Gave a reason for the delay', StatusNote: 'Posted an update',
  Edited: 'Changed the details', Deleted: 'Deleted it', AiRun: 'Ran the AI check',
}

function Avatar({ u }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: u?.color || '#5B6474' }}>
      {initials(u?.name || '?')}
    </span>
  )
}

export default function TaskTabs({ t, user, onChanged, onError }) {
  const [tab, setTab] = useState('checklist')
  const [comment, setComment] = useState('')
  const [voice, setVoice] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const canTick = t.assignedUser?.id === user.id || user.role === 'ADMIN'
  const done = t.checklist.filter((c) => c.isCompleted).length
  const comments = t.comments || []
  const files = t.files || []
  const tabs = [
    ['checklist', `${tr('Checklist')}${t.checklist.length ? ` ${done}/${t.checklist.length}` : ''}`],
    ['comments', `${tr('Comments')}${comments.length ? ` (${comments.length})` : ''}`],
    ['files', `${tr('Files')}${files.length ? ` (${files.length})` : ''}`],
    ['activity', tr('History')],
  ]

  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const sendComment = () => {
    if (!comment.trim() && !voice) return
    run(async () => {
      await api.comment(t.id, comment.trim(), voice || undefined, (voice && transcript) || undefined)
      setComment('')
      setVoice(null)
      setTranscript(null)
    })
  }
  const upload = async (file) => {
    if (!file) return
    if (file.size > MAX_FILE) return onError(tr('Files must be under 25 MB'))
    const dataUrl = await readAsDataUrl(file)
    run(() => api.uploadFile(t.id, { fileName: file.name, fileType: file.type, dataUrl }))
  }
  const download = (f) =>
    run(async () => {
      const r = await api.getFile(t.id, f.id)
      const a = document.createElement('a')
      a.href = r.file.dataUrl
      a.download = f.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
    })
  const remove = (f) => {
    if (window.confirm(tr('Delete {name}?', { name: f.fileName }))) run(() => api.deleteFile(t.id, f.id))
  }

  return (
    <section className="rounded-card border border-border bg-surface">
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={'focus-ring -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] ' + (tab === key ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-secondary hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'checklist' && (
          <ul className="space-y-2.5">
            {t.checklist.length === 0 && <li className="text-[13px] text-ink-tertiary">{tr("No checklist for this task.")}</li>}
            {t.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <button
                  onClick={() => canTick && run(() => api.toggleChecklist(t.id, c.id, !c.isCompleted))}
                  disabled={!canTick || busy}
                  aria-label={(c.isCompleted ? tr('Untick') : tr('Tick')) + ': ' + c.item}
                  className={
                    'focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] ' +
                    (c.isCompleted ? 'border-accent bg-accent text-white' : 'border-border-strong text-transparent hover:text-border-strong') +
                    (canTick ? ' cursor-pointer' : ' cursor-default opacity-70')
                  }
                >
                  <Check size={13} strokeWidth={3} />
                </button>
                <span className={'text-[14px] ' + (c.isCompleted ? 'text-ink-tertiary line-through' : 'text-ink')}>{c.item}</span>
                {c.isRequired && !c.isCompleted && (
                  <span className="rounded-chip bg-status-warningsoft px-1.5 py-0.5 text-[10px] font-semibold text-[#8A6D00]">{tr("must do")}</span>
                )}
              </li>
            ))}
            {t.checklist.some((c) => c.isRequired && !c.isCompleted) && (
              <li className="pt-1 text-[12px] text-ink-tertiary">{tr("Items marked “must do” have to be ticked before the task can be sent for review.")}</li>
            )}
          </ul>
        )}

        {tab === 'comments' && (
          <div className="space-y-3">
            {comments.length === 0 && <p className="text-[13px] text-ink-tertiary">{tr("No comments yet. Ask a question or leave a note for the team.")}</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar u={c.commentedBy} />
                <div className="min-w-0">
                  <div className="text-[12px] text-ink-tertiary">
                    <span className="font-semibold text-ink">{c.commentedBy?.name}</span> · {fmtDate(c.createdAt)} {fmtTime(c.createdAt)}
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] text-ink">{c.commentText}</p>
                  {c.audioData && <audio controls src={c.audioData} className="mt-1 h-9 max-w-[260px]" />}
                  {c.audioTranscript && <p className="mt-0.5 text-[12px] italic text-ink-secondary">“{c.audioTranscript}”</p>}
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2 pt-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                rows={1}
                placeholder={tr("Write a comment…")}
                className="focus-ring min-h-[38px] flex-1 resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-[14px] placeholder:text-ink-tertiary"
              />
              <VoiceRecorder compact value={voice} onChange={(a, tr) => { setVoice(a); setTranscript(tr) }} />
              <button
                onClick={sendComment}
                disabled={busy || (!comment.trim() && !voice)}
                aria-label={tr("Send comment")}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f) }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                <Upload size={14} /> {busy ? tr('Uploading…') : tr('Attach a file')}
              </button>
              <span className="text-[12px] text-ink-tertiary">{tr("Images, PDFs and design files up to 25 MB")}</span>
            </div>
            {files.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">{tr("No files yet.")}</p>
            ) : (
              <ul className="divide-y divide-border rounded-control border border-border">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{f.fileName}</span>
                    <span className="shrink-0 text-ink-tertiary">{fmtSize(f.sizeBytes)}</span>
                    <button onClick={() => download(f)} title={tr("Download")} className="focus-ring grid h-8 w-8 place-items-center rounded-control text-accent hover:bg-accent-soft"><Download size={15} /></button>
                    <button onClick={() => remove(f)} title={tr("Delete")} className="focus-ring grid h-8 w-8 place-items-center rounded-control text-ink-tertiary hover:bg-subtle hover:text-status-danger"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <ul className="space-y-3">
            {(t.activity || []).map((a) => (
              <li key={a.id} className="flex gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 text-[13px]">
                  <span className="font-medium text-ink">{a.performedBy?.name || tr('System')}</span>{' '}
                  <span className="text-ink-secondary">{tr(ACTIVITY[a.activityType] || a.activityType)}</span>
                  {a.notes && <div className="text-[12px] text-ink-tertiary">{a.notes}</div>}
                  <div className="text-[11px] text-ink-tertiary">{fmtDate(a.createdAt)} {fmtTime(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
