import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, Link } from 'react-router-dom'
import { db, type WorkoutType, type ExerciseTemplate } from '../db/schema'
import { todayIso } from '../lib/dates'
import { isGymType } from '../hooks/useWorkoutSession'
import { vibrate } from '../db/hooks'
import { startRoutine } from '../db/queries'
import { TYPE_COLORS } from '../lib/colors'
import { REHAB_PHASE_META, REHAB_CATEGORY_LABEL } from '../lib/rehab'
import { MuscleVolume } from '../components/MuscleVolume'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { ScreenHeader } from '../components/ScreenHeader'

const GYM_LABEL: Record<string, string> = {
  push: 'Push', pull: 'Pull', fullbody: 'Full Body', legs: 'Legs', torso: 'Torso',
}

function daysAgoLabel(iso: string, today: string): string {
  const ms = new Date(today + 'T00:00:00Z').getTime() - new Date(iso + 'T00:00:00Z').getTime()
  const d = Math.round(ms / 86400000)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  return `hace ${d} días`
}

export default function Rutinas() {
  const templates = useLiveQuery(() => db.exerciseTemplates.filter(t => t.active).toArray())
  const rehab = useLiveQuery(() => db.rehabExercises.filter(e => e.active).toArray())
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const navigate = useNavigate()
  const today = todayIso()

  // Agrupa plantillas por tipo de gym
  const byType = new Map<WorkoutType, ExerciseTemplate[]>()
  for (const t of templates ?? []) {
    if (!isGymType(t.type)) continue
    const arr = byType.get(t.type) ?? []
    arr.push(t); byType.set(t.type, arr)
  }
  const routineTypes = Array.from(byType.keys()).sort()

  // Última sesión completada por tipo (para "última vez")
  const lastByType = new Map<WorkoutType, string>()
  for (const s of sessions ?? []) {
    if (!s.completedAt || s.isExtra || !isGymType(s.type)) continue
    const cur = lastByType.get(s.type)
    if (!cur || s.date > cur) lastByType.set(s.type, s.date)
  }

  async function start(type: WorkoutType) {
    await startRoutine(today, type)
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
          const color = TYPE_COLORS[type] ?? 'var(--accent)'
          const label = GYM_LABEL[type] ?? type
          const exs = (byType.get(type) ?? []).sort((a, b) => a.order - b.order)
          const lastDone = lastByType.get(type)
          const totalSeries = exs.reduce((a, e) => a + e.series, 0)
          return (
            <div key={type} className="card p-4 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(140% 120% at 0% 0%, ${color}14, transparent 50%)` }} />
              <div className="flex items-center justify-between gap-2 relative">
                <div className="min-w-0">
                  <div className="display text-[19px] font-bold tracking-tight" style={{ color }}>{label}</div>
                  <div className="text-[11.5px] mt-0.5 num" style={{ color: 'var(--text-3)' }}>
                    {exs.length} ejercicios · {totalSeries} series
                    {lastDone && <> · <span style={{ color: 'var(--text-2)' }}>{daysAgoLabel(lastDone, today)}</span></>}
                  </div>
                </div>
                <button onClick={() => start(type)} className="shrink-0 text-[13.5px] font-bold px-4 rounded-xl flex items-center"
                  style={{ background: color, color: '#0a0a0a', height: 42, boxShadow: `0 5px 16px ${color}44` }}>
                  Empezar
                </button>
              </div>
              <div className="mt-3 space-y-1 relative">
                {exs.slice(0, 8).map(e => (
                  <div key={e.id} className="flex items-center justify-between text-[12px]">
                    <span className="truncate" style={{ color: 'var(--text-2)' }}>{e.name}</span>
                    <span className="num shrink-0 ml-2" style={{ color: 'var(--text-3)' }}>{e.series}×{e.reps}</span>
                  </div>
                ))}
                {exs.length > 8 && (
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>+{exs.length - 8} más…</div>
                )}
              </div>
              <Link to="/ajustes" className="text-[12px] inline-block mt-2.5 relative" style={{ color: 'var(--accent)' }}>Editar ejercicios →</Link>
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
