import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, assignableRoleFilter, requireRole } from '../lib/auth.js'
import { canPerform } from '../lib/stateMachine.js'
import { addDependency, removeDependency, onTaskCompleted } from '../lib/dependencies.js'
import { runArtworkAnalysis } from '../lib/ai.js'

export const tasksRouter = Router()
tasksRouter.use(authRequired)

const userSelect = { select: { id: true, name: true, role: true, title: true, color: true } }
// Artworks travel with a task everywhere, but the thumbnail only on the detail: a list of 100
// tasks would otherwise carry 100 base64 previews. Apps with vault access (Design Studio) render
// the live thumbnail from assetId instead.
const artworkListSelect = { select: { id: true, assetId: true, fileName: true, artworkCode: true, customerName: true, folder: true } }
const listInclude = {
  assignedUser: userSelect,
  createdBy: userSelect,
  department: { select: { code: true, name: true } },
  artworks: artworkListSelect,
}

/** Visibility scoping: ADMIN sees all; everyone else sees assigned-to-me or created-by-me. */
function visibilityWhere(user) {
  if (user.role === 'ADMIN') return {}
  return { OR: [{ assignedUserId: user.id }, { createdById: user.id }] }
}

/** One row per vault asset — a picker that emits the same file twice must not fail the create. */
function dedupeArtworks(list = []) {
  const seen = new Set()
  return list.filter((a) => (seen.has(a.assetId) ? false : seen.add(a.assetId)))
}

// ── Stats (role-scoped dashboard cards) ──────────────────────────────────────
// actionType narrows the cards the same way it narrows the list, so a client that
// only shows human tasks (Design Studio does) does not count machine work in them.
tasksRouter.get('/stats', async (req, res) => {
  const { actionType } = req.query
  const base = {
    ...visibilityWhere(req.user),
    deletedAt: null,
    ...(['A', 'H', 'G'].includes(actionType) ? { actionType } : {}),
  }
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0))
  const [assigned, inProgress, waiting, submitted, completedToday, overdue, total] = await Promise.all([
    db.task.count({ where: { ...base, status: { in: ['Assigned', 'Accepted'] } } }),
    db.task.count({ where: { ...base, status: 'In Progress' } }),
    db.task.count({ where: { ...base, status: { in: ['Waiting', 'On Hold'] } } }),
    db.task.count({ where: { ...base, status: 'Submitted' } }),
    db.task.count({ where: { ...base, status: 'Completed', completedAt: { gte: startOfDay } } }),
    db.task.count({
      where: {
        ...base, status: { notIn: ['Completed', 'Cancelled', 'Submitted'] },
        dueAt: { lt: new Date() },
      },
    }),
    db.task.count({ where: base }),
  ])
  res.json({ stats: { assigned, inProgress, waiting, submitted, completedToday, overdue, total } })
})

// Filter values that cover several statuses (match the dashboard stat cards).
const STATUS_GROUPS = { Assigned: ['Assigned', 'Accepted'], 'Waiting / On Hold': ['Waiting', 'On Hold'] }

