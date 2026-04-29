import { useEffect, useRef, useState } from 'react'
import { vibrate } from '../db/hooks'

export function RestTimer({ defaultSec = 90 }: { defaultSec?: number }) {
  const [target, setTarget] = useState(defaultSec)
  const [remaining, setRemaining] = useState(defaultSec)
  const [running, setRunning] = useState(false)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { window.clearInterval(id); setRunning(false); vibrate([200, 100, 200]); return 0 }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator && running) {
          wakeLock.current = await (navigator as any).wakeLock.request('screen')
        }
      } catch {}
    }
    if (running) acquire()
    else if (wakeLock.current) { wakeLock.current.release().catch(()=>{}); wakeLock.current = null }
    return () => { if (wakeLock.current) wakeLock.current.release().catch(()=>{}) }
  }, [running])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="card p-3 flex items-center justify-between gap-3">
      <div className="display text-3xl text-bone tabular-nums">{mm}:{ss}</div>
      <div className="flex items-center gap-2">
        {[60, 90, 120, 180].map(s => (
          <button key={s} onClick={() => { setTarget(s); setRemaining(s); setRunning(false) }}
            className={`chip ${target === s ? 'border-orange text-orange' : ''}`}>{s}s</button>
        ))}
        <button className="btn btn-primary" onClick={() => { setRemaining(target); setRunning(r => !r); vibrate(15) }}>
          {running ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  )
}

declare global {
  interface WakeLockSentinel { release(): Promise<void> }
}
