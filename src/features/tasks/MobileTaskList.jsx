// Phone layout of Task Management: status + SLA chips, search, task-type picker, filter sheet,
// and the task list as rows ("List") or richer cards ("Cards"). Same data and filters as the
// desktop table — AllTasks owns the state and passes it in.
import { useState } from 'react'
import {
  List, LayoutGrid, Search, SlidersHorizontal, Tag, ChevronDown, ChevronRight, Clock, X, CheckCircle2,
  AlertTriangle, AlertCircle, RotateCw, ArrowLeft,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityFlag from './PriorityFlag'
import { CategoryChip } from './chips'
import { initials } from '../../auth/AuthContext'
import { taskMeta, taskCategory, elapsedMs, slaStatus, fmtDuration, fmtMinutes, fmtDate, fmtTime, statusLabel } from './taskMeta'
import { t as tr } from '../../i18n'

const STATUS_CHIPS = [
  { label: 'All', value: 'All' },
  { label: 'In progress', value: 'In Progress' },
  { label: 'Paused', value: 'Waiting / On Hold' },
  { label: 'Done', value: 'Completed' },
]
// Same plain labels as the desktop (On track / At risk / Delayed).
const SLA_BADGE = {
  Normal: { label: 'On track', icon: CheckCircle2, bg: '#E7F6EC', fg: '#1E7B34' },
  Critical: { label: 'At risk', icon: AlertTriangle, bg: '#FFF1E0', fg: '#C25E00' },
  Delayed: { label: 'Delayed', icon: AlertCircle, bg: '#FDE7E9', fg: '#D13438' },
}
// "SO-7819 • Bright Wear Co." — placeholder references ("GENERAL", "nil") are left out.
const refLine = (t, meta) =>
  [t.entityId && !['GENERAL', 'nil'].includes(t.entityId) ? t.entityId : null, meta.customerName].filter(Boolean).join(' • ')
const ROW_TINT = { Delayed: 'bg-[#FFF6F6]', Critical: 'bg-[#FFFAF2]' }

const chip = (on) =>
  'focus-ring shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ' +
  (on ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-ink-secondary')

function SlaBadge({ status }) {
  if (!status) return null
  const s = SLA_BADGE[status]
  const Icon = s.icon
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      <Icon size={12} /> {tr(s.label)}
    </span>
  )
}

function OwnerAvatar({ user }) {
  if (!user) return <span className="grid h-7 w-7 place-items-center rounded-full bg-subtle text-[10px] text-ink-tertiary">—</span>
  return (
    <span title={user.name} className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: user.color || '#5B6474' }}>
      {initials(user.name)}
    </span>
  )
}

