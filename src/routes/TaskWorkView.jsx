// Shared working view — used by all roles; actions shown per state machine + role.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Play, Pause, Upload, CheckCircle2, XCircle, RotateCcw, Check, Send, Bot, Mic, BellRing,
} from 'lucide-react'
import AppShell from '../app/AppShell'
import VoiceRecorder from '../components/VoiceRecorder'
import StatusBadge from '../features/tasks/StatusBadge'
import PriorityFlag from '../features/tasks/PriorityFlag'
import { api } from '../data/api'
import { useApi, useAuth, initials } from '../auth/AuthContext'

function useElapsed(startedAt, running) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  if (!startedAt) return null
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

const TABS = ['Details', 'Checklist', 'Comments', 'Activity']

export default function TaskWorkView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(() => api.task(id), [id])
  const [tab, setTab] = useState('Details')
  const [comment, setComment] = useState('')
  const [voiceNote, setVoiceNote] = useState(null)
  const [voiceTranscript, setVoiceTranscript] = useState(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [actErr, setActErr] = useState(null)
  const [reminded, setReminded] = useState(false)

  const sendReminder = async () => {
    setActErr(null)
    try {
      await api.remind(id)
      setReminded(true)
    } catch (e) {
      setActErr(e.message)
    }
  }

  const t = data?.task
  const elapsed = useElapsed(t?.startedAt, t?.status === 'In Progress')

  const isAssignee = t && t.assignedUser?.id === user.id
  const isReviewer = t && (t.createdBy?.id === user.id || user.role === 'ADMIN')

  const doTransition = async (event, extra = {}) => {
    setActErr(null)
    try {
      await api.transition(t.id, { event, ...extra })
      setSubmitOpen(false)
      reload()
    } catch (e) {
      setActErr(e.message)
    }
  }

  const toggleItem = async (item) => {
    try {
      await api.toggleChecklist(t.id, item.id, !item.isCompleted)
      reload()
    } catch (e) {
      setActErr(e.message)
    }
  }

  const addComment = async () => {
    if (!comment.trim() && !voiceNote) return
    await api.comment(t.id, comment, voiceNote || undefined, (voiceNote && voiceTranscript) || undefined)
    setComment('')
    setVoiceNote(null)
    setVoiceTranscript(null)
    reload()
  }

  if (loading) {
    return (
      <AppShell title="Task" subtitle="Loading…">
        <div className="py-16 text-center text-sm text-ink-tertiary">Loading…</div>
      </AppShell>
    )
  }
  if (error || !t) {
    return (
      <AppShell title="Task" subtitle="Not found">
        <div className="py-16 text-center text-sm text-status-danger">{error || 'Task not found'}</div>
      </AppShell>
    )
  }

  const requiredLeft = t.checklist.filter((c) => c.isRequired && !c.isCompleted).length

  return (
    <AppShell title={t.title} subtitle={`${t.taskNo} · ${t.entityType} · ${t.entityId}`} onTasksChanged={reload}>
      <button
        onClick={() => navigate(-1)}
        className="focus-ring mb-4 flex items-center gap-1.5 text-sm text-ink-secondary hover:text-accent"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header card */}
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={t.status} />
          <PriorityFlag priority={t.priority} />
          {t.dueAt && (
            <span className="text-sm text-ink-secondary">
              Due {new Date(t.dueAt).toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: t.assignedUser?.color }}
            >
              {initials(t.assignedUser?.name || '?')}
            </span>
            {t.assignedUser?.name}
          </span>
          {/* Delegation trail */}
          <span className="flex items-center gap-1 text-xs text-ink-tertiary">
            {t.history.map((h, i) => (
              <span key={h.id} className="flex items-center gap-1">
                {i > 0 && '→'}
                <span
                  className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                  style={{ background: h.assignedUser?.color || '#605E5C' }}
                  title={h.assignedUser?.name}
                >
                  {initials(h.assignedUser?.name || '?')}
                </span>
              </span>
            ))}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {elapsed && t.status === 'In Progress' && (
              <span className="mr-1 font-mono text-sm font-semibold text-status-success">{elapsed}</span>
            )}
            {isAssignee && ['Assigned', 'Accepted', 'Reopened'].includes(t.status) && (
              <button onClick={() => doTransition('start')} className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                <Play size={14} /> Start Task
              </button>
            )}
            {isAssignee && t.status === 'In Progress' && (
              <>
                <button onClick={() => doTransition('pause')} className="focus-ring flex items-center gap-1.5 rounded-control bg-status-warningsoft px-4 py-2 text-sm font-semibold text-[#8A6D00]">
                  <Pause size={14} /> Pause
                </button>
                <button onClick={() => setSubmitOpen(true)} className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
                  <Upload size={14} /> Submit
                </button>
              </>
            )}
            {isAssignee && t.status === 'On Hold' && (
              <button onClick={() => doTransition('resume')} className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white">
                <Play size={14} /> Resume
              </button>
            )}
            {isReviewer && t.status === 'Submitted' && (
              <>
                <button onClick={() => doTransition('reject', { notes: 'Rejected from working view' })} className="focus-ring flex items-center gap-1.5 rounded-control bg-status-dangersoft px-4 py-2 text-sm font-semibold text-status-danger">
                  <XCircle size={14} /> Reject
                </button>
                <button onClick={() => doTransition('approve')} className="focus-ring flex items-center gap-1.5 rounded-control bg-status-success px-4 py-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={14} /> Approve
                </button>
              </>
            )}
            {isReviewer && t.status === 'Rejected' && (
              <button onClick={() => doTransition('reopen')} className="focus-ring flex items-center gap-1.5 rounded-control border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-secondary">
                <RotateCcw size={14} /> Reopen
              </button>
            )}
            {isReviewer &&
              !isAssignee &&
              t.assignedUser &&
              t.dueAt &&
              new Date(t.dueAt) < new Date() &&
              !['Completed', 'Cancelled', 'Submitted'].includes(t.status) && (
                <button
                  onClick={sendReminder}
                  disabled={reminded}
                  className="focus-ring flex items-center gap-1.5 rounded-control border border-status-danger/40 bg-status-dangersoft px-4 py-2 text-sm font-semibold text-status-danger disabled:opacity-60"
                >
                  <BellRing size={14} /> {reminded ? 'Reminder Sent' : 'Send Reminder'}
                </button>
              )}
          </div>
        </div>
        {actErr && <div className="mt-3 rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{actErr}</div>}
      </div>

      {/* Tabs */}
      <div className="mt-6 rounded-card border border-border bg-surface shadow-card">
        <div className="flex gap-5 border-b border-border px-5">
          {TABS.map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              className={
                'relative py-3 text-sm ' +
                (tab === x
                  ? 'font-semibold text-accent after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent'
                  : 'text-ink-secondary hover:text-ink')
              }
            >
              {x}
              {x === 'Checklist' && t.checklist.length > 0 && (
                <span className="ml-1 text-xs text-ink-tertiary">
                  ({t.checklist.filter((c) => c.isCompleted).length}/{t.checklist.length})
                </span>
              )}
              {x === 'Comments' && t.comments.length > 0 && (
                <span className="ml-1 text-xs text-ink-tertiary">({t.comments.length})</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'Details' && (
            <div className="space-y-4">
              {t.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{t.description}</p>
              ) : (
                <p className="text-sm text-ink-tertiary">No written instructions.</p>
              )}
              {(t.voiceNote || t.voiceNotes?.length > 0) && (
                <div className="rounded-control bg-subtle p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <Mic size={13} className="text-accent" /> Voice instruction
                    {(t.voiceNotes?.length || 0) + (t.voiceNote ? 1 : 0) > 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2.5">
                    {/* Legacy single-note field (older tasks) */}
                    {t.voiceNote && (
                      <div>
                        <audio controls src={t.voiceNote} className="h-9 w-full max-w-xs" />
                        {t.voiceTranscript && (
                          <p className="mt-1 text-xs italic leading-relaxed text-ink-secondary">
                            "{t.voiceTranscript}"
                          </p>
                        )}
                      </div>
                    )}
                    {(t.voiceNotes || []).map((n) => (
                      <div key={n.id}>
                        <audio controls src={n.audioData} className="h-9 w-full max-w-xs" />
                        {n.transcript && (
                          <p className="mt-1 text-xs italic leading-relaxed text-ink-secondary">
                            "{n.transcript}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {t.affectedSystem && (
                <div className="text-sm text-ink-secondary">
                  <span className="font-semibold text-ink">Affected system:</span> {t.affectedSystem}
                </div>
              )}
              {t.completionSummary && (
                <div className="rounded-control bg-subtle p-3 text-sm text-ink-secondary">
                  <div className="mb-1 text-xs font-semibold text-ink">Completion summary</div>
                  {t.completionSummary}
                </div>
              )}
              {t.aiRuns.length > 0 && (
                <div className="rounded-control border border-accent-softborder bg-accent-soft p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <Bot size={13} /> AI First Attempt — {t.aiRuns[0].agentType}
                  </div>
                  <div className="text-sm text-ink-secondary">{t.aiRuns[0].resultSummary}</div>
                  <div className="mt-1 text-[11px] text-ink-tertiary">
                    confidence {Math.round((t.aiRuns[0].confidenceScore || 0) * 100)}% · quality{' '}
                    {Math.round((t.aiRuns[0].qualityScore || 0) * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Checklist' && (
            <ul className="space-y-2.5">
              {t.checklist.length === 0 && <li className="text-sm text-ink-tertiary">No checklist items.</li>}
              {t.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <button
                    onClick={() => isAssignee && toggleItem(c)}
                    disabled={!isAssignee}
                    className={
                      'focus-ring grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ' +
                      (c.isCompleted
                        ? 'border-accent bg-accent text-white'
                        : 'border-border-strong text-transparent hover:text-border-strong') +
                      (isAssignee ? ' cursor-pointer' : ' cursor-default opacity-70')
                    }
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <span className={'text-sm ' + (c.isCompleted ? 'text-ink-tertiary line-through' : 'text-ink')}>
                    {c.item}
                  </span>
                  {c.isRequired && !c.isCompleted && (
                    <span className="rounded-chip bg-status-warningsoft px-1.5 py-0.5 text-[10px] font-semibold text-[#8A6D00]">
                      required
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab === 'Comments' && (
            <div className="space-y-4">
              {t.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ background: c.commentedBy?.color }}
                  >
                    {initials(c.commentedBy?.name || '?')}
                  </span>
                  <div>
                    <div className="text-xs text-ink-tertiary">
                      <span className="font-semibold text-ink">{c.commentedBy?.name}</span> ·{' '}
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                    <p className="mt-0.5 text-sm text-ink">{c.commentText}</p>
                    {c.audioData && (
                      <>
                        <audio controls src={c.audioData} className="mt-1.5 h-9 max-w-[280px]" />
                        {c.audioTranscript && (
                          <p className="mt-1 text-xs italic leading-relaxed text-ink-secondary">
                            "{c.audioTranscript}"
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Write a comment…"
                  className="focus-ring flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-tertiary"
                />
                <VoiceRecorder
                  compact
                  value={voiceNote}
                  onChange={(audio, transcript) => {
                    setVoiceNote(audio)
                    setVoiceTranscript(transcript)
                  }}
                />
                <button onClick={addComment} className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent text-white hover:bg-accent-hover">
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {tab === 'Activity' && (
            <ul className="space-y-3">
              {t.activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <span className="font-medium text-ink">{a.activityType}</span>
                    {a.oldStatus && (
                      <span className="text-ink-secondary"> — {a.oldStatus} → {a.newStatus}</span>
                    )}
                    <div className="text-xs text-ink-tertiary">
                      {a.performedBy?.name} · {new Date(a.createdAt).toLocaleString()}
                      {a.notes ? ` · ${a.notes}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Submit modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-6">
          <div className="w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-pop">
            <h3 className="text-lg font-semibold text-ink">Submit Task</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              Sends the work to {t.createdBy?.name} for review.
            </p>
            {requiredLeft > 0 && (
              <div className="mt-3 rounded-control bg-status-warningsoft px-3 py-2 text-sm text-[#8A6D00]">
                {requiredLeft} required checklist item{requiredLeft > 1 ? 's' : ''} still open — complete them first.
              </div>
            )}
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Completion summary — what was done…"
              className="focus-ring mt-4 h-24 w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-tertiary"
            />
            {actErr && <div className="mt-2 text-sm text-status-danger">{actErr}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSubmitOpen(false)} className="focus-ring rounded-control border border-border-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle">
                Cancel
              </button>
              <button
                onClick={() => doTransition('submit', { completionSummary: summary || undefined })}
                className="focus-ring flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <Upload size={14} /> Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
