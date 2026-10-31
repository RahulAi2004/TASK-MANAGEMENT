// "Dropdown options" tab of Task Settings: add, hide and bring back the options people pick from.
// Hiding only takes an option out of the dropdowns; tasks that already use it keep it.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, EyeOff, Lock, Plus } from 'lucide-react'
import { useOptions, optionLabel } from '../../data/useOptions'
import { t as tr } from '../../i18n'

const LISTS = [
  { list: 'workType', title: 'Type of work', hint: 'New Task and Task Templates' },
  { list: 'category', title: 'Category', hint: 'New Task and the Category filter' },
  { list: 'linkedTo', title: 'Linked to', hint: 'New Task and Task Templates' },
  { list: 'delayReason', title: 'Reason for delay', hint: '“Why is this late?” on a task' },
]
// Lists that already have their own screens
const OTHER_LISTS = [
  { to: '/departments', label: 'Departments' },
  { to: '/users', label: 'Users' },
  { to: '/templates', label: 'Task Templates' },
]

function OptionList({ list, title, hint }) {
  const { all, add, setActive } = useOptions()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rows = all.filter((o) => o.list === list)

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const submit = async (e) => {
    e.preventDefault()
    if (text.trim() && (await run(() => add(list, text.trim())))) setText('')
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-card">
      <h3 className="text-[16px] font-semibold text-ink">{tr(title)}</h3>
      <p className="mb-3 text-[12px] text-ink-secondary">{tr(hint)}</p>
      <ul className="divide-y divide-border rounded-control border border-border">
        {rows.map((o) => (
          <li key={o.id} className="flex min-h-10 items-center justify-between gap-2 px-3 py-1.5 text-[14px]">
            <span className={'min-w-0 truncate ' + (o.isActive ? 'text-ink' : 'text-ink-tertiary line-through')}>{optionLabel(list, o.value)}</span>
            {o.locked ? (
              <span title={tr('The app needs this one, so it stays')} className="flex shrink-0 items-center gap-1 text-[12px] text-ink-tertiary"><Lock size={13} /> {tr('Always on')}</span>
            ) : (
              <button
                onClick={() => run(() => setActive(o.id, !o.isActive))}
                disabled={busy}
                className="focus-ring flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
              >
                {o.isActive ? <><EyeOff size={14} /> {tr('Hide')}</> : <><Eye size={14} /> {tr('Bring back')}</>}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          placeholder={tr('Add a new option…')}
          className="focus-ring h-10 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-tertiary"
        />
        <button disabled={busy || !text.trim()} className="focus-ring flex h-10 shrink-0 items-center gap-1.5 rounded-control bg-accent px-3 text-[14px] font-semibold text-white disabled:opacity-50">
          <Plus size={16} /> {tr('Add')}
        </button>
      </form>
      {error && <p className="mt-1.5 text-[12px] text-status-danger">{error}</p>}
    </section>
  )
}

export default function OptionsManager({ onClose }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-secondary">{tr('Hiding an option only takes it out of the dropdowns. Tasks that already use it keep it.')}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {LISTS.map((l) => <OptionList key={l.list} {...l} />)}
      </div>
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">{tr('Other lists you can edit')}</h3>
        <div className="flex flex-wrap gap-2">
          {OTHER_LISTS.map((l) => (
            <button
              key={l.to}
              onClick={() => { onClose(); navigate(l.to) }}
              className="focus-ring flex items-center gap-1 rounded-control border border-border-strong px-3 py-2 text-[14px] text-ink hover:bg-subtle"
            >
              {tr(l.label)} <ChevronRight size={15} className="text-ink-tertiary" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