// ── List ─────────────────────────────────────────────────────────────────────
// scope: mine (assigned to me) | team (assigned to others, admin) | delegated (created by me, assigned to others) | all (admin)
tasksRouter.get('/', async (req, res) => {
  const { scope = 'mine', status, q, priority, actionType, departmentId, assignedUserId, from, to, limit } = req.query
  let where = { deletedAt: null }

  if (scope === 'all') {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admin can view all tasks' })
  } else if (scope === 'team') {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admin can view team tasks' })
    // Tasks handled by the team — i.e. assigned to someone other than me
    where = { ...where, assignedUserId: { not: req.user.id } }
  } else if (scope === 'delegated') {
    where = { ...where, createdById: req.user.id, NOT: { assignedUserId: req.user.id } }
  } else {
    where = { ...where, assignedUserId: req.user.id }
  }

  if (status) {
    if (status === 'Overdue') {
      where = { ...where, status: { notIn: ['Completed', 'Cancelled', 'Submitted'] }, dueAt: { lt: new Date() } }
    } else if (STATUS_GROUPS[status]) {
      where = { ...where, status: { in: STATUS_GROUPS[status] } }
    } else {
      where = { ...where, status }
    }
  }
  if (priority) where = { ...where, priority }
  if (actionType && ['A', 'H', 'G'].includes(actionType)) where = { ...where, actionType }
  if (departmentId) where = { ...where, departmentId }
  // Owner filter only widens/narrows within the admin's org-wide scopes; "mine" is already pinned.
  if (assignedUserId && req.user.role === 'ADMIN' && scope !== 'mine') where = { ...where, assignedUserId }
  const fromTs = from ? new Date(from) : null
  const toTs = to ? new Date(to) : null
  if ((fromTs && !isNaN(fromTs)) || (toTs && !isNaN(toTs))) {
    where = { ...where, createdAt: { ...(fromTs && !isNaN(fromTs) ? { gte: fromTs } : {}), ...(toTs && !isNaN(toTs) ? { lt: toTs } : {}) } }
  }
  if (q) {
    where = {
      ...where,
      // metadata holds customerName (JSON string), so a substring match finds customers too
      OR: [{ title: { contains: q } }, { taskNo: { contains: q } }, { entityId: { contains: q } }, { metadata: { contains: q } }],
    }
  }

  const take = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const tasks = await db.task.findMany({
    where,
    include: listInclude,
    // soonest deadline first; tasks without a due date go to the end, newest first
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take,
  })
  res.json({ tasks })
})

