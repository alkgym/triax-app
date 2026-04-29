import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkoutType } from '../db/schema'
import { TYPE_META } from '../lib/types'
import { useNavigate } from 'react-router-dom'

// Read-only preview of what a workout will look like, with previous-session reference per set.
// For gym days: lists each exercise + planned series rows + last-session hint.
// For disciplines: shows target metrics + intensity.
export function WorkoutPreview({ date, type, intensity, distanceKm, durationMin, drill, description, isBrick }: {
  date: string
  type: WorkoutType
  intensity?: string
  distanceKm?: number
  durationMin?: number
  drill?: string
  description?: string
  isBrick?: boolean
}) {
  const navigate = useNavigate()
  const isGym = type === 'push' || type === 'pull' || type === 'fullbody'
  const isDiscipline = !isGym && type !== 'rest'

  if (type === 'rest') {
    return (
      <div className="card p-4 text-center space-y-2">
        <div className="text-3xl">⚫</div>
        <div className="display text-bone text-lg">Descanso activo</div>
        <p className="text-bone2 text-sm">Movilidad, foam roller, caminar 20 min. Sin entrenamiento estructurado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Vista previa · cómo se verá al hacerlo</div>
        <button onClick={() => navigate('/')} className="btn btn-primary text-xs px-3 py-1.5">Empezar →</button>
      </div>
      {isGym && <GymPreview type={type as 'push' | 'pull' | 'fullbody'} currentDate={date} />}
      {isDiscipline && (
        <DisciplinePreview type={type} intensity={intensity} distanceKm={distanceKm} durationMin={durationMin} drill={drill} description={description} isBrick={isBrick} />
      )}
    </div>
  )
}

function GymPreview({ type, currentDate }: { type: 'push' | 'pull' | 'fullbody'; currentDate: string }) {
  const templates = useLiveQuery(() => db.exerciseTemplates.where('type').equals(type).and(t => t.active).toArray(), [type])
  if (!templates) return <div className="text-bone2 text-sm">Cargando…</div>
  return (
    <div className="space-y-3">
      {templates.sort((a, b) => a.order - b.order).map(t => (
        <ExercisePreviewCard key={t.id} name={t.name} series={t.series} reps={t.reps} rir={t.rir}
                             pesoSugerido={t.pesoSugerido} unit={t.pesoUnidad} notas={t.notas} currentDate={currentDate} />
      ))}
    </div>
  )
}

function ExercisePreviewCard({ name, series, reps, rir, pesoSugerido, unit, notas, currentDate }: {
  name: string; series: number; reps: string; rir?: string; pesoSugerido?: number; unit?: 'kg' | 'bw'; notas?: string; currentDate: string
}) {
  const previous = useLiveQuery(async () => {
    const pastSets = await db.sets.where('exercise').equals(name).toArray()
    if (pastSets.length === 0) return null
    const sessIds = Array.from(new Set(pastSets.map(s => s.sessionId)))
    const sessions = await db.sessions.where('id').anyOf(sessIds).toArray()
    const earlier = sessions.filter(s => s.date < currentDate).sort((a, b) => b.date.localeCompare(a.date))
    if (earlier.length === 0) return null
    const last = earlier[0]
    const lastSets = pastSets.filter(s => s.sessionId === last.id).sort((a, b) => a.setNumber - b.setNumber)
    return { date: last.date, sets: lastSets }
  }, [name, currentDate])

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="display text-bone text-lg truncate">{name}</div>
          <div className="text-bone2 text-xs mono">{series} × {reps}{rir ? ` · ${rir} RIR` : ''}{unit === 'bw' ? ' · BW' : ''}</div>
          {notas && <div className="text-bone2 text-[11px] italic mt-0.5">{notas}</div>}
        </div>
        <div className="display text-bone2 text-2xl">0/{series}</div>
      </div>

      {previous && (
        <div className="mt-2 text-[10px] mono text-bone2">
          Anterior <span className="text-bone">{previous.date}</span>
          {' · '}
          {previous.sets.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ' · '}
              <span className="text-bone">{p.weight ?? '–'}kg×{p.reps ?? '–'}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {Array.from({ length: series }, (_, i) => i + 1).map(n => {
          const prev = previous?.sets.find(p => p.setNumber === n)
          const placeholderReps = prev?.reps ?? (Number.isFinite(Number(reps.split('-')[0])) ? Number(reps.split('-')[0]) : '')
          const placeholderKg = prev?.weight ?? pesoSugerido
          return (
            <div key={n} className="flex items-center gap-2 opacity-70">
              <div className="display text-bone2 text-sm w-6 text-center">{n}</div>
              <div className="input text-center mono text-bone2">{placeholderReps || '—'}</div>
              <span className="text-bone2 text-xs">×</span>
              <div className="input text-center mono text-bone2">{placeholderKg ?? '—'}{unit === 'bw' ? '' : ''}</div>
              <div className="btn btn-ghost px-3 py-2 min-w-12 text-bone2">○</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DisciplinePreview({ type, intensity, distanceKm, durationMin, drill, description, isBrick }: {
  type: WorkoutType; intensity?: string; distanceKm?: number; durationMin?: number; drill?: string; description?: string; isBrick?: boolean
}) {
  const meta = TYPE_META[type]
  return (
    <div className="card p-4 space-y-3" style={{ borderColor: meta.color + '55' }}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.emoji}</span>
        <span className="display text-xl" style={{ color: meta.color }}>{meta.label.toUpperCase()}</span>
        {isBrick && <span className="chip text-yellow-400 border-yellow-400">BRICK</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {distanceKm != null && (
          <div className="bg-ink rounded-lg border border-line p-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-bone2">Distancia</div>
            <div className="display text-bone text-2xl leading-none mt-1">{distanceKm}<span className="text-bone2 text-xs ml-1">km</span></div>
          </div>
        )}
        {durationMin != null && (
          <div className="bg-ink rounded-lg border border-line p-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-bone2">Duración</div>
            <div className="display text-bone text-2xl leading-none mt-1">{durationMin}<span className="text-bone2 text-xs ml-1">min</span></div>
          </div>
        )}
        {intensity && (
          <div className="bg-ink rounded-lg border border-line p-2 text-center col-span-1">
            <div className="text-[10px] uppercase tracking-widest text-bone2">Zona</div>
            <div className="display text-bone text-sm leading-none mt-1 truncate">{intensity}</div>
          </div>
        )}
      </div>
      {drill && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-bone2">Drill</div>
          <div className="text-bone mono text-sm">{drill}</div>
        </div>
      )}
      {description && (
        <div className="text-bone2 text-sm whitespace-pre-line border-t border-line pt-2">{description}</div>
      )}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
        <div className="bg-ink rounded-lg p-2 text-center"><div className="text-[10px] text-bone2 uppercase tracking-widest">FC media</div><div className="display text-bone2 text-xl">—</div></div>
        <div className="bg-ink rounded-lg p-2 text-center"><div className="text-[10px] text-bone2 uppercase tracking-widest">RPE 1-10</div><div className="display text-bone2 text-xl">—</div></div>
      </div>
    </div>
  )
}
