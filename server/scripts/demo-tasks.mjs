// 10 demo tasks for showing the app, one of each situation (late, due today, in review, sent back,
// done…). All are assigned to one admin, so no one else is notified or reminded about them, and
// the Printshop SLA feed skips them. They can be removed completely in one command.
//
//   node scripts/demo-tasks.mjs                    # dry run: says what it would add
//   node scripts/demo-tasks.mjs --apply            # add them (refuses if they are already there)
//   node scripts/demo-tasks.mjs --remove           # dry run: lists what it would delete
//   node scripts/demo-tasks.mjs --remove --apply   # delete them and everything attached to them
//   add --assign someone@example.com to give them to another admin
import 'dotenv/config'
import { db } from '../src/lib/db.js'
import { withTaskNo } from '../src/lib/templates.js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const remove = args.includes('--remove')
const assignEmail = args.includes('--assign') ? args[args.indexOf('--assign') + 1] : null

const HOUR = 3_600_000
const fromNow = (hours) => new Date(Date.now() + hours * HOUR)
// 'today' = late this evening, so it stays in My Day whatever time the script runs
const dueAt = (due) => {
  if (due == null) return null
  if (due !== 'today') return fromNow(due)
  const d = new Date()
  d.setHours(23, 30, 0, 0)
  return d > new Date() ? d : fromNow(1)
}

const DEMO = [
  {
    title: 'Remove background from team logo', status: 'Assigned', priority: 'Urgent', group: 'Design & Artwork', dept: 'DESIGN',
    taskType: 'Background Removal', entityType: 'Artwork', category: 'Order Related', customer: 'Bright Wear Co.', due: 'today', minutes: 45,
    description: 'Remove the white background, clean the edges and save as a transparent PNG at 300 DPI.',
    checklist: ['Remove the background', 'Clean the edges', 'Save as transparent PNG'],
  },
  {
    title: 'Check print quality on sample shirts', status: 'In Progress', priority: 'High', group: 'Production & QA', dept: 'QA',
    taskType: 'QA Review', entityType: 'Sales Order', category: 'Order Related', customer: 'North Star Sports', due: 24, started: -2, minutes: 480,
    description: 'Compare the printed samples with the approved mockup and note any colour or placement differences.',
    checklist: ['Compare colours', 'Check placement', 'Wash test one sample'],
  },
  {
    title: 'Call customer about bulk hoodie quote', status: 'Assigned', priority: 'Medium', group: 'CRM Follow-ups', dept: 'SALES',
    taskType: 'Follow-up', entityType: 'Lead', category: 'General', customer: 'Harbor Cafe', due: 72, minutes: 20,
    description: 'They asked for a price on 200 hoodies. Confirm sizes and the delivery date they need.',
  },
  {
    title: 'Waiting on supplier for blank tees', status: 'On Hold', priority: 'High', group: 'Purchase Orders', dept: 'PROCUREMENT',
    taskType: 'Follow-up', entityType: 'Sales Order', category: 'Order Related', customer: 'Bright Wear Co.', due: 72, started: -36, minutes: 2880,
    description: 'Supplier has not confirmed stock for 150 black tees. Resume once they reply.',
  },
  {
    title: 'Create mockup for summer campaign', status: 'Submitted', priority: 'Medium', group: 'Design & Artwork', dept: 'DESIGN',
    taskType: 'Mockup Creation', entityType: 'Artwork', category: 'Order Related', customer: 'Lakeside Events', due: 30, started: -6, submitted: -1, minutes: 480,
    description: 'Front and back mockup on a white tee using the artwork the customer sent.',
  },
  {
    title: 'Book courier for finished order', status: 'Completed', priority: 'Low', group: 'Shipping & Delivery', dept: null,
    taskType: 'General', entityType: 'Sales Order', category: 'Order Related', customer: 'North Star Sports', due: -1, started: -5, submitted: -4, completed: -3, minutes: 480,
    description: 'Book a pickup and share the tracking number with the customer.',
  },
  {
    title: 'Send late shipment update to customer', status: 'Assigned', priority: 'Urgent', group: 'Shipping & Delivery', dept: null,
    taskType: 'Follow-up', entityType: 'Sales Order', category: 'Order Related', customer: 'Harbor Cafe', due: -26, minutes: 15,
    description: 'The courier missed the date. Tell the customer the new delivery date.',
  },
  {
    title: 'Renew printer maintenance contract', status: 'Assigned', priority: 'Low', group: 'Admin Tasks', dept: null,
    taskType: 'General', entityType: 'General', category: 'Admin', customer: null, due: null, minutes: 30,
    description: 'The contract ends next quarter. Get the renewal price and compare it with last year.',
  },
  {
    title: 'Redo gangsheet with correct sizes', status: 'Rejected', priority: 'High', group: 'Decoinks Operations', dept: 'PRODUCTION',
    taskType: 'Gangsheet Preparation', entityType: 'Sales Order', category: 'Order Related', customer: 'Lakeside Events', due: 20, started: -8, submitted: -3, minutes: 60,
    description: 'Sent back: two designs were at the wrong size. Fix them and send for review again.',
    checklist: ['Fix the two designs', 'Check all sizes against the order'],
  },
  {
    title: 'Prepare my weekly order summary', status: 'In Progress', priority: 'Medium', group: 'Personal Tasks', dept: null,
    taskType: 'General', entityType: 'General', category: 'General', customer: null, due: 'today', started: -1, minutes: 480,
    description: 'Orders finished, orders late, and anything blocked this week.',
  },
]