// ── Detail ───────────────────────────────────────────────────────────────────
tasksRouter.get('/:id', async (req, res) => {
  const task = await db.task.findFirst({
    where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null },
    include: {
      ...listInclude,
      reviewer: userSelect,
      checklist: { orderBy: { sequenceNo: 'asc' } },
      comments: { where: { deletedAt: null }, include: { commentedBy: userSelect }, orderBy: { createdAt: 'asc' } },
      activity: { include: { performedBy: userSelect }, orderBy: { createdAt: 'desc' } },
      history: { include: { assignedUser: userSelect }, orderBy: { assignedAt: 'asc' } },
      voiceNotes: { include: { recordedBy: userSelect }, orderBy: { sequenceNo: 'asc' } },
      aiRuns: { orderBy: { createdAt: 'desc' } },
      dependencies: { include: { dependsOnTask: { select: { id: true, taskNo: true, title: true, status: true } } } },
      dependents: { include: { task: { select: { id: true, taskNo: true, title: true, status: true } } } },
      files: { select: { id: true, fileName: true, fileType: true, kind: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      artworks: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

// An artwork sent over from the vault. thumbData is a small preview, not the file — the original
// stays in Nextcloud and is re-opened through assetId.
const ArtworkSchema = z.object({
  assetId: z.string().min(1).max(120),
  fileName: z.string().min(1).max(255),
  artworkCode: z.string().max(120).optional(),
  customerName: z.string().max(255).optional(),
  folder: z.string().max(255).optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  thumbData: z.string().regex(/^data:image\//, 'Thumbnail must be an image data URL').max(400_000).optional(),
  sourceApp: z.string().max(60).default('design-studio'),
})

// ── Create ───────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  taskType: z.string().min(1),
  actionType: z.enum(['A', 'H', 'G']).default('H'),  // A = Automatic/AI · H = Human · G = Validation Gate
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']).default('Medium'),
  assignedUserId: z.string().min(1),
  dueAt: z.string().datetime().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  requiresAcceptance: z.boolean().default(false),
  affectedSystem: z.string().optional(),
  customerName: z.string().max(160).optional(),
  routineTaskId: z.string().optional(),
  category: z.enum(['Order Related', 'General']).optional(),
  voiceNote: z.string().regex(/^data:audio\//, 'Voice note must be an audio data URL').max(14_000_000).optional(),
  voiceTranscript: z.string().max(4000).optional(),
  voiceNotes: z
    .array(
      z.object({
        audioData: z.string().regex(/^data:audio\//, 'Voice note must be an audio data URL').max(14_000_000),
        transcript: z.string().max(4000).optional(),
      })
    )
    .max(5, 'At most 5 voice notes per task')
    .default([]),
  checklist: z.array(z.object({ item: z.string().min(1), isRequired: z.boolean().default(true) })).default([]),
  artworks: z.array(ArtworkSchema).max(24, 'At most 24 artworks per task').default([]),
})

tasksRouter.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' })
  }
  const data = parsed.data

  // RBAC: may this user assign to that person?
  const roleFilter = assignableRoleFilter(req.user.role)
  if (roleFilter === null) return res.status(403).json({ error: 'Your role cannot create tasks for others' })
  const assignee = await db.user.findFirst({ where: { id: data.assignedUserId, ...roleFilter } })
  if (!assignee) return res.status(403).json({ error: 'You are not allowed to assign tasks to this user' })

  // Routine task: route to its department and snapshot its SLA thresholds onto the task.
  let routine = null
  if (data.routineTaskId) {
    routine = await db.routineTask.findFirst({ where: { id: data.routineTaskId, isActive: true } })
    if (!routine) return res.status(400).json({ error: 'Routine task not found or inactive' })
  }

  // Year-scoped human number
  const year = new Date().getFullYear()
  const count = await db.task.count({ where: { taskNo: { startsWith: `TASK-${year}-` } } })
  const taskNo = `TASK-${year}-${String(count + 108 + 20).padStart(5, '0')}`

  const task = await db.task.create({
    data: {
      taskNo,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      taskType: data.taskType,
      actionType: data.actionType,
      priority: data.priority,
      status: 'Assigned',
      assignedUserId: assignee.id,
      departmentId: routine?.departmentId ?? assignee.departmentId ?? undefined,
      routineTaskId: routine?.id,
      slaCriticalMinutes: routine?.criticalMinutes,
      slaDelayedMinutes: routine?.delayedMinutes,
      createdById: req.user.id,
      reviewerId: req.user.id,
      requiresAcceptance: data.requiresAcceptance,
      affectedSystem: data.affectedSystem,
      metadata: data.customerName || data.category
        ? JSON.stringify({ ...(data.customerName ? { customerName: data.customerName } : {}), ...(data.category ? { category: data.category } : {}) })
        : undefined,
      voiceNote: data.voiceNote,
      voiceTranscript: data.voiceNote ? data.voiceTranscript : undefined,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      estimatedMinutes: data.estimatedMinutes ?? routine?.normalMinutes,
      checklist: {
        create: data.checklist.map((c, i) => ({ sequenceNo: i + 1, item: c.item, isRequired: c.isRequired })),
      },
      voiceNotes: {
        create: data.voiceNotes.map((v, i) => ({ sequenceNo: i + 1, audioData: v.audioData, transcript: v.transcript, fileName: `Recording ${i + 1}`, recordedById: req.user.id })),
      },
      // Same file sent twice in one payload is one attachment — the unique index would
      // otherwise reject the whole task over a double-click in the picker.
      artworks: {
        create: dedupeArtworks(data.artworks).map((a) => ({ ...a, addedById: req.user.id })),
      },
    },
    include: listInclude,
  })
  await db.assignmentHistory.create({
    data: { taskId: task.id, assignedUserId: assignee.id, assignedById: req.user.id, reason: 'Initial assignment' },
  })
  await db.activity.create({
    data: { taskId: task.id, activityType: 'Created', newStatus: 'Assigned', performedById: req.user.id },
  })
  res.status(201).json({ task })
})

// ── Delete ───────────────────────────────────────────────────────────────────
// Soft delete: `deletedAt` already hides a task from every list, detail and count in
// this API, and keeping the row preserves the history, comments and the artwork trail
// that the activity log refers to. Admin only — a task someone spent hours on must not
// disappear because its creator changed their mind.
tasksRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const reason = String(req.body?.reason || '').slice(0, 500).trim()
  await db.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } })
  await db.activity.create({
    data: {
      taskId: task.id, activityType: 'Deleted', oldStatus: task.status,
      performedById: req.user.id, notes: reason || 'Deleted by administrator',
    },
  })
  res.json({ ok: true, taskNo: task.taskNo })
})

