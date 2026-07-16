import { useEffect, useState } from 'react'
import { Pause, Upload } from 'lucide-react'

function useTimer(startSeconds) {
  const [s, setS] = useState(startSeconds)
  useEffect(() => {
    const id = setInterval(() => setS((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function CurrentTaskCard() {
  const running = useTimer(22 * 60 + 18) // 00:22:18 like the screenshot
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">My Current Task</h3>
        <button className="text-xs font-medium text-accent hover:underline">View Details</button>
      </div>
      <div className="text-[15px] font-semibold text-ink">Background Removal</div>
      <div className="text-sm text-ink-secondary">Remove white background and clean the edges</div>
      <div className="mt-1 text-xs text-ink-tertiary">Artwork · AW-2026-000125</div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-control bg-subtle p-3 text-center">
        <div>
          <div className="text-[11px] text-ink-tertiary">Started At</div>
          <div className="text-sm font-semibold text-ink">10:15 AM</div>
        </div>
        <div>
          <div className="text-[11px] text-ink-tertiary">Time Running</div>
          <div className="text-sm font-semibold text-status-success">{running}</div>
        </div>
        <div>
          <div className="text-[11px] text-ink-tertiary">Due</div>
          <div className="text-sm font-semibold text-ink">03:00 PM</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="focus-ring flex items-center justify-center gap-2 rounded-control border border-border-strong bg-status-warningsoft px-3 py-2.5 text-sm font-semibold text-[#8A6D00]">
          <Pause size={15} /> Pause
        </button>
        <button className="focus-ring flex items-center justify-center gap-2 rounded-control bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          <Upload size={15} /> Submit Task
        </button>
      </div>
    </div>
  )
}
