// Printshop SLA Monitor bridge. Machine-to-machine: the Printshop backend calls these with the
// shared secret (SLA_BRIDGE_SECRET) in X-Decoinks-Bridge-Secret — there is no user token.
//   GET  /api/integration/sla-tasks  every open task with its own SLA state, for the monitor's
//                                     Task Management tab and its "tasks overdue" counts
//   POST /api/integration/sla-alert  an order stage entered its warning zone or breached its SLA:
//                                     the owner gets a bell notification here, and a breach also
//                                     opens an Urgent "SLA Breach" task assigned to them
import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { nextTaskNo } from '../lib/templates.js'

export const integrationRouter = Router()

integrationRouter.use((req, res, next) => {
  const want = process.env.SLA_BRIDGE_SECRET || ''
  const got = String(req.get('x-decoinks-bridge-secret') || '')
  const a = Buffer.from(want), b = Buffer.from(got)
  if (!want || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Bad bridge secret' })
  next()
})

const CLOSED = ['Completed', 'Cancelled']
const DUE_SOON_MS = 4 * 3600_000

/** normal | critical | delayed — delayed = past due or past the routine's delayed threshold. */
function slaState(t, now) {
  if (t.status === 'Submitted') return 'normal' // waiting on review, not on the assignee
  const due = t.dueAt ? t.dueAt.getTime() : null
  const ageMin = (now - t.createdAt.getTime()) / 60_000
  if ((due != null && due < now) || (t.slaDelayedMinutes && ageMin > t.slaDelayedMinutes)) return 'delayed'
  if ((t.slaCriticalMinutes && ageMin > t.slaCriticalMinutes) || (due != null && due - now < DUE_SOON_MS)) return 'critical'
  return 'normal'
}

integrationRouter.get('/sla-tasks', async (_req, res) => {
  const now = Date.now()
  const tasks = await db.task.findMany({
    where: { deletedAt: null, status: { notIn: CLOSED } },
    include: { assignedUser: { select: { name: true, email: true } }, department: { select: { name: true } } },
    orderBy: { dueAt: 'asc' },
  })
  res.json({
    tasks: tasks.map((t) => ({
      id: t.id, taskNo: t.taskNo, title: t.title, description: t.description, taskType: t.taskType,
      entityType: t.entityType, entityId: t.entityId, department: t.department?.name || null,
      priority: t.priority, status: t.status, dueAt: t.dueAt, createdAt: t.createdAt,
      owner: t.assignedUser?.name || null, ownerEmail: t.assignedUser?.email || null,
      sla: slaState(t, now),
    })),
  })
})

const AlertSchema = z.object({
  key: z.string().min(1).max(200),
  level: z.enum(['warning', 'breach']),
  orderNumber: z.string().min(1).max(80),
  customer: z.string().max(200).optional(),
  stageKey: z.string().min(1).max(60),
  stageLabel: z.string().min(1).max(120),
  detail: z.string().max(300).optional(),
  assignTo: z.string().email().optional(), // who owns the stage: gets the breach task
  notify: z.array(z.string().email()).max(30).default([]), // everyone else who should see it
  dueHours: z.number().min(0.5).max(72).default(4),
})

integrationRouter.post('/sla-alert', async (req, res) => {
  const p = AlertSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const a = p.data
  const emails = [...new Set([a.assignTo, ...a.notify].filter(Boolean).map((e) => e.toLowerCase()))]
  const users = await db.user.findMany({ where: { email: { in: emails } } })
  const byEmail = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), u]))
  const unmatched = emails.filter((e) => !byEmail[e])
  if (!users.length) return res.json({ notified: 0, task: null, unmatched })

  const subject = `${a.orderNumber} — ${a.stageLabel}`
  let task = null
  if (a.level === 'breach') {
    const owner = byEmail[(a.assignTo || '').toLowerCase()] || users[0]
    const marker = `"slaKey":"${a.orderNumber}|${a.stageKey}"`
    task = await db.task.findFirst({
      where: { deletedAt: null, taskType: 'SLA Breach', entityId: a.orderNumber, status: { notIn: CLOSED }, metadata: { contains: marker } },
    })
    if (!task) {
      const creator = (await db.user.findUnique({ where: { email: (process.env.ADMIN_EMAIL || '').toLowerCase() } })) || (await db.user.findFirst({ where: { role: 'ADMIN' } }))
      const dept = await db.department.findFirst({ where: { id: owner.departmentId || '' } })
      task = await db.task.create({
        data: {
          taskNo: await nextTaskNo(),
          title: `SLA breach: ${subject}`,
          description: `${a.customer ? `${a.customer} · ` : ''}${a.detail || 'This order stage went past its SLA limit.'} Raised automatically by the Printshop SLA Monitor — move the order on or explain the delay.`,
          entityType: 'Sales Order', entityId: a.orderNumber, taskType: 'SLA Breach',
          actionType: 'H', priority: 'Urgent', status: 'Assigned',
          assignedUserId: owner.id, departmentId: dept?.id, createdById: creator.id, reviewerId: creator.id,
          requiresReview: false, performedByType: 'User',
          dueAt: new Date(Date.now() + a.dueHours * 3600_000),
          metadata: JSON.stringify({ slaKey: `${a.orderNumber}|${a.stageKey}`, customerName: a.customer || undefined, source: 'printshop-sla-monitor' }),
        },
      })
      await db.assignmentHistory.create({ data: { taskId: task.id, assignedUserId: owner.id, assignedById: creator.id, reason: 'SLA breach (automatic)' } })
      await db.activity.create({ data: { taskId: task.id, activityType: 'Created', newStatus: 'Assigned', performedById: creator.id, notes: 'Raised by the Printshop SLA Monitor' } })
    }
  }

  const message = a.level === 'breach'
    ? `SLA breached: ${subject}${a.customer ? ` (${a.customer})` : ''}${a.detail ? ` — ${a.detail}` : ''}${task ? ` · ${task.taskNo}` : ''}`
    : `SLA warning: ${subject}${a.customer ? ` (${a.customer})` : ''}${a.detail ? ` — ${a.detail}` : ''}`
  let notified = 0
  for (const u of users) {
    const seen = await db.notification.findFirst({ where: { userId: u.id, dedupeKey: a.key }, select: { id: true } })
    if (seen) continue
    await db.notification.create({ data: { userId: u.id, taskId: task?.id, type: 'SLA', message, dedupeKey: a.key } })
    notified++
  }
  res.json({ notified, task: task ? { id: task.id, taskNo: task.taskNo } : null, unmatched })
})
