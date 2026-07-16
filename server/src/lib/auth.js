import jwt from 'jsonwebtoken'
import { db } from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '12h' })
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
    req.user = user
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
