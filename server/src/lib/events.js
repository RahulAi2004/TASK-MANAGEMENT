// Business-event → task automation engine.
// A producer (the CRM bridge, or later the Decoinks software) fires an event; every ACTIVE
// template whose triggerEvent matches spawns a task. Idempotent: skips if an OPEN task of the
// same taskType already exists for that entity, so re-delivered events don't duplicate work.
import { db } from './db.js'
import { createTaskFromTemplate } from './templates.js'

export async function processEvent({ event, entityType, entityId, assignedUserId, createdById, dueAt }) {
  const templates = await db.taskTemplate.findMany({ where: { triggerEvent: event, isActive: true } })
  const created = [], skipped = []
  for (const t of templates) {
    const dupe = await db.task.findFirst({
      where: { entityId, taskType: t.taskType, status: { notIn: ['Completed', 'Cancelled'] }, deletedAt: null },
      select: { taskNo: true },
    })
    if (dupe) { skipped.push({ template: t.code, reason: 'open task already exists', taskNo: dupe.taskNo }); continue }
    // An admin deleted this record's task on purpose — a re-delivered event must not bring it back.
    const dismissed = await db.task.findFirst({
      where: { entityId, taskType: t.taskType, deletedAt: { not: null } },
      select: { taskNo: true },
    })
    if (dismissed) { skipped.push({ template: t.code, reason: 'task was deleted by an admin', taskNo: dismissed.taskNo }); continue }
    const task = await createTaskFromTemplate(t, {
      entityId, entityType: entityType || t.entityType, assignedUserId, createdById, dueAt,
    })
    created.push({ template: t.code, taskNo: task.taskNo, id: task.id })
  }
  return { event, entityId, matched: templates.length, created, skipped }
}
