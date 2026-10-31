// Editable dropdown lists: type of work, category, linked to, reason for delay.
// Tasks store the chosen text itself, so hiding an option never changes an existing task.
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole } from '../lib/auth.js'

export const optionsRouter = Router()
optionsRouter.use(authRequired)

const LISTS = ['workType', 'category', 'linkedTo', 'delayReason']
// The app itself relies on these (defaults and "order" handling), so they can't be hidden.
const LOCKED = {
  workType: ['General'],
  category: ['General', 'Order Related'],
  linkedTo: ['General', 'Sales Order'],
  delayReason: ['Other'],
}
const isLocked = (o) => LOCKED[o.list]?.includes(o.value) ?? false
const toJson = (o) => ({ id: o.id, list: o.list, value: o.value, isActive: o.isActive, locked: isLocked(o) })

/** Used to validate saved values. Hidden options still count: an older task may be re-saved with one. */
export async function optionExists(list, value) {
  return Boolean(await db.taskOption.findUnique({ where: { list_value: { list, value } } }))
}

optionsRouter.get('/', async (_req, res) => {
  const rows = await db.taskOption.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  res.json({ options: rows.map(toJson) })
})

const AddSchema = z.object({
  list: z.enum(LISTS),
  value: z.string().trim().min(1, 'Type a name for the option').max(60),
})

// Same roles that can create tasks
optionsRouter.post('/', requireRole('ADMIN', 'SALES'), async (req, res) => {
  const p = AddSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const { list, value } = p.data

  // "qa review" and "QA Review" are one option: reuse it (and bring it back if it was hidden).
  const rows = await db.taskOption.findMany({ where: { list } })
  const same = rows.find((o) => o.value.toLowerCase() === value.toLowerCase())
  if (same) {
    const option = same.isActive ? same : await db.taskOption.update({ where: { id: same.id }, data: { isActive: true } })
    return res.json({ option: toJson(option) })
  }
  const sortOrder = rows.reduce((max, o) => Math.max(max, o.sortOrder), 0) + 1
  const option = await db.taskOption.create({ data: { list, value, sortOrder, createdById: req.user.id } })
  res.status(201).json({ option: toJson(option) })
})

const UpdateSchema = z.object({ isActive: z.boolean() })

optionsRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const p = UpdateSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'Invalid payload' })
  const option = await db.taskOption.findUnique({ where: { id: req.params.id } })
  if (!option) return res.status(404).json({ error: 'Option not found' })
  if (isLocked(option) && !p.data.isActive) return res.status(422).json({ error: `"${option.value}" is needed by the app and can't be hidden` })
  const updated = await db.taskOption.update({ where: { id: option.id }, data: { isActive: p.data.isActive } })
  res.json({ option: toJson(updated) })
})
