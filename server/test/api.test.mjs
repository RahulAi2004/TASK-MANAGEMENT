// API tests against a real server on a throwaway SQLite database.
// Run: cd server && npm test   (needs no running app and never touches prisma/dev.db)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = mkdtempSync(path.join(tmpdir(), 'tm-test-'))
const PORT = 14900 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}/api`
const env = {
  ...process.env,
  DATABASE_URL: 'file:' + path.join(dir, 'test.db').replace(/\\/g, '/'),
  JWT_SECRET: 'test-secret',
  ADMIN_EMAIL: 'admin@test.local',
  ADMIN_PASSWORD: 'Admin@123',
  PASSWORD_LOGIN_ROLES: 'ADMIN,DESIGNER',
  PORT: String(PORT),
}
let server
let admin // { token, user }
let designer // { token, user }

const call = async (method, url, token, body) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}
const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).data
const newTask = (overrides = {}) => ({
  title: 'Test task',
  entityType: 'General',
  entityId: 'GENERAL',
  taskType: 'General',
  assignedUserId: designer.user.id,
  ...overrides,
})

before(async () => {
  execSync('npx prisma migrate deploy', { cwd: SERVER_DIR, env, stdio: 'ignore' })
  execSync('node prisma/seed.js', { cwd: SERVER_DIR, env, stdio: 'ignore' })
  server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, env, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + '/health')).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  admin = await login('admin@test.local', 'Admin@123')
  assert.ok(admin?.token, 'admin can sign in')
  const invited = await call('POST', '/users', admin.token, { name: 'Dana Designer', email: 'dana@test.local', role: 'DESIGNER' })
  assert.equal(invited.status, 201)
  designer = await login('dana@test.local', invited.data.tempPassword)
  assert.ok(designer?.token, 'invited designer can sign in with the temporary password')
})

after(() => {
  server?.kill()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* Windows may still hold the db file for a moment */
  }
})

test('health check answers', async () => {
  assert.equal((await call('GET', '/health')).status, 200)
})

test('invites get a unique random temporary password', async () => {
  const a = await call('POST', '/users', admin.token, { name: 'A', email: 'a@test.local', role: 'IT' })
  const b = await call('POST', '/users', admin.token, { name: 'B', email: 'b@test.local', role: 'IT' })
  assert.equal(a.data.tempPassword.length, 12)
  assert.notEqual(a.data.tempPassword, b.data.tempPassword)
  assert.notEqual(a.data.tempPassword, 'Welcome@123')
})

test('password login is limited to PASSWORD_LOGIN_ROLES', async () => {
  const it = await call('POST', '/users', admin.token, { name: 'Ivan IT', email: 'ivan@test.local', role: 'IT', password: 'Secret123' })
  const res = await call('POST', '/auth/login', null, { email: 'ivan@test.local', password: 'Secret123' })
  assert.equal(it.status, 201)
  assert.equal(res.status, 403)
})

test('task lifecycle: create → start → send for review → approve', async () => {
  const created = await call('POST', '/tasks', admin.token, newTask({ title: 'Lifecycle' }))
  assert.equal(created.status, 201)
  const id = created.data.task?.id ?? created.data.id
  assert.ok(id)
  for (const [who, event, status] of [
    [designer, 'start', 'In Progress'],
    [designer, 'submit', 'Submitted'],
    [admin, 'approve', 'Completed'],
  ]) {
    const r = await call('POST', `/tasks/${id}/transition`, who.token, { event })
    assert.equal(r.status, 200, `${event}: ${JSON.stringify(r.data)}`)
    const t = (await call('GET', `/tasks/${id}`, admin.token)).data
    assert.equal((t.task ?? t).status, status)
  }
})

test('a step that is not allowed is refused', async () => {
  const created = await call('POST', '/tasks', admin.token, newTask({ title: 'Wrong step' }))
  const id = created.data.task?.id ?? created.data.id
  const r = await call('POST', `/tasks/${id}/transition`, designer.token, { event: 'approve' })
  assert.ok(r.status >= 400 && r.status < 500)
})

test('PATCH changes the due date (creator or admin only, open tasks only)', async () => {
  const created = await call('POST', '/tasks', admin.token, newTask({ title: 'Edit me' }))
  const id = created.data.task?.id ?? created.data.id
  const due = new Date(Date.now() + 3 * 86400_000).toISOString()
  const ok = await call('PATCH', `/tasks/${id}`, admin.token, { dueAt: due })
  assert.equal(ok.status, 200)
  const t = (await call('GET', `/tasks/${id}`, admin.token)).data
  assert.equal(new Date((t.task ?? t).dueAt).toISOString(), due)
  // the assignee did not create it
  assert.equal((await call('PATCH', `/tasks/${id}`, designer.token, { dueAt: due })).status, 403)
  // closed tasks stay as they were
  await call('POST', `/tasks/${id}/transition`, admin.token, { event: 'cancel', notes: 'test' })
  assert.equal((await call('PATCH', `/tasks/${id}`, admin.token, { dueAt: due })).status, 422)
})

test('task groups: starter groups, create rules, tasks go in and out', async () => {
  const { data } = await call('GET', '/groups', designer.token)
  assert.equal(data.groups.length, 8)
  assert.equal(data.groups[0].name, 'Decoinks Operations')

  assert.equal((await call('POST', '/groups', designer.token, { name: 'Nope' })).status, 403)
  assert.equal((await call('POST', '/groups', admin.token, { name: '  ' })).status, 400)
  assert.equal((await call('POST', '/groups', admin.token, { name: 'design & artwork' })).status, 409)
  const made = await call('POST', '/groups', admin.token, { name: 'Printing', color: '#16A34A' })
  assert.equal(made.status, 201)
  const groupId = made.data.group.id

  assert.equal((await call('POST', '/tasks', admin.token, newTask({ groupId: 'missing' }))).status, 400)
  const created = await call('POST', '/tasks', admin.token, newTask({ title: 'In a group', groupId }))
  assert.equal(created.status, 201)
  const id = created.data.task?.id ?? created.data.id
  const list = (await call('GET', '/tasks?scope=all&limit=500', admin.token)).data.tasks
  assert.equal(list.find((t) => t.id === id).groupId, groupId)

  assert.equal((await call('PATCH', `/tasks/${id}`, designer.token, { groupId: null })).status, 403)
  assert.equal((await call('PATCH', `/tasks/${id}`, admin.token, { groupId: 'missing' })).status, 400)
  assert.equal((await call('PATCH', `/tasks/${id}`, admin.token, { groupId: null })).status, 200)
  const t = (await call('GET', `/tasks/${id}`, admin.token)).data
  assert.equal((t.task ?? t).groupId, null)
})

test('late tasks become one daily digest per person, and clicking marks it read', async () => {
  const past = new Date(Date.now() - 2 * 86400_000).toISOString()
  for (const title of ['Late one', 'Late two']) {
    const c = await call('POST', '/tasks', admin.token, newTask({ title }))
    const id = c.data.task?.id ?? c.data.id
    assert.equal((await call('PATCH', `/tasks/${id}`, admin.token, { dueAt: past })).status, 200)
  }
  process.env.DATABASE_URL = env.DATABASE_URL
  const { sweepOverdueReminders } = await import('../src/routes/notifications.js')
  await sweepOverdueReminders()
  await sweepOverdueReminders() // a second sweep on the same day adds nothing

  const { data } = await call('GET', '/notifications', designer.token)
  const digests = data.notifications.filter((n) => n.type === 'Reminder')
  assert.equal(digests.length, 1)
  assert.match(digests[0].message, /late/i)

  const before = data.unread
  assert.equal((await call('POST', `/notifications/${digests[0].id}/read`, designer.token)).status, 200)
  assert.equal((await call('GET', '/notifications', designer.token)).data.unread, before - 1)
  // someone else's notification cannot be marked
  assert.equal((await call('POST', `/notifications/${digests[0].id}/read`, admin.token)).status, 404)
})
