// Speech-to-text via Groq's Whisper API (whisper-large-v3 — strong Urdu/English
// code-switching support). Requires GROQ_API_KEY in .env; the frontend falls back
// to the browser Web Speech transcript when this endpoint is unavailable.
import { Router } from 'express'
import { authRequired } from '../lib/auth.js'

export const transcribeRouter = Router()
transcribeRouter.use(authRequired)

transcribeRouter.post('/', async (req, res) => {
  const key = process.env.GROQ_API_KEY
  if (!key) return res.status(503).json({ error: 'Transcription not configured (GROQ_API_KEY missing)' })

  const audioData = req.body?.audioData
  if (typeof audioData !== 'string' || !audioData.startsWith('data:audio/') || audioData.length > 14_000_000) {
    return res.status(400).json({ error: 'audioData must be an audio data URL under 10MB' })
  }

  const commaAt = audioData.indexOf(',')
  const mime = audioData.slice(5, audioData.indexOf(';'))
  const buf = Buffer.from(audioData.slice(commaAt + 1), 'base64')

  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), mime.includes('mp4') ? 'note.m4a' : 'note.webm')
  form.append('model', 'whisper-large-v3')

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!r.ok) {
    console.error('groq transcription failed:', r.status, await r.text().catch(() => ''))
    return res.status(502).json({ error: 'Transcription service failed' })
  }
  const data = await r.json()
  res.json({ transcript: String(data.text || '').trim() })
})
