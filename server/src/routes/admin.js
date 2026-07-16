import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole } from '../lib/auth.js'

export const adminRouter = Router()
adminRouter.use(authRequired, requireRole('ADMIN'))

const OPEN = { notIn: ['Completed', 'Cancelled'] }

// Create a department
const DeptSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(40).optional(),
})
adminRouter.post('/departments', async (req, res) => {
  const parsed = DeptSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' })
  const name = parsed.data.name.trim()
  const code = (parsed.data.code || name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40)
  const exists = await db.department.findUnique({ where: { code } })
  if (exists) return res.status(409).json({ error: 'A department with that code already exists' })
  const dept = await db.department.create({ data: { name, code } })
  res.status(201).json({ department: dept })
})

// ── Departments ──────────────────────────────────────────────────────────────
adminRouter.get('/departments', async (_req, res) => {
  const depts = await db.department.findMany({
    include: { users: { select: { id: true, name: true, role: true, color: true } } },
    orderBy: { name: 'asc' },
  })
  const rows = await Promise.all(
    depts.map(async (d) => {
      const [open, overdue, completedRows] = await Promise.all([
        db.task.count({ where: { departmentId: d.id, status: OPEN, deletedAt: null } }),
        db.task.count({
          where: {
            departmentId: d.id, status: { notIn: ['Completed', 'Cancelled', 'Submitted'] },
            dueAt: { lt: new Date() }, deletedAt: null,
          },
        }),
        db.task.findMany({
          where: { departmentId: d.id, status: 'Completed' },
          select: { dueAt: true, completedAt: true },
        }),
      ])
      const completed = completedRows.length
      // SLA proxy: completed on or before due date vs all completed
      const onTime = completedRows.filter(
        (t) => !t.dueAt || (t.completedAt && new Date(t.completedAt) <= new Date(t.dueAt))
      ).length
      const head = d.users.find((u) => u.role === 'ADMIN') || d.users[0] || null
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        members: d.users.length,
        teams: Math.max(1, Math.ceil(d.users.length / 2)),
        head: head ? { name: head.name, color: head.color } : null,
        open,
        overdue,
        sla: completed ? Math.round((Math.min(onTime, completed) / completed) * 100) : 100,
      }
    })
  )
  res.json({ departments: rows })
})

// ── Reports ──────────────────────────────────────────────────────────────────
adminRouter.get('/reports', async (_req, res) => {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - 6)
  startOfWeek.setHours(0, 0, 0, 0)

  const allTasks = await db.task.findMany({
    where: { deletedAt: null },
    select: {
      status: true, taskType: true, createdAt: true, completedAt: true,
      dueAt: true, startedAt: true, department: { select: { name: true } },
    },
  })

  // KPIs
  const completedThisWeek = allTasks.filter(
    (t) => t.completedAt && new Date(t.completedAt) >= startOfWeek
  ).length
  const createdThisWeek = allTasks.filter((t) => new Date(t.createdAt) >= startOfWeek).length
  const overdue = allTasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < now && !['Completed', 'Cancelled', 'Submitted'].includes(t.status)
  ).length
  const completedTasks = allTasks.filter((t) => t.completedAt && t.startedAt)
  const avgCycleMin = completedTasks.length
    ? Math.round(
        completedTasks.reduce((a, t) => a + (new Date(t.completedAt) - new Date(t.startedAt)) / 60000, 0) /
          completedTasks.length
      )
    : 0
  const onTime = allTasks.filter(
    (t) => t.status === 'Completed' && t.dueAt && t.completedAt && new Date(t.completedAt) <= new Date(t.dueAt)
  ).length
  const totalCompleted = allTasks.filter((t) => t.status === 'Completed').length
  const slaPct = totalCompleted ? Math.round((onTime / totalCompleted) * 100) : 100

  // Completed & created per day (last 7 days)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    days.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      completed: allTasks.filter((t) => t.completedAt && new Date(t.completedAt) >= d && new Date(t.completedAt) < next).length,
      created: allTasks.filter((t) => new Date(t.createdAt) >= d && new Date(t.createdAt) < next).length,
    })
  }

  // By task type
  const typeMap = {}
  allTasks.forEach((t) => {
    typeMap[t.taskType] = (typeMap[t.taskType] || 0) + 1
  })
  const byType = Object.entries(typeMap)
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)

  // SLA compliance by department
  const deptMap = {}
  allTasks.forEach((t) => {
    const name = t.department?.name || 'Unassigned'
    deptMap[name] ||= { done: 0, breached: 0, cycleSum: 0, cycleN: 0 }
    if (t.status === 'Completed') {
      deptMap[name].done++
      if (t.dueAt && t.completedAt && new Date(t.completedAt) > new Date(t.dueAt)) deptMap[name].breached++
      if (t.startedAt && t.completedAt) {
        deptMap[name].cycleSum += (new Date(t.completedAt) - new Date(t.startedAt)) / 60000
        deptMap[name].cycleN++
      }
    }
  })
  const slaByDept = Object.entries(deptMap)
    .filter(([, v]) => v.done > 0)
    .map(([dept, v]) => ({
      dept,
      done: v.done,
      breached: v.breached,
      avg: v.cycleN ? Math.round(v.cycleSum / v.cycleN) + 'm' : '—',
      pct: v.done ? Math.round(((v.done - v.breached) / v.done) * 100) : 100,
    }))

  res.json({
    kpis: [
      { label: 'Completed this week', value: completedThisWeek, note: `${createdThisWeek} created` },
      { label: 'Avg cycle time', value: avgCycleMin ? avgCycleMin + 'm' : '—', note: 'start → done' },
      { label: 'SLA compliance', value: slaPct + '%', note: `${onTime}/${totalCompleted} on time` },
      { label: 'Currently overdue', value: overdue, note: 'across all teams' },
    ],
    perDay: days,
    byType,
    slaByDept,
  })
})

// ── Org activity feed ────────────────────────────────────────────────────────
adminRouter.get('/activity', async (_req, res) => {
  const activity = await db.activity.findMany({
    take: 12,
    orderBy: { createdAt: 'desc' },
    include: {
      performedBy: { select: { name: true, color: true } },
      task: { select: { taskNo: true, title: true } },
    },
  })
  res.json({ activity })
})