// ── Transition (state machine) ───────────────────────────────────────────────
const TransitionSchema = z.object({
  event: z.string(),
  notes: z.string().max(2000).optional(),
  completionSummary: z.string().max(2000).optional(),
})

tasksRouter.post('/:id/transition', async (req, res) => {
  const parsed = TransitionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const { event, notes, completionSummary } = parsed.data

  const task = await db.task.findFirst({
    where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null },
    include: { checklist: true },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })

  // Dependency gate: a task waiting on unfinished prerequisites cannot be started/resumed.
  if (['start', 'resume', 'accept'].includes(event) && task.status === 'Waiting') {
    const open = await db.taskDependency.count({ where: { taskId: task.id, dependsOnTask: { status: { not: 'Completed' } } } })
    if (open > 0) return res.status(422).json({ error: `Waiting on ${open} prerequisite task(s) — finish those first` })
  }

  const check = canPerform(event, task, req.user)
  if (!check.ok) return res.status(422).json({ error: check.error })
  const t = check.transition

  // Guard: submitting requires all required checklist items done
  if (event === 'submit') {
    const missing = task.checklist.filter((c) => c.isRequired && !c.isCompleted)
    if (missing.length > 0) {
      return res.status(422).json({ error: `Complete required checklist items first (${missing.length} remaining)` })
    }
  }

  const patch = { status: t.to }
  const nowTs = new Date()
  if (event === 'start') patch.startedAt = task.startedAt ?? nowTs
  if (event === 'submit') {
    patch.submittedAt = nowTs
    if (completionSummary) patch.completionSummary = completionSummary
  }
  if (event === 'approve') patch.completedAt = nowTs

  const updated = await db.task.update({ where: { id: task.id }, data: patch, include: listInclude })
  await db.activity.create({
    data: {
      taskId: task.id, activityType: t.activityType,
      oldStatus: task.status, newStatus: t.to,
      performedById: req.user.id, notes,
    },
  })
  // Completing a task unblocks anything waiting on it.
  if (t.to === 'Completed') await onTaskCompleted(task.id)
  res.json({ task: updated })
})

// ── Assign / Reassign ────────────────────────────────────────────────────────
const AssignSchema = z.object({
  assignedUserId: z.string().min(1),
  reason: z.string().max(500).optional(),
})
tasksRouter.post('/:id/assign', async (req, res) => {
  const p = AssignSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const task = await db.task.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  // Only an admin or the task creator (delegator) may (re)assign.
  if (!(req.user.role === 'ADMIN' || task.createdById === req.user.id))
    return res.status(403).json({ error: 'Only an admin or the task creator can assign this task' })
  const roleFilter = assignableRoleFilter(req.user.role)
  if (roleFilter === null) return res.status(403).json({ error: 'Your role cannot assign tasks' })
  const assignee = await db.user.findFirst({ where: { id: p.data.assignedUserId, ...roleFilter } })
  if (!assignee) return res.status(403).json({ error: 'You are not allowed to assign to this user' })

  const prev = task.assignedUserId
  // A never-started Pending task becomes Assigned; Waiting stays Waiting (the gate still holds,
  // it activates to Assigned when prerequisites clear); active/finished statuses are unchanged.
  const status = task.status === 'Pending' ? 'Assigned' : task.status
  const updated = await db.task.update({
    where: { id: task.id },
    data: { assignedUserId: assignee.id, departmentId: assignee.departmentId ?? task.departmentId, status },
    include: listInclude,
  })
  await db.assignmentHistory.create({
    data: { taskId: task.id, previousUserId: prev, assignedUserId: assignee.id, assignedById: req.user.id, reason: p.data.reason || (prev ? 'Reassigned' : 'Assigned') },
  })
  await db.activity.create({
    data: { taskId: task.id, activityType: prev ? 'Reassigned' : 'Assigned', oldStatus: task.status, newStatus: status, performedById: req.user.id, notes: `${prev ? 'Reassigned' : 'Assigned'} to ${assignee.name}${p.data.reason ? ' — ' + p.data.reason : ''}` },
  })
  db.notification.create({ data: { userId: assignee.id, taskId: task.id, type: 'System', message: `You were assigned ${task.taskNo}: ${task.title}` } }).catch(() => {})
  res.json({ task: updated })
})

