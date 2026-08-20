import { Router } from 'express'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authRequired, assignableRoleFilter } from '../lib/auth.js'
import { canPerform } from '../lib/stateMachine.js'
import { addDependency, removeDependency, onTaskCompleted } from '../lib/dependencies.js'
import { runArtworkAnalysis } from '../lib/ai.js'

export const tasksRouter = Router()
tasksRouter.use(authRequired)

const userSelect = { select: { id: true, name: true, role: true, title: true, color: true } }
const listInclude = {
  assignedUser: userSelect,
  createdBy: userSelect,
  department: { select: { code: true, name: true } },
}

/** Visibility scoping: ADMIN sees all; everyone else sees assigned-to-me or created-by-me. */
function visibilityWhere(user) {
  if (user.role === 'ADMIN') return {}
  return { OR: [{ assignedUserId: user.id }, { createdById: user.id }] }
}

// ── Stats (role-scoped dashboard cards) ──────────────────────────────────────
tasksRouter.get('/stats', async (req, res) => {
  const base = { ...visibilityWhere(req.user), deletedAt: null }
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

// ── List ─────────────────────────────────────────────────────────────────────
// scope: mine (assigned to me) | team (assigned to others, admin) | delegated (created by me, assigned to others) | all (admin)
tasksRouter.get('/', async (req, res) => {
  const { scope = 'mine', status, q, priority } = req.query
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
    } else {
      where = { ...where, status }
    }
  }
  if (priority) where = { ...where, priority }
  if (q) {
    where = {
      ...where,
      OR: [{ title: { contains: q } }, { taskNo: { contains: q } }, { entityId: { contains: q } }],
    }
  }

  const tasks = await db.task.findMany({
    where,
    include: listInclude,
    orderBy: [{ dueAt: 'asc' }],
    take: 100,
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
      voiceNotes: { orderBy: { sequenceNo: 'asc' } },
      aiRuns: { orderBy: { createdAt: 'desc' } },
      dependencies: { include: { dependsOnTask: { select: { id: true, taskNo: true, title: true, status: true } } } },
      dependents: { include: { task: { select: { id: true, taskNo: true, title: true, status: true } } } },
      files: { select: { id: true, fileName: true, fileType: true, kind: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

// ── Create ───────────────────────────────────────────────────────────────────
const CreateSchema = z.object({
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  taskType: z.string().min(1),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']).default('Medium'),
  assignedUserId: z.string().min(1),
  dueAt: z.string().datetime().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  requiresAcceptance: z.boolean().default(false),
  affectedSystem: z.string().optional(),
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
      priority: data.priority,
      status: 'Assigned',
      assignedUserId: assignee.id,
      departmentId: assignee.departmentId ?? undefined,
      createdById: req.user.id,
      reviewerId: req.user.id,
      requiresAcceptance: data.requiresAcceptance,
      affectedSystem: data.affectedSystem,
      voiceNote: data.voiceNote,
      voiceTranscript: data.voiceNote ? data.voiceTranscript : undefined,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      estimatedMinutes: data.estimatedMinutes,
      checklist: {
        create: data.checklist.map((c, i) => ({ sequenceNo: i + 1, item: c.item, isRequired: c.isRequired })),
      },
      voiceNotes: {
        create: data.voiceNotes.map((v, i) => ({ sequenceNo: i + 1, audioData: v.audioData, transcript: v.transcript })),
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
