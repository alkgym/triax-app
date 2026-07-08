import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, Link } from 'react-router-dom'
import { db, type WorkoutType, type ExerciseTemplate } from '../db/schema'
import { todayIso } from '../lib/dates'
import { isGymType } from '../hooks/useWorkoutSession'
import { vibrate } from '../db/hooks'
import { REHAB_PHASE_META, REHAB_CATEGORY_LABEL } from '../lib/rehab'
import { MuscleVolume } from '../components/MuscleVolume'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { ScreenHeader } from '../components/ScreenHeader'

const GYM_ROUTINE_META: Record<string, { label: string; color: string }> = {
  push:     { label: 'Push',      color: '#FF6B2B' },
  pull:     { label: 'Pull',      color: '#3B82F6' },
  fullbody: { label: 'Full Body', color: '#A855F7' },
  legs:     { label: 'Legs',      color: '#10F4A0' },
  torso:    { label: 'Torso',     color: '#22D3EE' },
}

export default function Rutinas() {
  const templates = useLiveQuery(() => db.exerciseTemplates.filter(t => t.active).toArray())
  const rehab = useLiveQuery(() => db.rehabExercises.filter(e => e.active).toArray())
  const navigate = useNavigate()

  // Agrupa plantillas por tipo de gym
  const byType = new Map<WorkoutType, ExerciseTemplate[]>()
  for (const t of templates ?? []) {
    if (!isGymType(t.type)) continue
    const arr = byType.get(t.type) ?? []
    arr.push(t); byType.set(t.type, arr)
  }
  const routineTypes = Array.from(byType.keys()).sort()

  async function start(type: WorkoutType) {
    const date = todayIso()
    const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
    if (!s) {
      await db.sessions.add({ date, type, startedAt: Date.now(), notes: '', isExtra: false })
    } else if (s.type !== type) {
      await db.sessions.update(s.id!, { type })
    }
    vibrate(20)
    navigate('/')
  }

  // Rutinas de rehab agrupadas por fase
  const rehabByPhase = new Map<number, typeof rehab>()
  for (const e of rehab ?? []) {
    const arr = rehabByPhase.get(e.phase) ?? []
    arr!.push(e); rehabByPhase.set(e.phase, arr)
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <ScreenHeader title="Rutinas" sub="Plantillas reutilizables · lanza una y registra" />

      <ScheduleEditor />

      <MuscleVolume />

      {/* Rutinas de gym */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase px-1" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Gimnasio</div>
        {routineTypes.length === 0 && (
          <div className="card p-4 text-[13px]" style={{ color: 'var(--text-2)' }}>
            No hay rutinas de gym. Crea ejercicios en <Link to="/ajustes" style={{ color: 'var(--accent)' }}>Ajustes</Link>.
          </div>
        )}
        {routineTypes.map(type => {
          const m = GYM_ROUTINE_META[type] ?? { label: type, color: 'var(--accent)' }
          const exs = (byType.get(type) ?? []).sort((a, b) => a.order - b.order)
          return (
            <div key={type} className="card p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: m.color }} />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>{m.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{exs.length} ejercicios</div>
                </div>
                <button onClick={() => start(type)} className="btn shrink-0"
                  style={{ background: m.color, color: '#0a0a0a', borderColor: m.color, fontWeight: 600 }}>
                  Empezar
                </button>
              </div>
              <div className="mt-3 space-y-1">
                {exs.slice(0, 8).map(e => (
                  <div key={e.id} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: 'var(--text-2)' }}>{e.name}</span>
                    <span className="num" style={{ color: 'var(--text-3)' }}>{e.series}×{e.reps}</span>
                  </div>
                ))}
              </div>
              <Link to="/ajustes" className="text-[12px] inline-block mt-2.5" style={{ color: 'var(--accent)' }}>Editar ejercicios →</Link>
            </div>
          )
        })}
      </div>

      {/* Rutinas de rehab */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase px-1" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Readaptación lumbar</div>
        {[1, 2, 3].map(phase => {
          const exs = rehabByPhase.get(phase) ?? []
          if (!exs || exs.length === 0) return null
          const pm = REHAB_PHASE_META[phase as 1 | 2 | 3]
          return (
            <div key={phase} className="card p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: pm.color }} />
              <div className="text-[14px] font-semibold" style={{ color: pm.color }}>{pm.label}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{pm.desc}</div>
              <div className="mt-3 space-y-1">
                {exs.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-[12px] gap-2">
                    <span className="truncate" style={{ color: 'var(--text-2)' }}>{e.name}</span>
                    <span className="shrink-0" style={{ color: 'var(--text-3)' }}>{REHAB_CATEGORY_LABEL[e.category]}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <Link to="/lesion" className="btn btn-ghost w-full text-sm">Abrir módulo de Lesión →</Link>
      </div>
    </div>
  )
}
