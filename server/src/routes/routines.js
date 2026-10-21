// Routine tasks — reusable task definitions with SLA rules (Task Settings modal).
// Read: any signed-in user (the Create Task panel lists active ones). Write: admin only.
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole } from '../lib/auth.js'

export const routinesRouter = Router()
routinesRouter.use(authRequired)

const include = {
  department: { select: { id: true, name: true, code: true } },
  template: { select: { id: true, name: true, code: true, taskType: true, checklistJson: true, isActive: true } },
}

const Base = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(120),
  description: z.string().max(500).optional().nullable(),
  departmentId: z.string().min(1, 'Department is required'),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']).default('Medium'),
  normalMinutes: z.number().int().min(1, 'Normal time must be at least 1 minute').max(43_200),
  criticalMinutes: z.number().int().min(1).max(43_200),
  delayedMinutes: z.number().int().min(1).max(43_200),
  templateId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})
// The SLA timeline must escalate: Normal ≤ Critical < Delayed.
const ordered = (d) => d.normalMinutes <= d.criticalMinutes && d.criticalMinutes < d.delayedMinutes
const ORDER_MSG = 'SLA timeline must escalate: Normal ≤ Critical < Delayed'

async function checkRefs(d) {
  if (d.departmentId && !(await db.department.findUnique({ where: { id: d.departmentId } }))) return 'Department not found'
  if (d.templateId && !(await db.taskTemplate.findUnique({ where: { id: d.templateId } }))) return 'Template not found'
  return null
}
const isUniqueViolation = (e) => e?.code === 'P2002'
const DUP_MSG = 'A routine task with that title already exists in this department'

routinesRouter.get('/', async (req, res) => {
  const routines = await db.routineTask.findMany({
    where: req.query.active === '1' ? { isActive: true } : {},
    include,
    orderBy: [{ title: 'asc' }],
  })
  res.json({ routines })
})

routinesRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const p = Base.refine(ordered, ORDER_MSG).safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const refErr = await checkRefs(p.data)
  if (refErr) return res.status(400).json({ error: refErr })
  try {
    const routine = await db.routineTask.create({
      data: { ...p.data, description: p.data.description || null, templateId: p.data.templateId || null, createdById: req.user.id },
      include,
    })
    res.status(201).json({ routine })
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: DUP_MSG })
    console.error(e)
    res.status(500).json({ error: 'Could not save routine task' })
  }
})

routinesRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const existing = await db.routineTask.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Routine task not found' })
  const p = Base.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const merged = { ...existing, ...p.data }
  if (!ordered(merged)) return res.status(400).json({ error: ORDER_MSG })
  const refErr = await checkRefs(p.data)
  if (refErr) return res.status(400).json({ error: refErr })
  const data = { ...p.data }
  if ('description' in data) data.description = data.description || null
  if ('templateId' in data) data.templateId = data.templateId || null
  try {
    const routine = await db.routineTask.update({ where: { id: existing.id }, data, include })
    res.json({ routine })
  } catch (e) {
    if (isUniqueViolation(e)) return res.status(409).json({ error: DUP_MSG })
    console.error(e)
    res.status(500).json({ error: 'Could not save routine task' })
  }
})

// Duplicate → "Title (copy)", "Title (copy 2)", … in the same department.
routinesRouter.post('/:id/duplicate', requireRole('ADMIN'), async (req, res) => {
  const src = await db.routineTask.findUnique({ where: { id: req.params.id } })
  if (!src) return res.status(404).json({ error: 'Routine task not found' })
  const { id, createdAt, updatedAt, createdById, title, ...rest } = src
  for (let n = 1; n < 50; n++) {
    const candidate = `${title} (copy${n > 1 ? ' ' + n : ''})`.slice(0, 120)
    try {
      const routine = await db.routineTask.create({ data: { ...rest, title: candidate, createdById: req.user.id }, include })
      return res.status(201).json({ routine })
    } catch (e) {
      if (!isUniqueViolation(e)) { console.error(e); return res.status(500).json({ error: 'Could not duplicate routine task' }) }
    }
  }
  res.status(409).json({ error: 'Too many copies of this routine task' })
})

// Delete — tasks already created keep their snapshotted SLA; their link is set to null.
routinesRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await db.routineTask.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Routine task not found' })
  }
})
