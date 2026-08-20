import { Router } from 'express'
import { z } from 'zod'
import { authRequired } from '../lib/auth.js'
import { processEvent } from '../lib/events.js'

// POST /api/events — a producer fires a business event; the automation engine creates the
// matching template tasks. Called by the CRM bridge (which watches decoinks_db) and, later,
// directly by the Decoinks software.
export const eventsRouter = Router()
eventsRouter.use(authRequired)

const Schema = z.object({
  event: z.string().min(1).max(80),
  entityType: z.string().max(60).optional(),
  entityId: z.string().min(1).max(160),
  assignedUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
})

eventsRouter.post('/', async (req, res) => {
  const p = Schema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const result = await processEvent({ ...p.data, createdById: req.user.id })
  res.status(result.created.length ? 201 : 200).json(result)
})
