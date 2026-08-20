import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, requireRole } from '../lib/auth.js'
import { createTaskFromTemplate } from '../lib/templates.js'

export const templatesRouter = Router()
templatesRouter.use(authRequired)

const codeOf = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)

const Schema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(60).optional(),
  description: z.string().max(2000).optional(),
  taskType: z.string().min(1).max(80),
  entityType: z.string().max(60).optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']).default('Medium'),
  departmentId: z.string().optional().nullable(),
  slaHours: z.number().int().min(0).max(2160).optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  requiresReview: z.boolean().default(true),
  requiresAcceptance: z.boolean().default(false),
  aiFirstAttempt: z.boolean().default(false),
  checklist: z.array(z.object({ item: z.string().min(1), isRequired: z.boolean().default(true) })).default([]),
  triggerEvent: z.string().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
})

// List — any authenticated user (the Create panel + template screen read this).
templatesRouter.get('/', async (req, res) => {
  const templates = await db.taskTemplate.findMany({
    where: req.query.active === '1' ? { isActive: true } : {},
    include: { department: { select: { id: true, name: true, code: true } } },
    orderBy: { name: 'asc' },
  })
  res.json({ templates })
})

// Create — admin only.
templatesRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const p = Schema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const d = p.data
  const code = (d.code && codeOf(d.code)) || codeOf(d.name)
  if (await db.taskTemplate.findUnique({ where: { code } })) return res.status(409).json({ error: 'A template with that code already exists' })
  const template = await db.taskTemplate.create({
    data: {
      name: d.name, code, description: d.description, taskType: d.taskType, entityType: d.entityType,
      priority: d.priority, departmentId: d.departmentId || null, slaHours: d.slaHours ?? null,
      estimatedMinutes: d.estimatedMinutes ?? null, requiresReview: d.requiresReview,
      requiresAcceptance: d.requiresAcceptance, aiFirstAttempt: d.aiFirstAttempt,
      checklistJson: JSON.stringify(d.checklist || []), triggerEvent: d.triggerEvent || null,
      isActive: d.isActive, createdById: req.user.id,
    },
  })
  res.status(201).json({ template })
})

// Update — admin only. Partial.
templatesRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const existing = await db.taskTemplate.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Template not found' })
  const p = Schema.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const d = p.data
  const data = {}
  for (const k of ['name', 'description', 'taskType', 'entityType', 'priority', 'departmentId', 'slaHours', 'estimatedMinutes', 'requiresReview', 'requiresAcceptance', 'aiFirstAttempt', 'triggerEvent', 'isActive']) {
    if (d[k] !== undefined) data[k] = k === 'departmentId' ? (d[k] || null) : d[k]
  }
  if (d.checklist !== undefined) data.checklistJson = JSON.stringify(d.checklist)
  if (d.code !== undefined) data.code = codeOf(d.code)
  const template = await db.taskTemplate.update({ where: { id: req.params.id }, data })
  res.json({ template })
})

// Delete — admin only.
templatesRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try { await db.taskTemplate.delete({ where: { id: req.params.id } }); res.json({ ok: true }) }
  catch { res.status(404).json({ error: 'Template not found' }) }
})

// Instantiate — create a real Task from this template (the "Use template" action).
const InstSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().optional(),
  assignedUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
})
templatesRouter.post('/:id/instantiate', async (req, res) => {
  const template = await db.taskTemplate.findUnique({ where: { id: req.params.id } })
  if (!template || !template.isActive) return res.status(404).json({ error: 'Template not found or inactive' })
  const p = InstSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const task = await createTaskFromTemplate(template, { ...p.data, createdById: req.user.id })
  res.status(201).json({ task })
})
