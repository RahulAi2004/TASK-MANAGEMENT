import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { tasksRouter } from './routes/tasks.js'
import { adminRouter } from './routes/admin.js'
import { transcribeRouter } from './routes/transcribe.js'
import { notificationsRouter, startReminderSweep } from './routes/notifications.js'

const app = express()
app.use(cors())
// 40mb: up to 5 voice notes travel as base64 data URLs in one JSON body
app.use(express.json({ limit: '40mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'decoinks-task-api' }))
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/admin', adminRouter)
app.use('/api/transcribe', transcribeRouter)
app.use('/api/notifications', notificationsRouter)

// Overdue-task reminder sweep: on boot, then every 5 minutes
startReminderSweep()

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
