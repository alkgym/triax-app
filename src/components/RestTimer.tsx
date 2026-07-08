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
        if (r <= 1) {
          window.clearInterval(id)
          setRunning(false)
          vibrate([200, 100, 200])
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await (navigator as any).wakeLock.request('screen')
          wakeLock.current?.addEventListener('release', () => { wakeLock.current = null })
        }
      } catch {}
    }
    if (running) acquire()
    else { wakeLock.current?.release().catch(() => {}); wakeLock.current = null }
    return () => { wakeLock.current?.release().catch(() => {}); wakeLock.current = null }
  }, [running])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const pct = target > 0 ? ((target - remaining) / target) * 100 : 0
  const finished = remaining === 0

  function toggle() {
    if (!running && finished) {
      setRemaining(target); setRunning(true)
    } else {
      setRunning(r => !r)
    }
    vibrate(15)
  }

  return (
    <div className="card p-4 relative overflow-hidden" style={running ? { borderColor: 'var(--accent)' } : {}}>
      {running && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--accent)' }} />}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={toggle}
          className="num font-semibold tabular-nums shrink-0"
          style={{
            fontSize: '52px', lineHeight: 1, letterSpacing: '-0.04em',
            color: finished ? 'var(--green)' : running ? 'var(--accent)' : 'var(--text)',
          }}
        >
          {mm}:{ss}
        </button>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {[60, 90, 120, 180].map(s => (
            <button key={s}
              onClick={() => { setTarget(s); setRemaining(s); setRunning(false) }}
              className="chip"
              style={target === s && !running ? { color: 'var(--text)', borderColor: 'var(--text-2)' } : {}}>
              {s}s
            </button>
          ))}
          <button
            onClick={toggle}
            className="ml-1 w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: running ? 'var(--accent)' : finished ? 'transparent' : 'var(--surface-2)',
              color: running ? '#0a0a0a' : finished ? 'var(--green)' : 'var(--text)',
              border: finished ? '1px solid var(--green)' : 'none',
            }}
          >
            {running ? '⏸' : finished ? '↺' : '▶'}
          </button>
        </div>
      </div>

      <div className="h-1 rounded-full overflow-hidden mt-3" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: finished ? 'var(--green)' : 'var(--accent)' }} />
      </div>
    </div>
  )
}

declare global {
  interface WakeLockSentinel {
    release(): Promise<void>
    addEventListener(type: 'release', cb: () => void): void
  }
}
