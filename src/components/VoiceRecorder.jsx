// Reusable voice-note recorder built on the browser MediaRecorder API.
// Transcription: after recording, the audio is sent to the server's Groq Whisper
// endpoint (handles Urdu/English code-switching). The Web Speech API provides a
// live on-screen transcript while speaking and acts as the fallback when Groq
// is not configured. Emits via onChange(dataUrl | null, transcript | null).
import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { api } from '../data/api'

const MAX_SECONDS = 120 // hard stop so payloads stay well under the API limit

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ''
}

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export default function VoiceRecorder({ value, onChange, compact = false, lang = 'en-US' }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [liveText, setLiveText] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState(null)
  const generationRef = useRef(0) // invalidates late Groq responses after clear/restart
  const recorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const recordingRef = useRef(false)
  const chunksRef = useRef([])
  const transcriptRef = useRef('')
  const timerRef = useRef(null)

  const stopTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  const stopRecognition = () => {
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      rec.onend = null
      rec.onresult = null
      try { rec.stop() } catch { /* already stopped */ }
    }
  }

  // Clean up mid-recording unmounts (panel closed while recording)
  useEffect(() => {
    return () => {
      recordingRef.current = false
      stopTimer()
      stopRecognition()
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
        rec.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const startRecognition = () => {
    if (!SpeechRecognitionImpl) return // recording still works, just no transcript
    const rn = new SpeechRecognitionImpl()
    rn.lang = lang
    rn.continuous = true
    rn.interimResults = true
    rn.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) transcriptRef.current += chunk + ' '
        else interim += chunk
      }
      setLiveText((transcriptRef.current + interim).trim())
    }
    // Chrome stops recognition on silence — restart while we are still recording
    rn.onend = () => {
      if (recordingRef.current && recognitionRef.current === rn) {
        try { rn.start() } catch { /* tab lost focus etc. */ }
      }
    }
    recognitionRef.current = rn
    try { rn.start() } catch { /* ignore */ }
  }

  const start = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Recording is not supported in this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      transcriptRef.current = ''
      setLiveText('')
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result
          const gen = ++generationRef.current
          // Emit immediately with the live Web Speech transcript as fallback…
          onChange?.(dataUrl, transcriptRef.current.trim() || null)
          // …then upgrade to the Groq Whisper transcript (Urdu/English mixed)
          setTranscribing(true)
          try {
            const { transcript } = await api.transcribe(dataUrl)
            if (transcript && generationRef.current === gen) onChange?.(dataUrl, transcript)
          } catch {
            /* Groq not configured or failed — keep the Web Speech fallback */
          } finally {
            if (generationRef.current === gen) setTranscribing(false)
          }
        }
        reader.readAsDataURL(blob)
      }
      recorderRef.current = rec
      rec.start()
      recordingRef.current = true
      setRecording(true)
      setSeconds(0)
      startRecognition()
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch {
      setError('Microphone access denied — allow it in browser settings')
    }
  }

  const stop = () => {
    recordingRef.current = false
    stopTimer()
    stopRecognition()
    setRecording(false)
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  const clear = () => {
    generationRef.current++
    setTranscribing(false)
    onChange?.(null, null)
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  // ── Recorded: playback + delete ──
  if (value) {
    return (
      <div className={compact ? '' : 'space-y-1'}>
        <div className="flex items-center gap-2">
          <audio controls src={value} className={compact ? 'h-9 max-w-[220px]' : 'h-10 w-full max-w-xs'} />
          <button
            type="button"
            onClick={clear}
            title="Delete recording"
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-tertiary hover:bg-subtle hover:text-status-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
        {transcribing && <div className="animate-pulse text-xs text-ink-tertiary">Transcribing…</div>}
      </div>
    )
  }

  // ── Recording in progress ──
  if (recording) {
    return (
      <div className={compact ? 'flex items-center gap-2' : 'space-y-2'}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={stop}
            className="focus-ring flex items-center gap-2 rounded-control bg-status-danger px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Square size={13} fill="currentColor" /> Stop
          </button>
          <span className="flex items-center gap-1.5 text-sm text-status-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-danger" />
            {mmss}
          </span>
        </div>
        {!compact && liveText && (
          <p className="max-h-16 overflow-y-auto text-xs italic text-ink-secondary">{liveText}</p>
        )}
      </div>
    )
  }

  // ── Idle: mic button ──
  return (
    <div className={compact ? '' : 'space-y-1.5'}>
      <button
        type="button"
        onClick={start}
        title="Record voice note"
        className={
          compact
            ? 'focus-ring grid h-9 w-9 place-items-center rounded-control border border-border-strong bg-surface text-ink-secondary hover:bg-subtle hover:text-accent'
            : 'focus-ring flex items-center gap-2 rounded-control border border-accent-softborder bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft/70'
        }
      >
        <Mic size={15} />
        {!compact && 'Record Voice Note'}
      </button>
      {error && <div className="text-xs text-status-danger">{error}</div>}
    </div>
  )
}
