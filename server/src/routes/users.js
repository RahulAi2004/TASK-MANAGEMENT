import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole, assignableRoleFilter } from '../lib/auth.js'

export const usersRouter = Router()
usersRouter.use(authRequired)

const ROLE_COLOR = { ADMIN: '#2564CF', SALES: '#0F7B6C', DESIGNER: '#5B4BE6', IT: '#605E5C' }

// Admin-only: invite / create a user
const InviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'SALES', 'DESIGNER', 'IT']),
  title: z.string().max(80).optional(),
  departmentId: z.string().optional(),
  password: z.string().min(6).optional(),
})

usersRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const parsed = InviteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' })
  const { name, email, role, title, departmentId, password } = parsed.data

  const exists = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (exists) return res.status(409).json({ error: 'A user with that email already exists' })

  const tempPassword = password || 'Welcome@123'
  const user = await db.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      role,
      title: title || role[0] + role.slice(1).toLowerCase(),
      color: ROLE_COLOR[role],
      departmentId: departmentId || undefined,
      passwordHash: bcrypt.hashSync(tempPassword, 10),
    },
    select: { id: true, name: true, email: true, role: true, title: true, color: true },
  })
  res.status(201).json({ user, tempPassword })
})

// GET /api/users?assignable=1 — people the current user may assign tasks to,
// with workload hints ("6 open · 2 due today").
usersRouter.get('/', async (req, res) => {
  const wantAssignable = req.query.assignable === '1'
  let where = {}
  if (wantAssignable) {
    const filter = assignableRoleFilter(req.user.role)
    if (filter === null) return res.json({ users: [] })
    where = filter
  } else if (req.user.role !== 'ADMIN') {
    // Only admin can browse the full directory
    return res.status(403).json({ error: 'Forbidden' })
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, title: true, color: true,
      department: { select: { code: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)

  const enriched = await Promise.all(
    users.map(async (u) => {
      const open = await db.task.count({
        where: { assignedUserId: u.id, status: { notIn: ['Completed', 'Cancelled'] }, deletedAt: null },
      })
      const dueToday = await db.task.count({
        where: {
          assignedUserId: u.id, status: { notIn: ['Completed', 'Cancelled'] },
          dueAt: { gte: startOfDay, lte: endOfDay }, deletedAt: null,
        },
      })
      const overdue = await db.task.count({
        where: {
          assignedUserId: u.id, status: { notIn: ['Completed', 'Cancelled', 'Submitted'] },
          dueAt: { lt: new Date() }, deletedAt: null,
        },
      })
      return { ...u, openTasks: open, dueToday, overdue }
    })
  )
  res.json({ users: enriched })
})

// Admin-only: full workload board data
usersRouter.get('/workload', requireRole('ADMIN'), async (_req, res) => {
  const users = await db.user.findMany({
    select: {
      id: true, name: true, role: true, title: true, color: true,
      department: { select: { code: true, name: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
  const rows = await Promise.all(
    users.map(async (u) => {
      const [open, inProgress, overdue, completedToday] = await Promise.all([
        db.task.count({ where: { assignedUserId: u.id, status: { notIn: ['Completed', 'Cancelled'] }, deletedAt: null } }),
        db.task.count({ where: { assignedUserId: u.id, status: 'In Progress', deletedAt: null } }),
        db.task.count({
          where: {
            assignedUserId: u.id, status: { notIn: ['Completed', 'Cancelled', 'Submitted'] },
            dueAt: { lt: new Date() }, deletedAt: null,
          },
        }),
        db.task.count({
          where: {
            assignedUserId: u.id, status: 'Completed',
            completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ])
      return { ...u, openTasks: open, inProgress, overdue, completedToday, capacity: 8 }
    })
  )
  res.json({ workload: rows })
})
