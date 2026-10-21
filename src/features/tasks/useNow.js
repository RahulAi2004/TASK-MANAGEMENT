import { useEffect, useState } from 'react'

/** Current time, refreshed every `intervalMs` — drives live elapsed time / SLA. */
export default function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
