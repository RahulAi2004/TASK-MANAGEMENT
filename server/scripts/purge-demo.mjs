// Removes all demo/seed data from the database, keeping only departments and
// the admin account (ADMIN_EMAIL from .env). Safe to run on a fresh deploy that
// still has the old sample tasks/users. Run:  node scripts/purge-demo.mjs
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const ADMIN = (process.env.ADMIN_EMAIL || 'info@technocas.com').toLowerCase()

const counts = {}
counts.aiRuns = (await db.aiRun.deleteMany()).count
counts.notifications = (await db.notification.deleteMany()).count
counts.activity = (await db.activity.deleteMany()).count
counts.comments = (await db.comment.deleteMany()).count
counts.checklist = (await db.checklistItem.deleteMany()).count
counts.history = (await db.assignmentHistory.deleteMany()).count
counts.voiceNotes = (await db.taskVoiceNote.deleteMany()).count
counts.tasks = (await db.task.deleteMany()).count
counts.nonAdminUsers = (await db.user.deleteMany({ where: { email: { not: ADMIN } } })).count

const users = await db.user.findMany({ select: { email: true, role: true } })
console.log('Purged:', JSON.stringify(counts))
console.log('Remaining users:', users.map((u) => `${u.email} (${u.role})`).join(', ') || 'none')
console.log('Departments kept:', await db.department.count())
await db.$disconnect()
