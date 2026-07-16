// ADMIN — module settings (local toggles for the demo).
import { useState } from 'react'
import AppShell from '../app/AppShell'

const SECTIONS = [
  {
    title: 'Assignment',
    sub: 'How tasks get routed to people',
    items: [
      { key: 'autoAssign', label: 'Auto-assign recommendation', desc: 'Suggest the best assignee by skill and current workload' },
      { key: 'requireAccept', label: 'Require acceptance by default', desc: 'New tasks need the assignee to accept before the SLA clock starts' },
      { key: 'escalate', label: 'Escalate on SLA breach', desc: 'Notify the manager when a task passes its due time' },
    ],
  },
  {
    title: 'Notifications',
    sub: 'What lands in your feed and inbox',
    items: [
      { key: 'dailyDigest', label: 'Daily digest email', desc: 'A morning summary of open, due and overdue tasks' },
      { key: 'overdueAlerts', label: 'Overdue alerts', desc: 'Instant alert the moment a task becomes overdue' },
      { key: 'mentionsOnly', label: 'Mentions only', desc: 'Only notify me when I am @mentioned in a comment' },
    ],
  },
  {
    title: 'Automation & AI',
    sub: 'First-attempt agents and voice',
    items: [
      { key: 'aiDefault', label: 'AI first attempt by default', desc: 'Eligible tasks get an agent attempt before the assignee sees them' },
      { key: 'aiVoice', label: 'Transcribe voice notes', desc: 'Run speech-to-text on voice instructions and submissions' },
    ],
  },
]

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={'relative h-5 w-9 shrink-0 rounded-full transition-colors ' + (on ? 'bg-accent' : 'bg-border-strong')}
    >
      <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (on ? 'right-0.5' : 'left-0.5')} />
    </button>
  )
}

export default function Settings() {
  const [state, setState] = useState({
    autoAssign: true, requireAccept: false, escalate: true,
    dailyDigest: true, overdueAlerts: true, mentionsOnly: false,
    aiDefault: true, aiVoice: false,
  })
  const [dirty, setDirty] = useState(false)
  const toggle = (k) => { setState((s) => ({ ...s, [k]: !s[k] })); setDirty(true) }

  return (
    <AppShell title="Settings" subtitle="Module configuration">
      <div className="mx-auto max-w-3xl space-y-6">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="rounded-card border border-border bg-surface shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-[15px] font-semibold text-ink">{sec.title}</h3>
              <p className="text-xs text-ink-secondary">{sec.sub}</p>
            </div>
            <div className="divide-y divide-border">
              {sec.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <div className="text-sm font-medium text-ink">{it.label}</div>
                    <div className="text-xs text-ink-secondary">{it.desc}</div>
                  </div>
                  <Toggle on={state[it.key]} onClick={() => toggle(it.key)} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDirty(false)}
            disabled={!dirty}
            className="focus-ring rounded-control border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            onClick={() => setDirty(false)}
            disabled={!dirty}
            className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Save settings
          </button>
        </div>
      </div>
    </AppShell>
  )
}
