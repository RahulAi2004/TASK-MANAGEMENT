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

  console.log(`Seed complete — departments ready, admin: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
