import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { vibrate } from '../db/hooks'
import { subscribeRest, adjustRest, stopRest, type RestState } from '../lib/restTimer'

/**
 * Píldora flotante de descanso — aparece sola al completar una serie y vive
 * encima del dock. Anillo de progreso, ±30 s y saltar. Vibra al terminar.
 */
export function FloatingRestTimer() {
  const [state, setState] = useState<RestState | null>(null)
  const [remaining, setRemaining] = useState(0)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const doneRef = useRef(false)

  useEffect(() => subscribeRest(s => { setState(s); doneRef.current = false }), [])

  useEffect(() => {
    if (!state?.running) return
    const tick = () => {
      const r = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
      setRemaining(r)
      if (r === 0 && !doneRef.current) {
        doneRef.current = true
        vibrate([200, 100, 200, 100, 300])
        window.setTimeout(() => stopRest(), 1600)
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [state])

  // Mantener pantalla encendida mientras descansa (como el RestTimer clásico)
  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen')
        }
      } catch { /* sin soporte / denegado */ }
    }
    if (state?.running) acquire()
    return () => { wakeLock.current?.release().catch(() => {}); wakeLock.current = null }
  }, [state?.running])

  const total = state?.targetSec ?? 1
  const pct = state ? Math.max(0, Math.min(1, remaining / Math.max(total, 1))) : 0
  const mm = String(Math.floor(remaining / 60)).padStart(1, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const finished = remaining === 0

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2 pl-2 pr-2 py-2 rounded-[20px]"
            style={{
              background: 'rgba(15,15,19,0.92)',
              border: `1px solid ${finished ? 'rgba(34,197,94,.5)' : 'var(--border-strong)'}`,
              backdropFilter: 'blur(22px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
              boxShadow: '0 16px 44px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset',
            }}
          >
            <button onClick={() => { adjustRest(-30); vibrate(10) }}
              className="num text-[12px] font-semibold px-2.5 h-9 rounded-xl"
              style={{ color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              −30
            </button>

            <div className="relative flex items-center justify-center" style={{ width: 64, height: 44 }}>
              {/* anillo de progreso */}
              <svg width="44" height="44" viewBox="0 0 44 44" className="absolute" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--surface-3)" strokeWidth="3.5" />
                <circle cx="22" cy="22" r="19" fill="none"
                  stroke={finished ? 'var(--green)' : 'var(--accent)'}
                  strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 19}`}
                  strokeDashoffset={`${2 * Math.PI * 19 * (1 - pct)}`}
                  style={{ transition: 'stroke-dashoffset .25s linear, stroke .2s ease' }} />
              </svg>
              <span className="num font-bold text-[13px] relative" style={{ color: finished ? 'var(--green)' : 'var(--text)' }}>
                {finished ? '✓' : `${mm}:${ss}`}
              </span>
            </div>

            <button onClick={() => { adjustRest(30); vibrate(10) }}
              className="num text-[12px] font-semibold px-2.5 h-9 rounded-xl"
              style={{ color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              +30
            </button>

            <button onClick={() => { stopRest(); vibrate(15) }}
              className="text-[13px] px-2 h-9 rounded-xl"
              style={{ color: 'var(--text-3)' }}>
              Saltar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
