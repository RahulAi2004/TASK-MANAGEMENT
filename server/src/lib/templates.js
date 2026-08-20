// Create a Task from a TaskTemplate. Shared by the manual "instantiate" endpoint and
// (Phase 2) the business-event automation engine, so task-generation stays consistent.
import { db } from './db.js'
import { addDependency } from './dependencies.js'

// Year-scoped human task number, e.g. TASK-2026-00128 (same scheme as manual create).
export async function nextTaskNo() {
  const year = new Date().getFullYear()
  const count = await db.task.count({ where: { taskNo: { startsWith: `TASK-${year}-` } } })
  return `TASK-${year}-${String(count + 128).padStart(5, '0')}`
}

// template : a TaskTemplate row
// opts     : { entityId, entityType?, assignedUserId?, createdById, dueAt? }
export async function createTaskFromTemplate(template, opts) {
  const { entityId, entityType, assignedUserId, createdById, dueAt } = opts

  let checklist = []
  try { checklist = JSON.parse(template.checklistJson || '[]') } catch { checklist = [] }

  const assignee = assignedUserId ? await db.user.findUnique({ where: { id: assignedUserId } }) : null
  const departmentId = template.departmentId ?? assignee?.departmentId ?? undefined
  const computedDue = dueAt
    ? new Date(dueAt)
    : (template.slaHours != null ? new Date(Date.now() + template.slaHours * 3600_000) : undefined)

  const taskNo = await nextTaskNo()
  const task = await db.task.create({
    data: {
      taskNo,
      title: template.name,
      description: template.description || undefined,
      entityType: entityType || template.entityType || 'System',
      entityId: entityId,
      taskType: template.taskType,
      priority: template.priority,
      status: assignee ? 'Assigned' : 'Pending',   // no assignee yet -> Pending (dependency/auto later)
      assignedUserId: assignee?.id,
      departmentId,
      createdById,
      reviewerId: template.requiresReview ? createdById : undefined,
      requiresReview: template.requiresReview,
      requiresAcceptance: template.requiresAcceptance,
      performedByType: 'User',
      dueAt: computedDue,
      estimatedMinutes: template.estimatedMinutes ?? undefined,
      metadata: JSON.stringify({ fromTemplate: template.code, aiFirstAttempt: template.aiFirstAttempt }),
      checklist: {
        create: checklist.map((c, i) => ({
          sequenceNo: i + 1,
          item: typeof c === 'string' ? c : c.item,
          isRequired: typeof c === 'string' ? true : (c.isRequired ?? true),
        })),
      },
    },
  })

  if (assignee) {
    await db.assignmentHistory.create({
      data: { taskId: task.id, assignedUserId: assignee.id, assignedById: createdById, reason: `From template ${template.code}` },
    })
  }
  await db.activity.create({
    data: { taskId: task.id, activityType: 'Created', newStatus: task.status, performedById: createdById, notes: `Created from template "${template.name}"` },
  })
  await db.taskTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 } } })

  // Auto-link a prerequisite: the same-entity task of the template's dependsOnTaskType.
  // If that predecessor isn't Completed yet, addDependency() gates this task into "Waiting".
  if (template.dependsOnTaskType) {
    const pred = await db.task.findFirst({
      where: { entityId, taskType: template.dependsOnTaskType, deletedAt: null, id: { not: task.id } },
      orderBy: { createdAt: 'desc' }, select: { id: true },
    })
    if (pred) { await addDependency(task.id, pred.id, createdById); return db.task.findUnique({ where: { id: task.id } }) }
  }
  return task
}
