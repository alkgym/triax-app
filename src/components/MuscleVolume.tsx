import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MuscleGroup } from '../db/schema'
import { isGymType } from '../hooks/useWorkoutSession'

const LABEL: Record<MuscleGroup, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps', isquios: 'Isquios', gluteo: 'Glúteo', gemelo: 'Gemelo', core: 'Core',
}
const COLOR: Record<MuscleGroup, string> = {
  pecho: '#FF6B2B', espalda: '#3B82F6', hombro: '#F59E0B', biceps: '#A855F7', triceps: '#EC4899',
  cuadriceps: '#10F4A0', isquios: '#22D3EE', gluteo: '#F97316', gemelo: '#64748B', core: '#FACC15',
}

// Volumen semanal por grupo muscular = suma de series de los ejercicios activos
// del gym (una rotación completa del split ≈ semana). Se recalcula solo al
// editar/cambiar ejercicios o sus grupos musculares.
export function MuscleVolume() {
  const templates = useLiveQuery(() => db.exerciseTemplates.filter(t => t.active && isGymType(t.type)).toArray())
  const schedule = useLiveQuery(() => db.schedule.toArray())
  if (!templates) return null

  // Plantillas activas por tipo de gym
  const byType = new Map<string, typeof templates>()
  for (const t of templates) { const a = byType.get(t.type) ?? []; a.push(t); byType.set(t.type, a) }

  // Días de gym programados en la semana (cada ocurrencia cuenta)
  const gymDays = (schedule ?? []).filter(s => isGymType(s.type)).map(s => s.type)
  // Si no hay horario, fallback: una rotación de cada tipo con plantillas
  const rotation = gymDays.length > 0 ? gymDays : Array.from(byType.keys())

  const vol = new Map<MuscleGroup, number>()
  for (const type of rotation) {
    for (const t of (byType.get(type) ?? [])) {
      for (const mg of (t.muscleGroups ?? [])) {
        vol.set(mg, (vol.get(mg) ?? 0) + (t.series || 0))
      }
    }
  }
  const rows = Array.from(vol.entries()).sort((a, b) => b[1] - a[1])
  const max = Math.max(10, ...rows.map(r => r[1]))
  if (rows.length === 0) {
    return (
      <div className="card p-4 text-[13px]" style={{ color: 'var(--text-2)' }}>
        Asigna grupos musculares a tus ejercicios (en Ajustes) para ver el volumen semanal.
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Series semanales por grupo</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>1 rotación del split</div>
      </div>
      <div className="space-y-2.5">
        {rows.map(([mg, n]) => {
          const optimal = n >= 10 && n <= 20
          return (
            <div key={mg}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--text-2)' }}>{LABEL[mg]}</span>
                <span className="num font-semibold" style={{ color: COLOR[mg] }}>
                  {n}<span className="text-[10px] font-normal" style={{ color: optimal ? '#22C55E' : 'var(--text-3)' }}>{optimal ? ' ✓' : n < 10 ? ' bajo' : ' alto'}</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--surface-2)' }}>
                {/* zona óptima 10-20 */}
                <div className="absolute top-0 bottom-0" style={{ left: `${(10 / max) * 100}%`, right: `${100 - (Math.min(20, max) / max) * 100}%`, background: 'rgba(34,197,94,0.12)' }} />
                <div className="h-full rounded-full relative" style={{ width: `${(n / max) * 100}%`, background: COLOR[mg] }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        Franja verde = rango orientativo 10-20 series/semana (hipertrofia). Cambia un ejercicio o su grupo y se recalcula.
      </div>
    </div>
  )
}
