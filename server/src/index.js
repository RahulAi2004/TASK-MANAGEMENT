import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
// Rejected promises in async route handlers reach the central error handler (Express 4 doesn't do this
// on its own — a failed query would otherwise leave the request hanging with no response).
import 'express-async-errors'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { tasksRouter } from './routes/tasks.js'
import { adminRouter } from './routes/admin.js'
import { templatesRouter } from './routes/templates.js'
import { routinesRouter } from './routes/routines.js'
import { eventsRouter } from './routes/events.js'
import { integrationRouter } from './routes/integration.js'
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
app.use('/api/templates', templatesRouter)
app.use('/api/routines', routinesRouter)
app.use('/api/events', eventsRouter)
app.use('/api/integration', integrationRouter)
app.use('/api/transcribe', transcribeRouter)
app.use('/api/notifications', notificationsRouter)

// Overdue-task reminder sweep: on boot, then every 5 minutes
startReminderSweep()

// Production: serve the built frontend (../dist from `npm run build` at repo root)
// so one port serves both the app and the API.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback for client-side routes (anything that is not /api/*)
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
  console.log('Serving frontend from', distDir)
}

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
