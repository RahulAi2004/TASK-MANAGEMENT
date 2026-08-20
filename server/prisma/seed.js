// Production-safe seed: creates departments and the admin account only.
// Admin credentials come from .env (ADMIN_EMAIL / ADMIN_PASSWORD).
// Idempotent — safe to run more than once; never wipes existing data.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const departments = [
    { code: 'DESIGN', name: 'Design Studio' },
    { code: 'SALES', name: 'Sales' },
    { code: 'IT', name: 'IT' },
    { code: 'QA', name: 'QA' },
  ]
  for (const d of departments) {
    await db.department.upsert({ where: { code: d.code }, update: {}, create: d })
  }

  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@123'
  await db.user.upsert({
    where: { email },
    update: {}, // never overwrite an existing admin's password on reseed
    create: {
      email,
      name: process.env.ADMIN_NAME || 'Administrator',
      role: 'ADMIN',
      title: 'Manager',
      color: '#2564CF',
      passwordHash: bcrypt.hashSync(password, 10),
    },
  })

  // Default task templates (idempotent — upsert by code; never overwrites admin edits).
  const deptByCode = Object.fromEntries((await db.department.findMany()).map((d) => [d.code, d.id]))
  const templates = [
    { code: 'BACKGROUND_REMOVAL', name: 'Background Removal', dept: 'DESIGN', taskType: 'Background Removal', entityType: 'Artwork', priority: 'High', slaHours: 2, aiFirstAttempt: true, description: 'Remove background, clean edges, deliver a transparent PNG at 300 DPI.', checklist: [{ item: 'Transparency verified' }, { item: 'Clean edges' }, { item: 'No halos' }] },
    { code: 'ARTWORK_EXTRACTION', name: 'Artwork Extraction', dept: 'DESIGN', taskType: 'Artwork Extraction', entityType: 'Artwork', priority: 'Medium', slaHours: 24, aiFirstAttempt: true, triggerEvent: 'ARTWORK_CREATED', description: 'Extract the vector/raster artwork from a customer-supplied file.', checklist: [{ item: 'Artwork isolated' }, { item: 'Resolution OK' }] },
    { code: 'CUSTOMER_MOCKUP', name: 'Customer Mockup', dept: 'DESIGN', taskType: 'Mockup Creation', entityType: 'Artwork', priority: 'High', slaHours: 8, aiFirstAttempt: true, triggerEvent: 'MOCKUP_REQUESTED', description: 'Place approved artwork on garment templates for customer approval.', checklist: [{ item: 'Correct garment' }, { item: 'Correct placement' }, { item: 'Color accurate' }, { item: 'Customer-ready' }] },
    { code: 'PRODUCTION_ARTWORK', name: 'Production Artwork', dept: 'DESIGN', taskType: 'Production Artwork', entityType: 'Sales Order', priority: 'High', slaHours: 24, triggerEvent: 'PAYMENT_RECEIVED', description: 'Prepare print-ready 300 DPI artwork for DTF/DTG production.', checklist: [{ item: '300 DPI' }, { item: 'Correct dimensions' }, { item: 'Whites/CMYK correct' }, { item: 'Transparent background' }, { item: 'File named correctly' }] },
    { code: 'GANGSHEET_PREPARATION', name: 'Gangsheet Preparation', dept: 'DESIGN', taskType: 'Gangsheet Preparation', entityType: 'Sales Order', priority: 'High', slaHours: 8, triggerEvent: 'QA_APPROVED', dependsOnTaskType: 'Production Artwork', description: 'Nest the approved designs on a gangsheet for a DTF run.', checklist: [{ item: 'All artworks nested' }, { item: 'Sheet size correct' }, { item: 'No overlaps' }] },
    { code: 'QA_REVIEW', name: 'QA Review', dept: 'QA', taskType: 'QA Review', entityType: 'Artwork', priority: 'High', slaHours: 2, triggerEvent: 'PRODUCTION_ARTWORK_SUBMITTED', description: 'Check resolution, transparency, halos and dimensions before approval.', checklist: [{ item: 'Resolution' }, { item: 'Transparency' }, { item: 'No halos' }, { item: 'Dimensions' }, { item: 'Color' }, { item: 'File format' }] },
    { code: 'PURCHASE_ORDER_PREP', name: 'Purchase Order Prep', dept: 'SALES', taskType: 'Follow-up', entityType: 'Sales Order', priority: 'Medium', slaHours: 24, isActive: false, triggerEvent: 'GANGSHEET_QA_APPROVED', description: 'Draft the supplier purchase order from the approved order.', checklist: [{ item: 'Items verified' }, { item: 'Supplier selected' }] },
    { code: 'FIX_BUG_TICKET', name: 'Fix / Bug Ticket', dept: 'IT', taskType: 'Bug Fix', entityType: 'System', priority: 'Medium', slaHours: 24, description: 'Internal IT ticket — bug fix, hardware or access request.', checklist: [{ item: 'Reproduced / verified' }] },
  ]
  for (const t of templates) {
    const { dept, checklist, ...rest } = t
    await db.taskTemplate.upsert({
      where: { code: t.code },
      update: { triggerEvent: t.triggerEvent ?? null, dependsOnTaskType: t.dependsOnTaskType ?? null }, // keep event + dependency mapping in sync
      create: { ...rest, departmentId: deptByCode[dept] || null, checklistJson: JSON.stringify(checklist || []) },
    })
  }
  console.log(`Seed complete — departments + ${templates.length} templates ready, admin: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
