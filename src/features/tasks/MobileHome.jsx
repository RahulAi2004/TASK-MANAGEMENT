// Phone home of Task Management: Smart Lists and Task Groups with live counts. Opening a row shows
// the normal phone task list (MobileTaskList) narrowed to it.
import { useState } from 'react'
import { ChevronRight, List, Plus, PlusCircle, Users2 } from 'lucide-react'
import { Sheet } from './MobileTaskList'
import { SMART_LISTS, GROUP_COLORS, inSmartList, isOpenTask } from './smartLists'
import { api } from '../../data/api'
import { t as tr } from '../../i18n'

const heading = 'text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-secondary'
const rowCls = 'focus-ring flex w-full items-center gap-3 px-4 py-3.5 text-left'

function Count({ n, on }) {
  return (
    <span className={'grid h-7 min-w-10 place-items-center rounded-full px-2 text-[14px] font-semibold ' + (on ? 'bg-accent text-white' : 'bg-subtle text-ink-secondary')}>
      {n}
    </span>
  )
}

function CreateGroupSheet({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { group } = await api.createGroup({ name: name.trim(), color })
      onCreated(group)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Sheet title={tr('Create task group')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">{tr('Group name')}</span>
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('e.g. Printing')}
            className="focus-ring h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-tertiary"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">{tr('Colour')}</span>
          <div className="flex flex-wrap gap-2.5">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={'focus-ring h-9 w-9 rounded-full ' + (color === c ? 'ring-2 ring-ink ring-offset-2' : '')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-[13px] text-status-danger">{error}</p>}
        <button disabled={busy || !name.trim()} className="focus-ring h-12 w-full rounded-card bg-accent text-[16px] font-semibold text-white disabled:opacity-50">
          {busy ? tr('Creating…') : tr('Create task group')}
        </button>
      </form>
    </Sheet>
  )
}

export default function MobileHome({ tasks, groups, user, lastGroupId, onOpenList, onOpenGroup, onAllTasks, onGroupCreated, loading, error }) {
  const [creating, setCreating] = useState(false)
  const canCreate = user.role === 'ADMIN' || user.role === 'SALES'
  // Tasks are still on their way: show a dash, not a false "0"
  const show = (n) => (loading && tasks.length === 0 ? '–' : n)

  return (
    <div className="space-y-6 md:hidden">
      {error && <div className="rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{error}</div>}
      <section>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className={heading}>{tr('Smart lists')}</h2>
          <button onClick={onAllTasks} className="focus-ring rounded-control text-[14px] font-medium text-accent">{tr('All tasks')}</button>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-card">
          {SMART_LISTS.map((l) => (
            <li key={l.key}>
              <button onClick={() => onOpenList(l.key)} className={rowCls}>
                <l.icon size={26} style={{ color: l.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[17px] text-ink">{tr(l.label)}</span>
                <Count n={show(tasks.filter((t) => inSmartList(l, t, user)).length)} />
                <ChevronRight size={18} className="shrink-0 text-ink-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className={heading}>{tr('Task groups')}</h2>
          {canCreate && (
            <button onClick={() => setCreating(true)} className="focus-ring flex items-center gap-1.5 rounded-control text-[14px] font-medium text-accent">
              <PlusCircle size={22} /> {tr('New group')}
            </button>
          )}
        </div>
        {groups.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-card">
            {groups.map((g) => {
              const on = g.id === lastGroupId
              return (
                <li key={g.id}>
                  <button onClick={() => onOpenGroup(g.id)} className={rowCls + (on ? ' border-l-4 border-accent bg-accent-soft pl-3' : '')}>
                    <List size={26} style={{ color: g.color }} className="shrink-0" />
                    <span className={'min-w-0 truncate text-[17px] text-ink ' + (on ? 'font-semibold' : '')}>{tr(g.name)}</span>
                    <Users2 size={18} className="hidden shrink-0 text-ink-tertiary min-[360px]:block" />
                    <span className="ml-auto shrink-0"><Count n={show(tasks.filter((t) => t.groupId === g.id && isOpenTask(t)).length)} on={on} /></span>
                    <ChevronRight size={18} className="shrink-0 text-ink-tertiary" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {canCreate && (
          <button onClick={() => setCreating(true)} className="focus-ring mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-accent text-[17px] font-medium text-white shadow-sm">
            <Plus size={24} /> {tr('Create task group')}
          </button>
        )}
      </section>

      {creating && (
        <CreateGroupSheet
          onClose={() => setCreating(false)}
          onCreated={(g) => { setCreating(false); onGroupCreated(g) }}
        />
      )}
    </div>
  )
}