// ── Files / attachments ──────────────────────────────────────────────────────
const FileSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().max(120).optional(),
  kind: z.enum(['attachment', 'result', 'reference']).default('attachment'),
  dataUrl: z.string().regex(/^data:/, 'Must be a data URL').max(30_000_000),
})
tasksRouter.post('/:id/files', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const p = FileSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid file' })
  const sizeBytes = Math.floor((p.data.dataUrl.length * 3) / 4)
  const f = await db.taskFile.create({ data: { taskId: task.id, fileName: p.data.fileName, fileType: p.data.fileType, kind: p.data.kind, dataUrl: p.data.dataUrl, sizeBytes, uploadedById: req.user.id } })
  await db.activity.create({ data: { taskId: task.id, activityType: 'FileAdded', performedById: req.user.id, notes: `Attached ${p.data.fileName}` } })
  const { dataUrl, ...meta } = f
  res.status(201).json({ file: meta })
})
// Fetch one file's bytes (for download / preview) — kept out of the list to avoid bloat.
tasksRouter.get('/:id/files/:fileId', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const f = await db.taskFile.findFirst({ where: { id: req.params.fileId, taskId: task.id } })
  if (!f) return res.status(404).json({ error: 'File not found' })
  res.json({ file: f })
})
tasksRouter.delete('/:id/files/:fileId', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  try { await db.taskFile.delete({ where: { id: req.params.fileId } }); res.json({ ok: true }) }
  catch { res.status(404).json({ error: 'File not found' }) }
})

// ── Vault artworks (sent over from Design Studio) ────────────────────────────
// Adding artwork to a task that already exists — the create path takes them inline.
tasksRouter.post('/:id/artworks', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const p = z.object({ artworks: z.array(ArtworkSchema).min(1).max(24) }).safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid artwork' })

  const wanted = dedupeArtworks(p.data.artworks)
  const existing = await db.taskArtwork.findMany({ where: { taskId: task.id }, select: { assetId: true } })
  const have = new Set(existing.map((a) => a.assetId))
  const fresh = wanted.filter((a) => !have.has(a.assetId))
  if (fresh.length) {
    await db.taskArtwork.createMany({ data: fresh.map((a) => ({ ...a, taskId: task.id, addedById: req.user.id })) })
    await db.activity.create({
      data: {
        taskId: task.id, activityType: 'FileAdded', performedById: req.user.id,
        notes: `Attached ${fresh.length} artwork${fresh.length > 1 ? 's' : ''} from the vault: ${fresh.map((a) => a.fileName).join(', ')}`,
      },
    })
  }
  const artworks = await db.taskArtwork.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } })
  res.status(201).json({ artworks, added: fresh.length, skipped: wanted.length - fresh.length })
})

tasksRouter.delete('/:id/artworks/:artworkId', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const removed = await db.taskArtwork.deleteMany({ where: { id: req.params.artworkId, taskId: task.id } })
  if (!removed.count) return res.status(404).json({ error: 'Artwork not found' })
  res.json({ ok: true })
})