function TimeLabel({ t, now }) {
  const started = Boolean(t.startedAt)
  return (
    <span className={'inline-flex items-center gap-1 text-[12px] ' + (started ? 'font-semibold text-ink' : 'text-ink-tertiary')}>
      <Clock size={14} className={started ? 'text-[#1E7B34]' : ''} />
      {started ? fmtDuration(elapsedMs(t, now)) : t.estimatedMinutes ? tr('{time} target', { time: fmtMinutes(t.estimatedMinutes) }) : tr('Not started')}
    </span>
  )
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 md:hidden" onClick={onClose}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
          <button onClick={onClose} aria-label={tr("Close")} className="focus-ring grid h-8 w-8 place-items-center rounded-full text-ink-secondary hover:bg-subtle">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function MobileTaskList({
  title, tasks, slaCounts, f, set, q, setQ, onOpen, selectedId, isAdmin, modules, owners, ranges, statuses,
  filtersActive, clearFilters, now, loading, error, onBack, autoFocusSearch = false, categories = [],
}) {
  const [view, setView] = useState('list')
  const [typeOpen, setTypeOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(10)
  const shown = tasks.slice(0, limit)
  const extraFilters = [f.module !== 'All', f.owner !== 'All', f.range !== 'all', !STATUS_CHIPS.some((c) => c.value === f.status)].filter(Boolean).length

  const selectCls = 'focus-ring h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[15px] text-ink'

  return (
    <div className="md:hidden">
      {/* Title + List/Cards */}
      <button onClick={onBack} className="focus-ring -ml-1 mb-1 flex items-center gap-1 rounded-control py-1 pr-2 text-[14px] font-medium text-accent">
        <ArrowLeft size={18} /> {tr('Lists')}
      </button>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-ink">{title}</h1>
          <p className="text-[14px] text-ink-secondary">{tr("Tap a task to see what to do next")}</p>
        </div>
        <div className="flex shrink-0 rounded-control border border-border bg-surface p-0.5" role="tablist" aria-label={tr("View")}>
          {[['list', 'List', List], ['cards', 'Cards', LayoutGrid]].map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={'focus-ring flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[13px] ' + (view === key ? 'bg-accent font-semibold text-white' : 'text-ink-secondary')}
            >
              <Icon size={15} /> {tr(label)}
            </button>
          ))}
        </div>
      </div>

      {/* Status chips */}
      <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
        {STATUS_CHIPS.map((c) => (
          <button key={c.value} onClick={() => { set('status')(c.value); setLimit(10) }} className={chip(f.status === c.value)}>
            {tr(c.label)}
          </button>
        ))}
      </div>

      {/* SLA chips with counts */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button onClick={() => set('sla')('All')} className={chip(f.sla === 'All')}>{tr("All")}</button>
        {['Critical', 'Delayed'].map((s) => {
          const on = f.sla === s
          const tone = s === 'Delayed' ? '#D13438' : '#C25E00'
          return (
            <button
              key={s}
              onClick={() => { set('sla')(on ? 'All' : s); setLimit(10) }}
              className="focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium"
              style={on ? { background: tone, borderColor: tone, color: '#fff' } : { background: s === 'Delayed' ? '#FDE7E9' : '#FFF1E0', borderColor: 'transparent', color: tone }}
            >
              {tr(SLA_BADGE[s].label)}
              <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={on ? { background: '#fff', color: tone } : { background: tone, color: '#fff' }}>
                {slaCounts[s] || 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + filters */}
      <div className="mb-2.5 flex gap-2">
        <label className="relative block flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
          <input
            autoFocus={autoFocusSearch}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Search tasks…")}
            className="focus-ring h-11 w-full rounded-control border border-border bg-subtle pl-10 pr-3 text-[15px] text-ink placeholder:text-ink-tertiary"
          />
        </label>
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label={tr("More filters")}
          className="focus-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-control border border-accent bg-surface text-accent"
        >
          <SlidersHorizontal size={19} />
          {extraFilters > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{extraFilters}</span>
          )}
        </button>
      </div>

      {/* Task type picker */}
      <div className="relative mb-3">
        <button
          onClick={() => setTypeOpen((o) => !o)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-control bg-accent-soft px-3 py-2 text-[14px] text-accent"
        >
          <Tag size={16} /> {tr('Category')}: <span className="font-semibold">{tr(f.category)}</span> <ChevronDown size={16} />
        </button>
        {typeOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setTypeOpen(false)} />
            <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-card border border-border bg-surface p-2 shadow-pop">
              <div className="mb-1 flex items-center justify-between px-2 pt-1">
                <span className="text-[15px] font-semibold text-ink">{tr("Category")}</span>
                <button onClick={() => setTypeOpen(false)} aria-label={tr("Close")} className="text-ink-secondary"><X size={18} /></button>
              </div>
              {['All', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => { set('category')(c); setTypeOpen(false); setLimit(10) }}
                  className={'flex w-full items-center gap-3 rounded-control px-2 py-2 text-left text-[15px] ' + (f.category === c ? 'bg-accent-soft' : 'hover:bg-subtle')}
                >
                  <span className={'grid h-5 w-5 place-items-center rounded-full border-2 ' + (f.category === c ? 'border-accent' : 'border-border-strong')}>
                    {f.category === c && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                  </span>
                  {c === 'All' ? <span className="text-ink">{tr('All')}</span> : <CategoryChip category={c} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* List */}
      {error ? (
        <div className="py-10 text-center text-sm text-status-danger">{error}</div>
      ) : loading && tasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-tertiary">{tr("Loading…")}</div>
      ) : tasks.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-tertiary">
          {filtersActive ? tr('No tasks match these filters.') : isAdmin ? tr('No tasks yet.') : tr('No tasks assigned to you.')}
          {filtersActive && (
            <button onClick={clearFilters} className="mx-auto mt-3 flex items-center gap-1.5 font-medium text-accent"><RotateCw size={15} /> {tr("Clear filters")}</button>
          )}
        </div>
      ) : view === 'list' ? (
        <ul className="-mx-4 divide-y divide-border border-y border-border bg-surface">
          {shown.map((t) => {
            const meta = taskMeta(t)
            const sla = slaStatus(t, now)
            return (
              <li key={t.id}>
                <button
                  onClick={() => onOpen(t.id)}
                  className={'flex w-full items-center gap-3 px-4 py-3.5 text-left ' + (t.id === selectedId ? 'bg-accent-soft/60' : ROW_TINT[sla] || '')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold text-ink">{t.title}</span>
                    {refLine(t, meta) && <span className="block truncate text-[13px] text-ink-secondary">{refLine(t, meta)}</span>}
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={t.status} size="sm" />
                      <TimeLabel t={t} now={now} />
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <SlaBadge status={sla} />
                    <OwnerAvatar user={t.assignedUser} />
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-tertiary" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          {shown.map((t) => {
            const meta = taskMeta(t)
            const sla = slaStatus(t, now)
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t.id)}
                className={'block w-full rounded-card border bg-surface p-4 text-left shadow-card ' + (t.id === selectedId ? 'border-accent' : 'border-border')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-accent">{t.taskNo}</div>
                    <div className="text-[16px] font-semibold leading-snug text-ink">{t.title}</div>
                    <div className="truncate text-[13px] text-ink-secondary">{refLine(t, meta)}</div>
                  </div>
                  <SlaBadge status={sla} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                  <div><div className="text-ink-tertiary">{tr("Module")}</div><div className="text-ink">{t.department?.name || '—'}</div></div>
                  <div><div className="text-ink-tertiary">{tr("Priority")}</div><PriorityFlag priority={t.priority} size="sm" /></div>
                  <div><div className="text-ink-tertiary">{tr("Started")}</div><div className="text-ink">{t.startedAt ? `${fmtDate(t.startedAt)}, ${fmtTime(t.startedAt)}` : 'Not started'}</div></div>
                  <div><div className="text-ink-tertiary">{tr("Elapsed / Normal")}</div><div className="text-ink">{fmtDuration(elapsedMs(t, now))} / {fmtMinutes(t.estimatedMinutes)}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-2">
                    <CategoryChip category={taskCategory(t)} />
                    <StatusBadge status={t.status} size="sm" />
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
                    <OwnerAvatar user={t.assignedUser} /> {t.assignedUser?.name?.split(' ')[0] || tr('Nobody yet')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {tasks.length > shown.length && (
        <button onClick={() => setLimit((n) => n + 10)} className="focus-ring mx-auto mt-4 block rounded-control border border-accent px-5 py-2 text-sm font-medium text-accent">
          Load more ({tasks.length - shown.length} left)
        </button>
      )}
      {tasks.length > 0 && <p className="mt-3 text-center text-xs text-ink-tertiary">{tr('Showing {n} of {total} tasks', { n: shown.length, total: tasks.length })}</p>}

      {filtersOpen && (
        <Sheet title={tr("Filters")} onClose={() => setFiltersOpen(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">{tr("Task Status")}</span>
              <select value={f.status} onChange={(e) => set('status')(e.target.value)} className={selectCls}>
                {statuses.map((s) => <option key={s} value={s}>{s === 'All' ? tr('All statuses') : s === 'Waiting / On Hold' ? tr('Paused or blocked') : statusLabel(s)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">{tr("Module")}</span>
              <select value={f.module} onChange={(e) => set('module')(e.target.value)} className={selectCls}>
                <option value="All">{tr("All modules")}</option>
                {modules.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            {isAdmin && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">{tr("Owner")}</span>
                <select value={f.owner} onChange={(e) => set('owner')(e.target.value)} className={selectCls}>
                  <option value="All">{tr("All owners")}</option>
                  {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  <option value="none">{tr("Unassigned")}</option>
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">{tr("Date range")}</span>
              <select value={f.range} onChange={(e) => set('range')(e.target.value)} className={selectCls}>
                {ranges.map((r) => <option key={r.key} value={r.key}>{tr(r.label)}</option>)}
              </select>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { clearFilters(); setFiltersOpen(false) }} className="focus-ring h-11 flex-1 rounded-control border border-accent text-[15px] font-medium text-accent">{tr("Clear all")}</button>
              <button onClick={() => setFiltersOpen(false)} className="focus-ring h-11 flex-1 rounded-control bg-accent text-[15px] font-semibold text-white">{tr('Show {n} tasks', { n: tasks.length })}</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
