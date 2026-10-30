import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole } from '../lib/auth.js'

export const groupsRouter = Router()
groupsRouter.use(authRequired)

const groupSelect = { id: true, name: true, color: true }

// Everyone sees the same groups; what each person counts inside them depends on the tasks they can see.
groupsRouter.get('/', async (_req, res) => {
  const groups = await db.taskGroup.findMany({ select: groupSelect, orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] })
  res.json({ groups })
})

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

// Same roles that can create tasks
groupsRouter.post('/', requireRole('ADMIN', 'SALES'), async (req, res) => {
  const p = CreateSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  // SQLite's unique index is case-sensitive; "design" and "Design" should still be one group
  const all = await db.taskGroup.findMany({ select: { name: true } })
  if (all.some((g) => g.name.toLowerCase() === p.data.name.toLowerCase())) {
    return res.status(409).json({ error: 'A group with that name already exists' })
  }
  const group = await db.taskGroup.create({ data: { ...p.data, createdById: req.user.id }, select: groupSelect })
  res.status(201).json({ group })
})
