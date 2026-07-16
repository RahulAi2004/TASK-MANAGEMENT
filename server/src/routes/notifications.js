// In-app notifications + the automatic overdue-reminder sweep.
import { Router } from 'express'
import { db } from '../lib/db.js'
import { authRequired } from '../lib/auth.js'

export const notificationsRouter = Router()
notificationsRouter.use(authRequired)

// My notifications (latest first) + unread count
notificationsRouter.get('/', async (req, res) => {
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { task: { select: { id: true, taskNo: true } } },
    }),
    db.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ])
  res.json({ notifications, unread })
})

notificationsRouter.post('/read-all', async (req, res) => {
  await db.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } })
  res.json({ ok: true })
})

const REMIND_EVERY_HOURS = 12 // at most one automatic reminder per task per this window

/** Create a reminder notification for every overdue task's assignee (deduped). */
export async function sweepOverdueReminders() {
  const now = new Date()
  const overdue = await db.task.findMany({
    where: {
      deletedAt: null,
      dueAt: { lt: now },
      status: { notIn: ['Completed', 'Cancelled', 'Submitted'] },
      assignedUserId: { not: null },
    },
    select: { id: true, taskNo: true, title: true, dueAt: true, assignedUserId: true },
  })
  const since = new Date(now.getTime() - REMIND_EVERY_HOURS * 3600_000)
  let created = 0
  for (const t of overdue) {
    const already = await db.notification.findFirst({
      where: { taskId: t.id, userId: t.assignedUserId, type: 'Reminder', createdAt: { gte: since } },
      select: { id: true },
    })
    if (already) continue
    await db.notification.create({
      data: {
        userId: t.assignedUserId,
        taskId: t.id,
        type: 'Reminder',
        message: `Reminder: ${t.taskNo} "${t.title}" is overdue (was due ${t.dueAt.toLocaleString()})`,
      },
    })
    created++
  }
  if (created) console.log(`[reminders] sent ${created} overdue reminder(s)`)
}

export function startReminderSweep() {
  sweepOverdueReminders().catch((e) => console.error('[reminders] sweep failed:', e))
  setInterval(
    () => sweepOverdueReminders().catch((e) => console.error('[reminders] sweep failed:', e)),
    5 * 60_000
  )
}
