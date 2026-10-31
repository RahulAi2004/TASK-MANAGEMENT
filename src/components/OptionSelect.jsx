// A dropdown backed by an editable list. The last choice, "+ Add new…", swaps in a text box so a
// missing option can be added on the spot without leaving the form (admin and sales only).
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOptions, optionLabel } from '../data/useOptions'
import { t as tr } from '../i18n'

const ADD = '__add_new__'

export default function OptionSelect({ list, value, onChange, placeholder, className = '' }) {
  const { user } = useAuth()
  const { active, add } = useOptions()
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canAdd = user.role === 'ADMIN' || user.role === 'SALES'
  const values = active(list)
  // A template or an older task can hold a value that has since been hidden: keep showing it.
  const shown = value && !values.includes(value) ? [value, ...values] : values

  const close = () => { setAdding(false); setText(''); setError(null) }
  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const option = await add(list, text.trim())
      onChange(option.value)
      close()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <span className="block">
        <span className="flex gap-1.5">
          <input
            autoFocus
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save() }
              if (e.key === 'Escape') { e.preventDefault(); close() }
            }}
            placeholder={tr('Type the new option')}
            className={className + ' min-w-0 flex-1'}
          />
          <button type="button" onClick={save} disabled={busy || !text.trim()} aria-label={tr('Add')} title={tr('Add')} className="focus-ring grid w-10 shrink-0 place-items-center rounded-control bg-accent text-white disabled:opacity-50">
            <Check size={17} />
          </button>
          <button type="button" onClick={close} aria-label={tr('Cancel')} title={tr('Cancel')} className="focus-ring grid w-10 shrink-0 place-items-center rounded-control border border-border-strong text-ink-secondary hover:bg-subtle">
            <X size={17} />
          </button>
        </span>
        {error && <span className="mt-1 block text-[12px] text-status-danger">{error}</span>}
      </span>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}
      className={className}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {shown.map((v) => <option key={v} value={v}>{optionLabel(list, v)}</option>)}
      {canAdd && <option value={ADD}>{tr('+ Add new…')}</option>}
    </select>
  )
}
