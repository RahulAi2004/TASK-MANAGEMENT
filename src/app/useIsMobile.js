import { useEffect, useState } from 'react'

// Phones get the dedicated mobile layout (bottom nav, task cards, bottom-sheet detail).
const QUERY = '(max-width: 767px)'

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}
