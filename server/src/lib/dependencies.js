// Task dependency gating. A task with unmet prerequisites sits in "Waiting"; when every
// prerequisite is Completed it is activated (Waiting -> Assigned/Pending). Predecessor
// completion cascades to unblock dependents.
import { db } from './db.js'

const GATEABLE = ['Pending', 'Assigned', 'Accepted'] // states we may push into Waiting

// Re-evaluate one task's gate against its prerequisites; flip status + log if it changed.
export async function refreshGate(taskId, actorId = null) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { dependencies: { include: { dependsOnTask: { select: { status: true } } } } },
  })
  if (!task) return null
  const anyOpen = task.dependencies.some((d) => d.dependsOnTask.status !== 'Completed')
  let next = task.status
  if (anyOpen && GATEABLE.includes(task.status)) next = 'Waiting'
  else if (!anyOpen && task.status === 'Waiting') next = task.assignedUserId ? 'Assigned' : 'Pending'
  if (next !== task.status) {
    await db.task.update({ where: { id: taskId }, data: { status: next } })
    await db.activity.create({
      data: {
        taskId, activityType: next === 'Waiting' ? 'Waiting' : 'Activated',
        oldStatus: task.status, newStatus: next, performedById: actorId,
        notes: next === 'Waiting' ? 'Waiting on prerequisite task(s)' : 'All prerequisites completed — activated',
      },
    })
  }
  return next
}

// A prerequisite completed → re-evaluate everything waiting on it.
export async function onTaskCompleted(taskId) {
  const deps = await db.taskDependency.findMany({ where: { dependsOnTaskId: taskId }, select: { taskId: true } })
  for (const d of deps) await refreshGate(d.taskId)
}

// Create a dependency edge (idempotent), then gate the dependent. Guards against self/cycle.
export async function addDependency(taskId, dependsOnTaskId, actorId = null) {
  if (taskId === dependsOnTaskId) throw new Error('A task cannot depend on itself')
  // Cycle guard over the whole chain: walk everything the prerequisite (transitively) waits on;
  // if this task is among them, the new edge would close a loop and every task in it would wait forever.
  const seen = new Set()
  let frontier = [dependsOnTaskId]
  while (frontier.length) {
    if (frontier.includes(taskId)) throw new Error('That would create a circular dependency')
    frontier.forEach((id) => seen.add(id))
    const next = await db.taskDependency.findMany({ where: { taskId: { in: frontier } }, select: { dependsOnTaskId: true } })
    frontier = [...new Set(next.map((d) => d.dependsOnTaskId))].filter((id) => !seen.has(id))
  }
  await db.taskDependency.upsert({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    update: {}, create: { taskId, dependsOnTaskId },
  })
  return refreshGate(taskId, actorId)
}

export async function removeDependency(depId, actorId = null) {
  const dep = await db.taskDependency.findUnique({ where: { id: depId } })
  if (!dep) return null
  await db.taskDependency.delete({ where: { id: depId } })
  return refreshGate(dep.taskId, actorId)
}
