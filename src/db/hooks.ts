import { useEffect, useRef, useState } from 'react'

// Debounced autosave hook. Calls `save(value)` after `delay`ms of no changes.
// Returns saving state so UI can show indicator.
export function useAutosave<T>(value: T, save: (v: T) => Promise<void> | void, delay = 400) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const first = useRef(true)
  const timer = useRef<number | undefined>(undefined)
  const savedTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setStatus('saving')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      try {
        await save(value)
        setStatus('saved')
        if (savedTimer.current) window.clearTimeout(savedTimer.current)
        savedTimer.current = window.setTimeout(() => setStatus('idle'), 1200)
      } catch (e) {
        console.error('autosave failed', e)
        setStatus('idle')
      }
    }, delay)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return status
}

export function vibrate(ms: number | number[] = 25) {
  if ('vibrate' in navigator) navigator.vibrate(ms)
}
