import { AnimatePresence, motion } from 'framer-motion'
import type { PersonalRecord } from '../db/schema'

export interface SessionStats {
  durationMin: number | null
  volumeKg: number
  setsDone: number
  setsTotal: number
  exercises: number
  prs: PersonalRecord[]
}

function fmtVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`
  return `${Math.round(kg)} kg`
}

/** Resumen de la sesión al completar el entreno — el "cierre" del modo entreno. */
export function SessionSummary({ open, accentColor, stats, onClose }: {
  open: boolean
  accentColor: string
  stats: SessionStats
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ background: 'rgba(6,6,10,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="card-elevated w-full max-w-[420px] p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase" style={{ color: accentColor, letterSpacing: '0.1em' }}>
                Entreno completado
              </div>
              <div className="display font-bold gradient-warm mt-1" style={{ fontSize: 40, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
                ¡Hecho! 💪
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SummaryStat label="Duración" value={stats.durationMin != null ? `${stats.durationMin}′` : '—'} />
              <SummaryStat label="Volumen" value={fmtVolume(stats.volumeKg)} highlight={accentColor} />
              <SummaryStat label="Series" value={`${stats.setsDone}/${stats.setsTotal}`} />
            </div>

            {stats.prs.length > 0 && (
              <div className="rounded-xl p-3 space-y-1.5"
                style={{ background: 'linear-gradient(135deg, rgba(255,212,121,.10), rgba(245,158,11,.06))', border: '1px solid rgba(245,158,11,.35)' }}>
                <div className="text-[11px] font-bold uppercase" style={{ color: '#F5B93E', letterSpacing: '0.08em' }}>
                  🏆 {stats.prs.length === 1 ? 'Nuevo récord' : `${stats.prs.length} nuevos récords`}
                </div>
                {stats.prs.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: 'var(--text-2)' }}>{p.exercise}</span>
                    <span className="num font-bold" style={{ color: '#F5B93E' }}>{p.weight} kg × {p.reps}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary w-full" style={{ height: 48 }} onClick={onClose}>
              Continuar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="num font-bold" style={{ fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1, color: highlight ?? 'var(--text)' }}>{value}</div>
      <div className="text-[10px] uppercase mt-1" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