const findDemo = () =>
  db.task.findMany({
    where: { title: { startsWith: '[DEMO] ' }, entityId: { startsWith: 'DEMO-' }, metadata: { contains: '"demo":true' } },
    select: { id: true, taskNo: true, title: true },
  })

const existing = await findDemo()

if (remove) {
  console.log(`${apply ? 'REMOVE' : 'DRY RUN'}: ${existing.length} demo task(s)`)
  existing.forEach((t) => console.log(`  ${t.taskNo}  ${t.title}`))
  if (apply && existing.length) {
    const ids = existing.map((t) => t.id)
    const taskId = { in: ids }
    await db.$transaction([
      db.taskDependency.deleteMany({ where: { OR: [{ taskId }, { dependsOnTaskId: taskId }] } }),
      db.notification.deleteMany({ where: { taskId } }),
      db.checklistItem.deleteMany({ where: { taskId } }),
      db.comment.deleteMany({ where: { taskId } }),
      db.activity.deleteMany({ where: { taskId } }),
      db.assignmentHistory.deleteMany({ where: { taskId } }),
      db.aiRun.deleteMany({ where: { taskId } }),
      db.taskVoiceNote.deleteMany({ where: { taskId } }),
      db.taskFile.deleteMany({ where: { taskId } }),
      db.taskArtwork.deleteMany({ where: { taskId } }),
      db.task.deleteMany({ where: { id: taskId } }),
    ])
    console.log('deleted')
  }
} else {
  const admins = await db.user.findMany({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
  const owner = assignEmail ? admins.find((u) => u.email === assignEmail.toLowerCase()) : admins.find((u) => u.title === 'Manager') || admins[0]
  if (!owner) throw new Error(assignEmail ? `No admin with the email ${assignEmail}` : 'No admin user found')
  if (existing.length) {
    console.log(`${existing.length} demo task(s) are already there; nothing added. Remove them first with --remove --apply.`)
  } else {
    console.log(`${apply ? 'ADD' : 'DRY RUN'}: ${DEMO.length} demo tasks for ${owner.name}`)
    DEMO.forEach((d) => console.log(`  ${d.status.padEnd(12)} ${d.priority.padEnd(7)} ${d.group.padEnd(20)} ${d.title}`))
  }
  if (apply && !existing.length) {
    const groups = await db.taskGroup.findMany()
    const departments = await db.department.findMany()
    for (const [i, d] of DEMO.entries()) {
      const task = await withTaskNo((taskNo) =>
        db.task.create({
          data: {
            taskNo,
            title: '[DEMO] ' + d.title,
            description: d.description,
            entityType: d.entityType,
            entityId: 'DEMO-' + String(i + 1).padStart(2, '0'),
            taskType: d.taskType,
            priority: d.priority,
            status: d.status,
            assignedUserId: owner.id,
            createdById: owner.id,
            reviewerId: owner.id,
            departmentId: departments.find((x) => x.code === d.dept)?.id,
            groupId: groups.find((g) => g.name === d.group)?.id,
            dueAt: dueAt(d.due),
            estimatedMinutes: d.minutes,
            startedAt: d.started == null ? null : fromNow(d.started),
            submittedAt: d.submitted == null ? null : fromNow(d.submitted),
            completedAt: d.completed == null ? null : fromNow(d.completed),
            metadata: JSON.stringify({ demo: true, category: d.category, ...(d.customer ? { customerName: d.customer } : {}) }),
            checklist: { create: (d.checklist || []).map((item, n) => ({ sequenceNo: n + 1, item, isRequired: false })) },
          },
        })
      )
      await db.activity.create({ data: { taskId: task.id, activityType: 'Created', newStatus: d.status, performedById: owner.id, notes: 'Demo task' } })
      console.log(`  added ${task.taskNo}`)
    }
  }
}
await db.$disconnect()
