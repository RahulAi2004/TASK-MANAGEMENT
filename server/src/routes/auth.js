import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { signToken, authRequired } from '../lib/auth.js'

export const authRouter = Router()

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Email and password required' })
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const { passwordHash, ...safe } = user
  res.json({ token: signToken(user), user: safe })
})

authRouter.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user })
})
