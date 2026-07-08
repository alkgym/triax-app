import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db, type WorkoutType } from '../db/schema'
import { todayIso } from '../lib/dates'
import { vibrate } from '../db/hooks'
import { useTodayScheduledType } from './ScheduleEditor'
import { isGymType } from '../hooks/useWorkoutSession'

function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}
const GYM_LABEL: Record<string, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', torso: 'Torso', fullbody: 'Full Body' }

export function QuickAddFab() {
  const [open, setOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const navigate = useNavigate()
  const scheduled = useTodayScheduledType()
  const schedGym = scheduled && isGymType(scheduled) ? scheduled : null

  async function logPain(level: number) {
    const h = new Date().getHours()
    const tod = h < 11 ? 'AM' : h < 20 ? 'PM' : 'night'
    await db.painLogs.add({
      date: todayIso(), timeOfDay: tod as any, level, locations: [], context: 'otro', timestamp: Date.now(),
    })
    vibrate(20)
    setSavedMsg(`Dolor ${level}/10 registrado`)
    setTimeout(() => { setSavedMsg(''); setOpen(false) }, 900)
  }

  async function startToday() {
    if (!schedGym) { navigate('/'); setOpen(false); return }
    const date = todayIso()
    const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
    if (!s) await db.sessions.add({ date, type: schedGym as WorkoutType, startedAt: Date.now(), notes: '', isExtra: false })
    else if (s.type !== schedGym) await db.sessions.update(s.id!, { type: schedGym })
    vibrate(20); setOpen(false); navigate('/')
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => { setOpen(true); vibrate(15) }}
        aria-label="Registro rápido"
        className="fixed z-40 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        style={{
          right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 92px)',
          width: 52, height: 52, background: 'var(--accent)', color: '#0a0a0a',
          boxShadow: '0 6px 20px var(--accent-glow), 0 1px 0 rgba(255,255,255,0.25) inset',
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40" style={{ background: 'rgba(5,5,8,0.6)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)} />
            <motion.div
              className="fixed left-0 right-0 z-50 mx-auto px-4"
              style={{ bottom: 0, maxWidth: 480, paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
              initial={{ y: 320 }} animate={{ y: 0 }} exit={{ y: 320 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
              <div className="card-elevated p-4 space-y-4" style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-strong)' }} />

                {/* Dolor rápido */}
                <div>
                  <div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>
                    {savedMsg || 'Registrar dolor ahora'}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => i).map(n => (
                      <button key={n} onClick={() => logPain(n)}
                        className="num flex-1 min-w-[26px] h-9 rounded-lg text-[13px] font-semibold transition-transform active:scale-90"
                        style={{ color: painColor(n), background: 'var(--surface-2)', border: `1px solid ${painColor(n)}44` }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Atajos */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={startToday} className="btn btn-primary">
                    {schedGym ? `Empezar ${GYM_LABEL[schedGym] ?? schedGym}` : 'Ir a Hoy'}
                  </button>
                  <button onClick={() => { setOpen(false); navigate('/lesion') }} className="btn">🩺 Módulo lesión</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
