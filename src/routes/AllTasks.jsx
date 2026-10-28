// Task Management — stat cards · filters · All Tasks table · right-docked Task Detail panel.
// Admin sees every task (Owner filter narrows it); other roles see the tasks assigned to them.
// Status, search and date range filter on the server; type, module, owner and SLA (derived
// values) filter on the loaded rows.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, Calendar, RotateCw, Settings, ChevronLeft, ChevronRight, SlidersHorizontal, Rows3, Table2 } from 'lucide-react'
import AppShell from '../app/AppShell'
import StatCards from '../features/dashboard/StatCards'
import TaskGrid from '../features/tasks/TaskGrid'
import SimpleTaskTable from '../features/tasks/SimpleTaskTable'
import MobileTaskList from '../features/tasks/MobileTaskList'
import TaskDetailPanel from '../features/tasks/TaskDetailPanel'
import useNow from '../features/tasks/useNow'
import { taskCategory, slaStatus, statusLabel, SLA_STYLE, CATEGORIES as TASK_CATEGORIES } from '../features/tasks/taskMeta'
import { api } from '../data/api'
import { useApi, useAuth } from '../auth/AuthContext'

const STATUSES = ['All', 'Pending', 'Assigned', 'In Progress', 'Waiting / On Hold', 'Submitted', 'Completed', 'Rejected', 'Cancelled', 'Overdue']
const CATEGORIES = ['All', ...TASK_CATEGORIES]
const SLAS = ['All', 'Normal', 'Critical', 'Delayed']
const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
]
const PAGE_SIZE = 10
// Status filter values are what the API expects; people read the plain label.
const statusOptionLabel = (s) => (s === 'All' ? 'All statuses' : s === 'Waiting / On Hold' ? 'Paused or blocked' : statusLabel(s))
const VIEW_KEY = 'tm_table_view'
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'detailed' ? 'detailed' : 'simple'
  } catch {
    return 'simple'
  }
}
const DEFAULTS = { category: 'All', module: 'All', status: 'All', sla: 'All', owner: 'All', range: 'all' }

function rangeStart(key) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (key === 'today') return d
  if (key === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d } // Monday
  if (key === 'month') { d.setDate(1); return d }
  if (key === '30d') { d.setDate(d.getDate() - 29); return d }
  return null
}

// Page buttons: always first + last, the current page and its neighbours, "…" for gaps.
function pageList(current, pages) {
  const want = new Set([1, pages, current - 1, current, current + 1].filter((p) => p >= 1 && p <= pages))
  const out = []
  ;[...want].sort((a, b) => a - b).forEach((p, i, arr) => {
    if (i && p - arr[i - 1] > 1) out.push('gap-' + p)
    out.push(p)
  })
  return out
}

function Pager({ current, pages, onPage }) {
  const btn = 'focus-ring grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm tabular-nums'
  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <button onClick={() => onPage(current - 1)} disabled={current === 1} title="Previous page" className={btn + ' text-ink-secondary hover:bg-subtle disabled:opacity-40'}>
        <ChevronLeft size={16} />
      </button>
      {pageList(current, pages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-ink-tertiary">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            aria-current={p === current ? 'page' : undefined}
            className={btn + (p === current ? ' bg-accent font-semibold text-white' : ' text-ink-secondary hover:bg-subtle')}
          >
            {p}
          </button>
        )
      )}
      <button onClick={() => onPage(current + 1)} disabled={current === pages} title="Next page" className={btn + ' text-ink-secondary hover:bg-subtle disabled:opacity-40'}>
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

function Select({ label, value, onChange, children, icon: Icon, hideLabel = false }) {
  return (
    <label className="block min-w-0">
      <span className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-ink'}>{label}</span>
      <span className="relative block">
        {Icon && <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            'focus-ring h-10 w-full appearance-none rounded-control border border-border-strong bg-surface pr-9 text-sm text-ink ' +
            (Icon ? 'pl-9' : 'pl-3')
          }
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
      </span>
    </label>
  )
}

