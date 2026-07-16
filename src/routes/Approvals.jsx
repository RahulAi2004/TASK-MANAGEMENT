// SALES / ADMIN — review designer submissions: approve or reject with feedback.
import { useState } from 'react'
import { CheckCircle2, XCircle, FileCheck } from 'lucide-react'
import AppShell from '../app/AppShell'
import { api } from '../data/api'
import { useApi, useAuth, initials } from '../auth/AuthContext'

function ApprovalCard({ t, onDone }) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const act = async (event) => {
    if (event === 'reject' && !feedback.trim()) {
      setError('Feedback is required when rejecting')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.transition(t.id, { event, notes: feedback || undefined })
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-ink">{t.title}</div>
          <div className="text-xs text-ink-tertiary">
            {t.taskNo} · {t.entityType} · {t.entityId}
          </div>
        </div>
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ background: t.assignedUser?.color }}
          title={t.assignedUser?.name}
        >
          {initials(t.assignedUser?.name || '?')}
        </span>
      </div>

      {t.completionSummary && (
        <div className="mt-3 rounded-control bg-subtle p-3 text-sm text-ink-secondary">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <FileCheck size={13} className="text-status-success" /> Completion summary
          </span>
          {t.completionSummary}
        </div>
      )}

      <div className="mt-3 text-xs text-ink-tertiary">
        Submitted {t.submittedAt ? new Date(t.submittedAt).toLocaleString() : ''} by {t.assignedUser?.name}
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback for the designer (required on reject)…"
        className="focus-ring mt-3 h-16 w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-sm placeholder:text-ink-tertiary"
      />
      {error && <div className="mt-2 text-xs text-status-danger">{error}</div>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => act('reject')}
          disabled={busy}
          className="focus-ring flex items-center justify-center gap-2 rounded-control border border-status-danger/40 bg-status-dangersoft px-3 py-2.5 text-sm font-semibold text-status-danger disabled:opacity-50"
        >
          <XCircle size={15} /> Reject
        </button>
        <button
          onClick={() => act('approve')}
          disabled={busy}
          className="focus-ring flex items-center justify-center gap-2 rounded-control bg-status-success px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <CheckCircle2 size={15} /> Approve
        </button>
      </div>
    </div>
  )
}

export default function Approvals() {
  const { user } = useAuth()
  const scope = user.role === 'ADMIN' ? 'all' : 'delegated'
  const { data, loading, reload } = useApi(() => api.tasks({ scope, status: 'Submitted' }), [])

  return (
    <AppShell title="Approvals" subtitle="Submissions waiting for your review" onTasksChanged={reload}>
      {loading ? (
        <div className="py-16 text-center text-sm text-ink-tertiary">Loading…</div>
      ) : data?.tasks?.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.tasks.map((t) => (
            <ApprovalCard key={t.id} t={t} onDone={reload} />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-card border border-dashed border-border-strong bg-surface py-24 text-center shadow-card">
          <CheckCircle2 size={32} className="text-status-success" />
          <div className="mt-3 text-lg font-semibold text-ink">All caught up</div>
          <div className="text-sm text-ink-secondary">No submissions waiting for review.</div>
        </div>
      )}
    </AppShell>
  )
}
