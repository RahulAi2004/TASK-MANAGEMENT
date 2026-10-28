// One-off cleanup for the switch to daily reminder digests: marks the automatic overdue
// reminders that piled up under the old 12-hour sweep as read, so the bell starts clean.
// Nothing is deleted. Manual reminders ("X sent you a reminder…") are left untouched.
//
//   node scripts/clear-old-reminders.mjs           # dry run: counts only
//   node scripts/clear-old-reminders.mjs --apply   # mark them read
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const db = new PrismaClient()
const where = { type: 'Reminder', isRead: false, message: { startsWith: 'Reminder: ' }, dedupeKey: null }

const count = await db.notification.count({ where })
console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${count} old automatic reminder(s) still unread`)
if (apply && count) {
  const { count: done } = await db.notification.updateMany({ where, data: { isRead: true } })
  console.log(`marked ${done} as read`)
}
await db.$disconnect()