export default function AllTasks() {
  const { user } = useAuth()
  const isAdmin = user.role === 'ADMIN'
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')
  const urlQ = params.get('q') || ''

  const [q, setQ] = useState(urlQ)
  const [debouncedQ, setDebouncedQ] = useState(urlQ)
  const [f, setF] = useState(DEFAULTS)
  const [page, setPage] = useState(1)
  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setPage(1) }
  const now = useNow(30_000)
  const [view, setViewState] = useState(readView)
  const setView = (v) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode: keep it for this visit only */ }
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Top-bar search lands here as ?q=
  useEffect(() => { setQ(urlQ); setDebouncedQ(urlQ) }, [urlQ])
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [q])

  const from = rangeStart(f.range)
  const stats = useApi(() => api.stats(), [])
  const list = useApi(
    () =>
      api.tasks({
        scope: isAdmin ? 'all' : 'mine',
        limit: 500,
        ...(f.status !== 'All' ? { status: f.status } : {}),
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(from ? { from: from.toISOString() } : {}),
      }),
    [isAdmin, f.status, debouncedQ, f.range]
  )
  const reloadAll = () => { stats.reload(); list.reload() }

  const all = list.data?.tasks || []
  // Dropdown options come from the loaded rows so they only list values that exist.
  const modules = useMemo(() => [...new Set(all.map((t) => t.department?.name).filter(Boolean))].sort(), [all])
  const owners = useMemo(() => {
    const m = new Map()
    all.forEach((t) => t.assignedUser && m.set(t.assignedUser.id, t.assignedUser.name))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all])

  const baseRows = all.filter(
    (t) =>
      (f.category === 'All' || taskCategory(t) === f.category) &&
      (f.module === 'All' || t.department?.name === f.module) &&
      (f.owner === 'All' || (f.owner === 'none' ? !t.assignedUser : t.assignedUser?.id === f.owner))
  )
  // SLA chip counts (phone) are taken before the SLA filter, so each chip shows what it would select.
  const slaCounts = baseRows.reduce((m, t) => { const s = slaStatus(t, now); if (s) m[s] = (m[s] || 0) + 1; return m }, {})
  const rows = f.sla === 'All' ? baseRows : baseRows.filter((t) => slaStatus(t, now) === f.sla)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const filtersActive = q || Object.keys(DEFAULTS).some((k) => f[k] !== DEFAULTS[k])
  const clearFilters = () => {
    setF(DEFAULTS)
    setQ('')
    setPage(1)
    if (urlQ) setParams((p) => { p.delete('q'); return p })
  }
  const hiddenActive = ['category', 'module', 'sla', 'range'].filter((k) => f[k] !== DEFAULTS[k]).length
  // One-click steps from the list ("Start", "Resume"); anything that needs input opens the task.
  const runAction = async (t, event) => {
    setActionError(null)
    setBusyId(t.id)
    try {
      await api.transition(t.id, { event })
      reloadAll()
    } catch (e) {
      setActionError(`${t.title}: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }
  const openTask = (id) => setParams((p) => { p.set('task', id); return p })
  const closeTask = () => setParams((p) => { p.delete('task'); return p })

  return (
    <AppShell
      title={isAdmin ? 'All tasks' : 'My tasks'}
      subtitle={isAdmin ? 'Everything your team is working on. Click a task to see its details.' : 'Tasks assigned to you. Click a task to see its details.'}
      onTasksChanged={reloadAll}
      actions={(shell) =>
        isAdmin && (
          <button
            onClick={shell.openSettings}
            className="focus-ring flex items-center gap-2 rounded-control border border-accent bg-surface px-5 py-2.5 text-[15px] font-medium text-accent hover:bg-accent-soft"
          >
            <Settings size={18} /> Settings
          </button>
        )
      }
      hideMobileHeader
      aside={selectedId && <TaskDetailPanel key={selectedId} taskId={selectedId} onClose={closeTask} onChanged={reloadAll} />}
    >
      <MobileTaskList
        title={isAdmin ? 'All tasks' : 'My tasks'}
        tasks={rows} slaCounts={slaCounts} f={f} set={set} q={q} setQ={setQ}
        onOpen={openTask} selectedId={selectedId} isAdmin={isAdmin} modules={modules} owners={owners}
        ranges={RANGES} statuses={STATUSES} filtersActive={filtersActive} clearFilters={clearFilters}
        now={now} loading={list.loading} error={list.error}
      />
      <div className="hidden space-y-4 md:block">
        <StatCards
          stats={stats.data?.stats}
          active={f.status}
          onSelect={(s) => set('status')(s)}
        />

        {/* Filters: the everyday ones in one row; the rest behind "More filters" */}
        <section className="rounded-card border border-border bg-surface p-3 shadow-card">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative block min-w-[220px] flex-1">
              <span className="sr-only">Search tasks</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tasks, customers or order numbers…"
                className="focus-ring h-10 w-full rounded-control border border-border-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-tertiary"
              />
            </label>
            <div className="w-44">
              <Select label="Status" hideLabel value={f.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusOptionLabel(s)}</option>)}
              </Select>
            </div>
            {isAdmin && (
              <div className="w-44">
                <Select label="Assigned to" hideLabel value={f.owner} onChange={set('owner')}>
                  <option value="All">Anyone</option>
                  {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  <option value="none">Nobody yet</option>
                </Select>
              </div>
            )}
            <button
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              className={'focus-ring flex h-10 items-center gap-2 rounded-control border px-3.5 text-sm font-medium ' + (moreOpen || hiddenActive ? 'border-accent bg-accent-soft text-accent' : 'border-border-strong text-ink-secondary hover:bg-subtle')}
            >
              <SlidersHorizontal size={16} /> More filters
              {hiddenActive > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{hiddenActive}</span>}
            </button>
            {filtersActive && (
              <button onClick={clearFilters} className="focus-ring flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-accent hover:bg-accent-soft">
                <RotateCw size={15} /> Clear filters
              </button>
            )}
          </div>
          {moreOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-4">
              <Select label="Category" value={f.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
              </Select>
              <Select label="Department" value={f.module} onChange={set('module')}>
                <option value="All">All departments</option>
                {modules.map((m) => <option key={m}>{m}</option>)}
              </Select>
              <Select label="On time?" value={f.sla} onChange={set('sla')}>
                {SLAS.map((s) => <option key={s} value={s}>{s === 'All' ? 'Any' : SLA_STYLE[s].label}</option>)}
              </Select>
              <Select label="Created" value={f.range} onChange={set('range')} icon={Calendar}>
                {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </div>
          )}
        </section>

        {/* Table */}
        <section className="rounded-card border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <h2 className="text-[18px] font-semibold text-ink">
              {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
              {list.loading && all.length > 0 && <span className="ml-2 text-xs font-normal text-ink-tertiary">Refreshing…</span>}
            </h2>
            <div className="flex rounded-control border border-border bg-subtle p-0.5" role="tablist" aria-label="Table view">
              {[['simple', 'Simple', Rows3], ['detailed', 'Detailed', Table2]].map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  title={key === 'simple' ? 'The essentials: task, person, due date, status' : 'Every column, including times and department'}
                  className={'focus-ring flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[13px] ' + (view === key ? 'bg-surface font-semibold text-ink shadow-card' : 'text-ink-secondary')}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>
          {actionError && (
            <div className="mx-5 mb-3 rounded-control bg-status-dangersoft px-3 py-2 text-sm text-status-danger">{actionError}</div>
          )}
          {list.error ? (
            <div className="border-t border-border px-5 py-10 text-center text-sm text-status-danger">{list.error}</div>
          ) : list.loading && all.length === 0 ? (
            <div className="border-t border-border px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="border-t border-border px-5 py-12 text-center text-sm text-ink-tertiary">
              {filtersActive ? 'No tasks match these filters.' : isAdmin ? 'No tasks yet — use “New Task” to create one.' : 'Nothing is assigned to you right now.'}
            </div>
          ) : (
            <>
              <div className="border-t border-border">
                {view === 'simple' ? (
                  <SimpleTaskTable tasks={pageRows} now={now} user={user} selectedId={selectedId} onOpen={openTask} onAction={runAction} busyId={busyId} />
                ) : (
                  <TaskGrid tasks={pageRows} now={now} selectedId={selectedId} onOpen={openTask} />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-ink-secondary">
                <span>
                  Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length}
                  {all.length >= 500 && <span className="text-ink-tertiary"> (first 500 — narrow the filters to see more)</span>}
                </span>
                {pages > 1 && <Pager current={current} pages={pages} onPage={setPage} />}
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