// ── AI first attempt (Artwork Analyzer) ──────────────────────────────────────
tasksRouter.post('/:id/ai/analyze', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  try { const aiRun = await runArtworkAnalysis(task.id, req.user.id); res.status(201).json({ aiRun }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Dependencies (task waits on prerequisite tasks) ──────────────────────────
tasksRouter.post('/:id/dependencies', async (req, res) => {
  const dependsOnTaskId = String(req.body?.dependsOnTaskId || '')
  if (!dependsOnTaskId) return res.status(400).json({ error: 'dependsOnTaskId required' })
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const pred = await db.task.findFirst({ where: { id: dependsOnTaskId, deletedAt: null } })
  if (!pred) return res.status(404).json({ error: 'Prerequisite task not found' })
  try { const status = await addDependency(task.id, dependsOnTaskId, req.user.id); res.status(201).json({ ok: true, status }) }
  catch (e) { res.status(422).json({ error: e.message }) }
})

tasksRouter.delete('/:id/dependencies/:depId', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const status = await removeDependency(req.params.depId, req.user.id)
  if (status == null) return res.status(404).json({ error: 'Dependency not found' })
  res.json({ ok: true, status })
})

// ── Status note: current issue + reason for delay (Task Detail panel) ────────
// Stored in task.metadata (JSON) alongside customerName/category; every save is audited.
const DELAY_REASONS = [
  'Waiting on customer', 'Waiting on another department', 'Missing information / files',
  'Rework requested', 'Technical / system issue', 'High workload', 'Other',
]
const NoteSchema = z.object({
  currentStatus: z.string().max(500).optional(),
  delayReason: z.enum(DELAY_REASONS).optional(),
  delayRemarks: z.string().max(500).optional(),
})
tasksRouter.patch('/:id/notes', async (req, res) => {
  const p = NoteSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid payload' })
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  if (p.data.delayReason && !p.data.delayRemarks?.trim()) return res.status(400).json({ error: 'Remarks are required with a delay reason' })

  let meta = {}
  try { meta = JSON.parse(task.metadata || '{}') } catch { meta = {} }
  const notes = []
  if (p.data.currentStatus !== undefined) {
    meta.currentStatus = p.data.currentStatus.trim()
    notes.push(`Current status: ${meta.currentStatus || '(cleared)'}`)
  }
  if (p.data.delayReason) {
    meta.delay = { reason: p.data.delayReason, remarks: p.data.delayRemarks.trim(), at: new Date().toISOString(), byId: req.user.id, byName: req.user.name }
    notes.push(`Delay reason: ${p.data.delayReason} — ${meta.delay.remarks}`)
  }
  if (!notes.length) return res.status(400).json({ error: 'Nothing to update' })

  const updated = await db.task.update({ where: { id: task.id }, data: { metadata: JSON.stringify(meta) }, include: listInclude })
  await db.activity.create({ data: { taskId: task.id, activityType: p.data.delayReason ? 'DelayReported' : 'StatusNote', performedById: req.user.id, notes: notes.join(' · ') } })
  res.json({ task: updated })
})

// ── Recordings (voice notes added after creation) ────────────────────────────
const VoiceSchema = z.object({
  audioData: z.string().regex(/^data:audio\//, 'Recording must be an audio data URL').max(14_000_000, 'Recording must be under 10 MB'),
  transcript: z.string().max(4000).optional(),
  fileName: z.string().max(160).optional(),
  durationSeconds: z.number().int().min(0).max(36_000).optional(),
})
tasksRouter.post('/:id/voice-notes', async (req, res) => {
  const p = VoiceSchema.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid recording' })
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const last = await db.taskVoiceNote.findFirst({ where: { taskId: task.id }, orderBy: { sequenceNo: 'desc' }, select: { sequenceNo: true } })
  const sequenceNo = (last?.sequenceNo || 0) + 1
  const note = await db.taskVoiceNote.create({
    data: {
      taskId: task.id, sequenceNo, audioData: p.data.audioData, transcript: p.data.transcript,
      fileName: p.data.fileName || `Recording ${sequenceNo}`, durationSeconds: p.data.durationSeconds, recordedById: req.user.id,
    },
    include: { recordedBy: userSelect },
  })
  await db.activity.create({ data: { taskId: task.id, activityType: 'RecordingAdded', performedById: req.user.id, notes: `Added recording ${note.fileName}` } })
  res.status(201).json({ voiceNote: note })
})
tasksRouter.delete('/:id/voice-notes/:noteId', async (req, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null } })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const note = await db.taskVoiceNote.findFirst({ where: { id: req.params.noteId, taskId: task.id } })
  if (!note) return res.status(404).json({ error: 'Recording not found' })
  // Only the person who recorded it, the task creator, or an admin may remove a recording.
  if (!(req.user.role === 'ADMIN' || task.createdById === req.user.id || note.recordedById === req.user.id))
    return res.status(403).json({ error: 'You cannot delete this recording' })
  await db.taskVoiceNote.delete({ where: { id: note.id } })
  await db.activity.create({ data: { taskId: task.id, activityType: 'RecordingRemoved', performedById: req.user.id, notes: `Removed recording ${note.fileName || '#' + note.sequenceNo}` } })
  res.json({ ok: true })
})

