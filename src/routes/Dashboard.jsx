// ADMIN portal — org-wide command center: see, monitor, and add tasks.
import { AlertCircle, CheckCircle2, Upload, Clock, XCircle, Plus, CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppShell from '../app/AppShell'
import StatCards from '../features/dashboard/StatCards'
import TaskTable, { isOverdue } from '../features/tasks/TaskTable'
import { api } from '../data/api'
import { useApi, initials } from '../auth/AuthContext'

const STATUS_COLORS = {
  Assigned: '#2564CF', Accepted: '#2564CF', 'In Progress': '#3B7AD9',
  Waiting: '#C19C00', 'On Hold': '#C19C00', Submitted: '#5B4BE6',
  Completed: '#107C10', Rejected: '#D13438', Reopened: '#D13438',
  Pending: '#A19F9D', Cancelled: '#A19F9D',
}

function StatusDonut({ tasks }) {
  const counts = {}
  tasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1 })
  const segments = Object.entries(counts).map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] || '#A19F9D' }))
  const total = tasks.length || 1
  const R = 54, C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-4 text-[15px] font-semibold text-ink">Task Status Overview</h3>
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#F3F2F1" strokeWidth="16" />
            {segments.map((s) => {
              const len = (s.value / total) * C
              const seg = <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
              offset += len
              return seg
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center leading-none">
              <div className="text-2xl font-semibold text-ink">{tasks.length}</div>
              <div className="text-[11px] text-ink-tertiary">tasks</div>
            </div>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
              </span>
              <span className="font-semibold text-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function WorkloadMini({ rows }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Team Workload</h3>
        <Link to="/workload" className="text-xs font-medium text-accent hover:underline">View All</Link>
      </div>
      <ul className="space-y-3">
        {rows?.map((u) => (
          <li key={u.id} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: u.color }}>
              {initials(u.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{u.name}</span>
                <span className="text-xs text-ink-tertiary">{u.openTasks}/{u.capacity}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full" style={{ width: Math.min(100, (u.openTasks / u.capacity) * 100) + '%', background: u.openTasks > u.capacity * 0.8 ? '#D13438' : '#2564CF' }} />
              </div>
            </div>
            {u.overdue > 0 && (
              <span className="rounded-chip bg-status-dangersoft px-1.5 py-0.5 text-[10px] font-semibold text-status-danger">{u.overdue} late</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ACT_ICON = {
  Created: { Icon: Plus, color: '#2564CF' },
  Started: { Icon: Clock, color: '#3B7AD9' },
  Submitted: { Icon: Upload, color: '#5B4BE6' },
  Approved: { Icon: CheckCircle2, color: '#107C10' },
  Rejected: { Icon: XCircle, color: '#D13438' },
  Assigned: { Icon: Plus, color: '#2564CF' },
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function ActivityFeed({ items }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">Activity Feed</h3>
      <ul className="space-y-3">
        {items?.slice(0, 8).map((a) => {
          const meta = ACT_ICON[a.activityType] || ACT_ICON.Created
          return (
            <li key={a.id} className="flex gap-3">
              <meta.Icon size={17} style={{ color: meta.color }} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-ink">
                  <span className="font-medium">{a.task?.taskNo}</span> {a.activityType.toLowerCase()}
                  {a.newStatus ? ` → ${a.newStatus}` : ''}
                </div>
                <div className="text-[11px] text-ink-tertiary">
                  by {a.performedBy?.name || 'system'} · {timeAgo(a.createdAt)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Upcoming({ tasks }) {
  const soon = tasks
    .filter((t) => t.dueAt && !['Completed', 'Cancelled'].includes(t.status) && new Date(t.dueAt) >= new Date())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 5)
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock size={17} className="text-accent" />
        <h3 className="text-[15px] font-semibold text-ink">Upcoming Deadlines</h3>
      </div>
      {soon.length === 0 && <div className="text-sm text-ink-tertiary">Nothing due soon.</div>}
      <ul className="space-y-3">
        {soon.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={'/task/' + t.id} className="text-sm font-medium text-ink hover:text-accent">{t.title}</Link>
              <div className="text-xs text-ink-tertiary">{t.taskNo} · {t.assignedUser?.name}</div>
            </div>
            <div className="whitespace-nowrap text-right text-xs text-ink-secondary">
              {new Date(t.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              <div className="text-ink-tertiary">{new Date(t.dueAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Escalations({ tasks }) {
  const late = tasks.filter(isOverdue)
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle size={17} className="text-status-danger" />
        <h3 className="text-[15px] font-semibold text-ink">Escalations</h3>
      </div>
      {late.length === 0 && <div className="text-sm text-ink-tertiary">Nothing overdue.</div>}
      <ul className="space-y-3">
        {late.map((t) => (
          <li key={t.id} className="flex gap-3">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-status-danger" />
            <div className="min-w-0">
              <Link to={'/task/' + t.id} className="text-sm font-medium text-ink hover:text-accent">{t.title}</Link>
              <div className="text-xs text-ink-secondary">{t.taskNo} · {t.assignedUser?.name}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Dashboard() {
  const stats = useApi(() => api.stats(), [])
  const tasks = useApi(() => api.tasks({ scope: 'all' }), [])
  const workload = useApi(() => api.workload(), [])
  const activity = useApi(() => api.activity(), [])
  const reloadAll = () => { stats.reload(); tasks.reload(); workload.reload(); activity.reload() }
  const allTasks = tasks.data?.tasks || []

  return (
    <AppShell title="Task Dashboard" subtitle="Org-wide overview — see, monitor and assign" onTasksChanged={reloadAll}>
      <div className="space-y-6">
        <StatCards stats={stats.data?.stats} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="rounded-card border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-[15px] font-semibold text-ink">All Tasks</h3>
                <Link to="/all-tasks" className="text-xs font-medium text-accent hover:underline">View All →</Link>
              </div>
              {tasks.loading ? (
                <div className="px-5 py-10 text-center text-sm text-ink-tertiary">Loading…</div>
              ) : (
                <TaskTable tasks={allTasks.slice(0, 8)} showAssignee showCreator />
              )}
            </div>
          </div>
          <div className="space-y-6">
            {!tasks.loading && <StatusDonut tasks={allTasks} />}
            <WorkloadMini rows={workload.data?.workload} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Escalations tasks={allTasks} />
          <Upcoming tasks={allTasks} />
          <ActivityFeed items={activity.data?.activity} />
        </div>
      </div>
    </AppShell>
  )
}
