import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// Dates relative to "today" so the dashboard always looks alive.
const now = new Date()
const at = (dayOffset, h, m = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d
}

async function main() {
  // Wipe (idempotent seed)
  await db.aiRun.deleteMany()
  await db.activity.deleteMany()
  await db.comment.deleteMany()
  await db.checklistItem.deleteMany()
  await db.assignmentHistory.deleteMany()
  await db.task.deleteMany()
  await db.user.deleteMany()
  await db.department.deleteMany()

  const [design, sales, it, qa] = await Promise.all(
    [
      { code: 'DESIGN', name: 'Design Studio' },
      { code: 'SALES', name: 'Sales' },
      { code: 'IT', name: 'IT' },
      { code: 'QA', name: 'QA' },
    ].map((d) => db.department.create({ data: d }))
  )

  const hash = (p) => bcrypt.hashSync(p, 10)
  const bilal = await db.user.create({
    data: {
      email: process.env.ADMIN_EMAIL || 'info@technocas.com', name: 'Bilal Ahmed', role: 'ADMIN',
      title: 'Manager', color: '#2564CF', passwordHash: hash(process.env.ADMIN_PASSWORD || 'Admin@123'),
    },
  })
  const areeba = await db.user.create({
    data: {
      email: 'areeba@decoinks.com', name: 'Areeba Khan', role: 'SALES',
      title: 'Sales Agent', color: '#0F7B6C', departmentId: sales.id, passwordHash: hash('Sales@123'),
    },
  })
  const hassan = await db.user.create({
    data: {
      email: 'hassan@decoinks.com', name: 'Hassan Raza', role: 'DESIGNER',
      title: 'Designer', color: '#5B4BE6', departmentId: design.id, passwordHash: hash('Design@123'),
    },
  })
  const usman = await db.user.create({
    data: {
      email: 'usman@decoinks.com', name: 'Usman Tariq', role: 'IT',
      title: 'IT Support', color: '#605E5C', departmentId: it.id, passwordHash: hash('It@123'),
    },
  })

  let seq = 108
  const mkTask = async ({ creator, assignee, dept, status, activity = [], ...rest }) => {
    const taskNo = `TASK-2026-${String(seq++).padStart(5, '0')}`
    const task = await db.task.create({
      data: {
        taskNo,
        status,
        createdById: creator.id,
        assignedUserId: assignee?.id,
        departmentId: dept?.id,
        reviewerId: creator.id,
        ...rest,
      },
    })
    await db.assignmentHistory.create({
      data: {
        taskId: task.id, assignedUserId: assignee?.id, assignedById: creator.id,
        reason: 'Initial assignment',
      },
    })
    await db.activity.create({
      data: { taskId: task.id, activityType: 'Created', newStatus: 'Assigned', performedById: creator.id },
    })
    for (const a of activity) {
      await db.activity.create({ data: { taskId: task.id, ...a } })
    }
    return task
  }

  // ── Overdue pair (Admin → Hassan / QA context) ─────────────────────────────
  await mkTask({
    creator: bilal, assignee: hassan, dept: design, status: 'Assigned',
    title: 'QA Review', subtitle: 'Check quality and specs',
    entityType: 'Artwork', entityId: 'AW-2026-000120', taskType: 'QA Review',
    priority: 'High', dueAt: at(-3, 11), estimatedMinutes: 25,
  })
  seq = 115
  await mkTask({
    creator: bilal, assignee: hassan, dept: design, status: 'Assigned',
    title: 'Gangsheet Generation', subtitle: 'Nest designs on sheet',
    entityType: 'Sales Order', entityId: 'SO-2026-000340', taskType: 'Gangsheet Preparation',
    priority: 'High', dueAt: at(-2, 14), estimatedMinutes: 50,
  })

  // ── Admin → Hassan (direct) ────────────────────────────────────────────────
  seq = 118
  await mkTask({
    creator: bilal, assignee: hassan, dept: design, status: 'Assigned',
    title: 'Prepare Production Artwork', subtitle: '300 DPI, transparent BG',
    entityType: 'Sales Order', entityId: 'SO-2026-000345', taskType: 'Production Artwork',
    priority: 'High', dueAt: at(2, 10), estimatedMinutes: 60,
  })

  // ── Admin → Areeba (sales agent's own task) ────────────────────────────────
  seq = 119
  await mkTask({
    creator: bilal, assignee: areeba, dept: sales, status: 'Assigned',
    title: 'Customer Approval Follow-up', subtitle: 'Follow up for approval',
    entityType: 'Lead', entityId: 'LD-2026-000487', taskType: 'Follow-up',
    priority: 'Medium', dueAt: at(1, 16), estimatedMinutes: 15,
  })
  seq = 121
  await mkTask({
    creator: bilal, assignee: areeba, dept: sales, status: 'Completed',
    title: 'Extract Artwork', subtitle: 'Extract main design',
    entityType: 'Artwork', entityId: 'AW-2026-000123', taskType: 'Artwork Extraction',
    priority: 'Medium', dueAt: at(-1, 11), estimatedMinutes: 40,
    startedAt: at(-1, 9), submittedAt: at(-1, 10), completedAt: at(-1, 10, 30),
    completionSummary: 'Main design extracted and versioned.',
    activity: [
      { activityType: 'Started', oldStatus: 'Assigned', newStatus: 'In Progress', performedById: areeba.id },
      { activityType: 'Submitted', oldStatus: 'In Progress', newStatus: 'Submitted', performedById: areeba.id },
      { activityType: 'Approved', oldStatus: 'Submitted', newStatus: 'Completed', performedById: bilal.id },
    ],
  })

  // ── Areeba → Hassan: SUBMITTED, waiting in Areeba's approval queue ─────────
  seq = 124
  const mockup = await mkTask({
    creator: areeba, assignee: hassan, dept: design, status: 'Submitted',
    title: 'Customer Mockup', subtitle: 'Generate mockups',
    entityType: 'Artwork', entityId: 'AW-2026-000125', taskType: 'Mockup Creation',
    priority: 'High', dueAt: at(0, 17), estimatedMinutes: 30,
    startedAt: at(0, 8, 30), submittedAt: at(0, 9, 45),
    completionSummary: 'Two mockup variants generated on customer garment photos.',
    activity: [
      { activityType: 'Started', oldStatus: 'Assigned', newStatus: 'In Progress', performedById: hassan.id },
      { activityType: 'Submitted', oldStatus: 'In Progress', newStatus: 'Submitted', performedById: hassan.id, notes: 'Ready for review' },
    ],
  })
  await db.comment.create({
    data: {
      taskId: mockup.id, commentedById: hassan.id,
      commentText: 'Used the red outline from image two as reference. Please check placement.',
    },
  })

  // ── Areeba → Hassan: IN PROGRESS (the shared task visible in 3 portals) ───
  seq = 125
  const bgRemoval = await mkTask({
    creator: areeba, assignee: hassan, dept: design, status: 'In Progress',
    title: 'Background Removal', subtitle: 'Remove white background',
    entityType: 'Artwork', entityId: 'AW-2026-000125', taskType: 'Background Removal',
    priority: 'High', dueAt: at(0, 15), estimatedMinutes: 45, startedAt: at(0, 10, 15),
    description: 'Remove the white background from the artwork. Clean the edges manually where AI misses. Ensure no white halos. Save as transparent PNG.',
    activity: [
      { activityType: 'Started', oldStatus: 'Assigned', newStatus: 'In Progress', performedById: hassan.id },
    ],
  })
  await Promise.all(
    ['Output must be 300 DPI', 'Background should be completely transparent', 'No white halos or rough edges'].map(
      (item, i) =>
        db.checklistItem.create({
          data: { taskId: bgRemoval.id, sequenceNo: i + 1, item, isRequired: true },
        })
    )
  )
  await db.aiRun.create({
    data: {
      taskId: bgRemoval.id, agentType: 'Background Removal Agent', modelName: 'bg-remover-v2',
      runStatus: 'Completed', confidenceScore: 0.91, qualityScore: 0.88,
      resultSummary: 'Background removed; minor halo detected near hair region — needs manual cleanup.',
      startedAt: at(0, 10), completedAt: at(0, 10, 5),
    },
  })

  // ── Admin → Usman (IT tickets — prove ADMIN→IT path) ───────────────────────
  seq = 126
  await mkTask({
    creator: bilal, assignee: usman, dept: it, status: 'Assigned',
    title: 'Fix Design Studio export bug', subtitle: 'PNG export fails on large canvases',
    entityType: 'System', entityId: 'DESIGN-STUDIO', taskType: 'Bug Fix',
    priority: 'High', dueAt: at(0, 18), estimatedMinutes: 120, affectedSystem: 'Design Studio',
  })
  seq = 127
  await mkTask({
    creator: bilal, assignee: usman, dept: it, status: 'Assigned',
    title: 'Set up new designer workstation', subtitle: 'Install Adobe suite + calibrate display',
    entityType: 'System', entityId: 'WS-DESIGN-07', taskType: 'Hardware',
    priority: 'Medium', dueAt: at(3, 12), estimatedMinutes: 180, affectedSystem: 'Workstation WS-07',
  })

  console.log('Seed complete.')
  console.log('Logins: bilal@decoinks.com/Admin@123 · areeba@decoinks.com/Sales@123 · hassan@decoinks.com/Design@123 · usman@decoinks.com/It@123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