// ── Comments ─────────────────────────────────────────────────────────────────
tasksRouter.post('/:id/comments', async (req, res) => {
  const text = String(req.body?.commentText || '').trim()
  const audioData = typeof req.body?.audioData === 'string' ? req.body.audioData : null
  const audioTranscript =
    typeof req.body?.audioTranscript === 'string' ? req.body.audioTranscript.slice(0, 4000).trim() || null : null
  if (!text && !audioData) return res.status(400).json({ error: 'Comment text or voice note required' })
  if (audioData && (!audioData.startsWith('data:audio/') || audioData.length > 14_000_000)) {
    return res.status(400).json({ error: 'Voice note must be an audio data URL under 10MB' })
  }
  const task = await db.task.findFirst({
    where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const comment = await db.comment.create({
    data: {
      taskId: task.id,
      commentText: text || (audioData ? '🎤 Voice note' : ''),
      audioData,
      audioTranscript: audioData ? audioTranscript : null,
      commentedById: req.user.id,
    },
    include: { commentedBy: userSelect },
  })
  res.status(201).json({ comment })
})

// ── Manual reminder (creator/reviewer/admin nudges the assignee) ─────────────
tasksRouter.post('/:id/remind', async (req, res) => {
  const task = await db.task.findFirst({
    where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const mayRemind = req.user.role === 'ADMIN' || task.createdById === req.user.id || task.reviewerId === req.user.id
  if (!mayRemind) return res.status(403).json({ error: 'Only the task creator, reviewer or admin can send reminders' })
  if (!task.assignedUserId) return res.status(422).json({ error: 'Task has no assignee to remind' })
  if (task.assignedUserId === req.user.id) return res.status(422).json({ error: 'Task is assigned to you' })

  await db.notification.create({
    data: {
      userId: task.assignedUserId,
      taskId: task.id,
      type: 'Reminder',
      message: `${req.user.name} sent you a reminder: ${task.taskNo} "${task.title}"${task.dueAt && task.dueAt < new Date() ? ' is overdue' : ''}`,
    },
  })
  res.json({ ok: true })
})

// ── Checklist toggle ─────────────────────────────────────────────────────────
tasksRouter.patch('/:id/checklist/:itemId', async (req, res) => {
  const task = await db.task.findFirst({
    where: { id: req.params.id, ...visibilityWhere(req.user), deletedAt: null },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const done = Boolean(req.body?.isCompleted)
  const item = await db.checklistItem.update({
    where: { id: req.params.itemId },
    data: {
      isCompleted: done,
      completedById: done ? req.user.id : null,
      completedAt: done ? new Date() : null,
    },
  })
  res.json({ item })
})
