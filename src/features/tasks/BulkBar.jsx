// Appears above the task table when tasks are ticked: change their due date, hand them to
// someone else, or cancel them — in one go. Each task goes through the normal API (same
// permissions and audit trail as doing it one by one); the result says what worked.
import { useEffect, useState } from 'react'
import { CalendarClock, UserCog, XCircle, X } from 'lucide-react'
import { api } from '../../data/api'
import { t as tr } from '../../i18n'

const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const tomorrow5pm = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0); return toLocalInput(d) }

export default function BulkBar({ tasks, onClear, onDone }) {
  const [mode, setMode] = useState(null) // 'due' | 'assign' | 'cancel'
  const [due, setDue] = useState(tomorrow5pm)
  const [people, setPeople] = useState([])
  const [who, setWho] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (mode === 'assign' && !people.length) api.assignableUsers().then((d) => setPeople(d.users)).catch(() => setPeople([]))
  }, [mode, people.length])

  const run = async (label, fn) => {
    setBusy(true)
    setResult(null)
    const failed = []
    for (const t of tasks) {
      try {
        await fn(t)
      } catch (e) {
        failed.push(`${t.taskNo}: ${e.message}`)
      }
    }
    setBusy(false)
    setMode(null)
    setResult({ ok: tasks.length - failed.length, failed, label })
    onDone()
  }

  const n = tasks.length
  const btn = 'focus-ring flex h-9 items-center gap-1.5 rounded-control border px-3 text-[13px] font-medium disabled:opacity-60'
  const input = 'focus-ring h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[13px] text-ink'

  return (
    <div className="mx-5 mb-3 rounded-card border border-accent-softborder bg-accent-soft/50 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[14px] font-semibold text-ink">{tr('{n} selected', { n })}</span>
        <button className={btn + ' border-border-strong bg-surface text-ink hover:bg-subtle'} disabled={busy} onClick={() => setMode(mode === 'due' ? null : 'due')}>
          <CalendarClock size={15} /> {tr("New due date")}
        </button>
        <button className={btn + ' border-border-strong bg-surface text-ink hover:bg-subtle'} disabled={busy} onClick={() => setMode(mode === 'assign' ? null : 'assign')}>
          <UserCog size={15} /> {tr("Give to someone else")}
        </button>
        <button className={btn + ' border-status-danger/30 bg-surface text-status-danger hover:bg-status-dangersoft'} disabled={busy} onClick={() => setMode(mode === 'cancel' ? null : 'cancel')}>
          <XCircle size={15} /> {tr("Cancel tasks")}
        </button>
        <button className="focus-ring ml-auto flex items-center gap-1 rounded-control px-2 py-1 text-[13px] text-ink-secondary hover:bg-surface" onClick={onClear} disabled={busy}>
          <X size={14} /> {tr("Clear selection")}
        </button>
      </div>

      {mode === 'due' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-accent-softborder pt-2.5">
          <span className="text-[13px] text-ink-secondary">{tr('New due date for {n} task(s):', { n })}</span>
          <input type="datetime-local" className={input} value={due} onChange={(e) => setDue(e.target.value)} />
          <button
            className={btn + ' border-accent bg-accent text-white hover:bg-accent-hover'}
            disabled={busy || !due}
            onClick={() => run('Due date changed for {n} task(s).', (t) => api.updateTask(t.id, { dueAt: new Date(due).toISOString() }))}
          >
            {busy ? tr('Saving…') : tr('Apply')}
          </button>
        </div>
      )}
      {mode === 'assign' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-accent-softborder pt-2.5">
          <span className="text-[13px] text-ink-secondary">{tr('Give {n} task(s) to:', { n })}</span>
          <select className={input} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{tr("Choose a person…")}</option>
            {people.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title || u.role.toLowerCase()}</option>)}
          </select>
          <button
            className={btn + ' border-accent bg-accent text-white hover:bg-accent-hover'}
            disabled={busy || !who}
            onClick={() => run('{n} task(s) handed over.', (t) => api.assignTask(t.id, { assignedUserId: who, reason: 'Bulk reassign' }))}
          >
            {busy ? tr('Saving…') : tr('Apply')}
          </button>
        </div>
      )}
      {mode === 'cancel' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-accent-softborder pt-2.5">
          <span className="text-[13px] text-ink-secondary">{tr('Cancel {n} task(s)? This can’t be undone.', { n })}</span>
          <input className={input + ' min-w-[220px] flex-1'} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Reason (optional), e.g. no longer needed")} maxLength={500} />
          <button
            className={btn + ' border-status-danger bg-status-danger text-white'}
            disabled={busy}
            onClick={() => run('{n} task(s) cancelled.', (t) => api.transition(t.id, { event: 'cancel', notes: reason.trim() || 'Cancelled in bulk' }))}
          >
            {busy ? tr('Cancelling…') : tr('Yes, cancel {n}', { n })}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-2.5 border-t border-accent-softborder pt-2.5 text-[13px]">
          {result.ok > 0 && <div className="font-medium text-[#1E7B34]">✓ {tr(result.label, { n: result.ok })}</div>}
          {result.failed.length > 0 && (
            <div className="text-status-danger">
              {tr('{n} could not be changed:', { n: result.failed.length })}
              <ul className="ml-4 list-disc">{result.failed.slice(0, 5).map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
