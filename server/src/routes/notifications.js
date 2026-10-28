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

// Mark one notification read (when it is clicked). Scoped to the caller's own notifications.
notificationsRouter.post('/:id/read', async (req, res) => {
  const { count } = await db.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } })
  if (!count) return res.status(404).json({ error: 'Notification not found' })
  res.json({ ok: true })
})

// One daily digest per person instead of one reminder per late task every few hours —
// the old behaviour piled up hundreds of unread reminders and the bell stopped meaning anything.
const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Karachi'
const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: REMINDER_TIMEZONE }) // YYYY-MM-DD

export function digestMessage(tasks) {
  const n = tasks.length
  const names = tasks.slice(0, 3).map((t) => t.taskNo).join(', ')
  const more = n > 3 ? ` and ${n - 3} more` : ''
  return n === 1
    ? `Daily reminder: ${tasks[0].taskNo} "${tasks[0].title}" is late.`
    : `Daily reminder: ${n} of your tasks are late — ${names}${more}.`
}

/** Send each person with late tasks one reminder per day (deduplicated by dedupeKey). */
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
    orderBy: { dueAt: 'asc' },
  })
  const byUser = new Map()
  for (const t of overdue) byUser.set(t.assignedUserId, [...(byUser.get(t.assignedUserId) || []), t])
  const today = dayKey(now)
  let created = 0
  for (const [userId, tasks] of byUser) {
    const dedupeKey = `late-digest:${userId}:${today}`
    if (await db.notification.findFirst({ where: { dedupeKey }, select: { id: true } })) continue
    await db.notification.create({
      data: {
        userId,
        taskId: tasks.length === 1 ? tasks[0].id : null,
        type: 'Reminder',
        message: digestMessage(tasks),
        dedupeKey,
      },
    })
    created++
  }
  if (created) console.log(`[reminders] sent ${created} daily late-task reminder(s)`)
}

export function startReminderSweep() {
  sweepOverdueReminders().catch((e) => console.error('[reminders] sweep failed:', e))
  setInterval(
    () => sweepOverdueReminders().catch((e) => console.error('[reminders] sweep failed:', e)),
    5 * 60_000
  )
}
