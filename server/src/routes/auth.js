import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { signToken, authRequired } from '../lib/auth.js'

export const authRouter = Router()

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

// Roles allowed to sign in for now. Kept admin-only until the other portals
// are ready — add 'SALES', 'DESIGNER', 'IT' here to re-enable them.
const ALLOWED_LOGIN_ROLES = ['ADMIN']

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Email and password required' })
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'Access is currently limited to administrators.' })
  }
  const { passwordHash, ...safe } = user
  res.json({ token: signToken(user), user: safe })
})

// The suite's primary Authentik admin presents root@example.com rather than a
// technocas address, so allow a few identity rewrites instead of locking them
// out. Format: SSO_EMAIL_ALIASES="from@a.com=to@b.com,from2@a.com=to2@b.com"
const SSO_EMAIL_ALIASES = Object.fromEntries(
  String(process.env.SSO_EMAIL_ALIASES || '')
    .split(',')
    .map((pair) => pair.split('=').map((s) => s.trim().toLowerCase()))
    .filter(([from, to]) => from && to),
)

/**
 * Decoinks Suite SSO. Authentik's forward-auth (via nginx on
 * tasks.decoinkssuite.com) asserts the identity in X-authentik-* headers, and
 * the shared secret proves the request came through our own vhost rather than
 * from a client that simply set those headers itself.
 *
 * No auto-provisioning: the person must already exist under Users. That keeps
 * suite-wide access and task-app access as two deliberate decisions.
 */
// Authentik is where "who is an administrator" is decided for the whole suite, and
// the Access Manager already reads this same group. Header format matches it too:
// authentik joins groups with "|", older outposts with ",".
const SSO_ADMIN_GROUPS = String(process.env.SSO_ADMIN_GROUPS || 'Decoinks Suite Admins')
  .split(',')
  .map((g) => g.trim().toLowerCase())
  .filter(Boolean)

function suiteAdminFromHeaders(req) {
  const groups = String(req.get('x-authentik-groups') || '')
    .split(/[|,]/)
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
  return groups.some((g) => SSO_ADMIN_GROUPS.includes(g))
}

authRouter.post('/sso', async (req, res) => {
  const expected = String(process.env.SSO_SHARED_SECRET || '')
  if (!expected || req.get('x-decoinks-sso-secret') !== expected) {
    return res.status(403).json({ error: 'SSO unavailable' })
  }

  const username = String(req.get('x-authentik-username') || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ error: 'Missing SSO identity' })

  const rawEmail = String(req.get('x-authentik-email') || '').trim().toLowerCase()
  const asserted = rawEmail.includes('@') ? rawEmail : `${username}@decoinkssuite.com`
  const email = SSO_EMAIL_ALIASES[asserted] || asserted

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(403).json({
      error:
        'Your Decoinks account is not set up in Task Management yet. Ask an administrator to add you under Users.',
    })
  }

  const suiteAdmin = suiteAdminFromHeaders(req)
  const { passwordHash, ...safe } = user
  res.json({ token: signToken(user, { sadm: suiteAdmin }), user: { ...safe, suiteAdmin } })
})

authRouter.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user })
})
