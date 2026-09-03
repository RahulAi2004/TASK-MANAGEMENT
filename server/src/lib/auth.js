import jwt from 'jsonwebtoken'
import { db } from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

/**
 * `claims` carries what the DB does not know: `sadm` records that Authentik put this
 * person in the suite's admin group at sign-in time. It is deliberately not stored on
 * the user — group membership belongs to Authentik, and a stale copy in this database
 * would be a second, quieter answer to "is this person an admin?".
 */
export function signToken(user, claims = {}) {
  return jwt.sign({ sub: user.id, role: user.role, ...claims }, SECRET, { expiresIn: '12h' })
}

/** Require a valid Bearer token; attaches req.user (fresh from DB). */
export async function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    const payload = jwt.verify(token, SECRET)
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, title: true, color: true, departmentId: true },
    })
    if (!user) return res.status(401).json({ error: 'User not found' })
    // Left undefined (not false) for a token issued before suite-admin claims existed,
    // or for a password login, so a client can tell "not an admin" from "not asserted".
    req.user = { ...user, suiteAdmin: payload.sadm }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden for role ' + req.user.role })
    }
    next()
  }
}

/** Who can the current user assign tasks to? ADMIN → anyone; SALES → designers. */
export function assignableRoleFilter(role) {
  if (role === 'ADMIN') return {} // everyone
  if (role === 'SALES') return { role: 'DESIGNER' }
  return null // DESIGNER / IT cannot assign
}
