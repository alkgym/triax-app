import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db, type SetLog, type WorkoutSession } from '../db/schema'
import { todayIso, fmtDate, greetingFor } from '../lib/dates'
import { TYPE_META, PHASE_META } from '../lib/types'
import { useAutosave, vibrate } from '../db/hooks'
import { SaveIndicator } from '../components/SaveIndicator'
import { RestTimer } from '../components/RestTimer'
import { motion, AnimatePresence } from 'framer-motion'
import { Confetti } from '../components/Confetti'
import { MacrosCard } from '../components/MacrosCard'
import { ZonesCard } from '../components/ZonesCard'
import { NutritionLog } from '../components/NutritionLog'
import { parseGpx } from '../lib/gpx'

export default function Today() {
  const params = useParams<{ date?: string }>()
  const date = params.date ?? todayIso()
  const isAlternateDay = date !== todayIso()
  const profile = useLiveQuery(() => db.profile.get('me'))
  const planDay = useLiveQuery(() => db.planDays.where('date').equals(date).first(), [date])
  const session = useLiveQuery(async () => {
    const s = await db.sessions.where('date').equals(date).first()
    if (s) return s
    return null
  }, [date])
  const lastWeight = useLiveQuery(async () => {
    const all = await db.bodyMetrics.orderBy('date').reverse().limit(1).toArray()
    return all[0]
  })

  const [celebrate, setCelebrate] = useState(false)
  const [confettiKey, setConfettiKey] = useState(0)

  if (!planDay) {
    const start = profile?.inicioPlan ?? '2026-05-04'
    const diffDays = Math.round((new Date(start + 'T00:00:00').getTime() - new Date(date + 'T00:00:00').getTime()) / 86400000)
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <header>
          <div className="text-bone2 text-xs uppercase tracking-widest">{greetingFor()}, Alex</div>
          <h1 className="display text-bone text-3xl leading-tight">{fmtDate(date)}</h1>
        </header>
        <div className="card p-5 text-center space-y-2">
          <div className="text-5xl">🎬</div>
          <div className="display text-bone text-xl">Pre-temporada</div>
          {diffDays > 0 ? (
            <p className="text-bone2 text-sm">El plan oficial arranca en <span className="text-orange display text-base">{diffDays} días</span> ({start}). Mientras tanto, registra peso/notas o ajusta plantillas en <b>EDIT</b>.</p>
          ) : (
            <p className="text-bone2 text-sm">No hay sesión programada para hoy. Descansa o registra una nota.</p>
          )}
        </div>
        {lastWeight?.weight != null && (
          <div className="card p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-bone2">Último peso</div>
            <div className="display text-bone text-3xl">{lastWeight.weight}<span className="text-bone2 text-sm ml-1">kg</span></div>
          </div>
        )}
        <NotesField date={date} />
      </div>
    )
  }

  const meta = TYPE_META[planDay.type]
  const phase = PHASE_META[planDay.phase]
  const isGym = planDay.type === 'push' || planDay.type === 'pull' || planDay.type === 'fullbody'
  const isDiscipline = !isGym && planDay.type !== 'rest'

  async function ensureSession(): Promise<WorkoutSession> {
    const existing = await db.sessions.where('date').equals(date).first()
    if (existing) return existing
    const id = await db.sessions.add({
      date, type: planDay!.type, startedAt: Date.now(), notes: '',
    })
    return (await db.sessions.get(id))!
  }

  async function complete() {
    const s = await ensureSession()
    await db.sessions.update(s.id!, { completedAt: Date.now() })
    vibrate([60, 30, 60, 30, 120])
    setCelebrate(true)
    setConfettiKey(k => k + 1)
    setTimeout(() => setCelebrate(false), 2400)
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {isAlternateDay && (
        <Link to="/" className="chip text-orange border-orange w-full justify-center">← Volver a HOY · entrenando {fmtDate(date)}</Link>
      )}
      <header className="flex items-end justify-between">
        <div>
          <div className="text-bone2 text-xs uppercase tracking-widest">{isAlternateDay ? 'Sesión' : `${greetingFor()}, Alex`}</div>
          <h1 className="display text-bone text-3xl leading-tight">{fmtDate(date)}</h1>
        </div>
        <div className="text-right">
          <div className="chip" style={{ borderColor: phase.color, color: phase.color }}>{phase.label}</div>
          {lastWeight?.weight != null && (
            <div className="text-bone2 text-xs mt-1">Peso · <span className="text-bone mono">{lastWeight.weight}kg</span></div>
          )}
        </div>
      </header>

      <div className="card p-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.emoji}</span>
          <span className="display text-2xl" style={{ color: meta.color }}>{meta.label.toUpperCase()}</span>
          {planDay.isDeload && <span className="chip text-orange border-orange">DELOAD</span>}
          {planDay.isBrick && <span className="chip text-yellow-400 border-yellow-400">BRICK</span>}
        </div>
        <h2 className="display text-bone text-2xl mt-1">{planDay.title}</h2>
        {date === '2026-09-27' && (
          <div className="mt-3 bg-orange/10 border border-orange/40 rounded p-2 text-xs text-bone space-y-1">
            <div className="display text-orange text-base">🏁 PLAN DE CARRERA</div>
            <div>· <b>Nado 1km:</b> deslizamiento largo, controlar adrenalina inicial.</div>
            <div>· <b>T1:</b> goggles fuera, casco antes que dorsal.</div>
            <div>· <b>Bici 36km:</b> cadencia 88-92 RPM, gel min 25, sostener acoples.</div>
            <div>· <b>T2:</b> &lt;90s. Zapatillas con elásticos.</div>
            <div>· <b>Carrera 9km:</b> 1.5km transición, luego 5:30/km estable. Atacar último km.</div>
          </div>
        )}
        <p className="text-bone2 text-sm mt-2 whitespace-pre-line">{planDay.description}</p>
        {planDay.intensity && <div className="mono text-xs text-bone2 mt-2">→ {planDay.intensity}</div>}
        {planDay.targetDistanceKm && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {planDay.targetDistanceKm && <Metric label="Distancia" value={`${planDay.targetDistanceKm}`} unit="km" />}
            {planDay.targetDurationMin && <Metric label="Duración" value={`${planDay.targetDurationMin}`} unit="min" />}
            <Metric label="Semana" value={`${planDay.weekNumber}`} unit="/21" />
          </div>
        )}
      </div>

      {isGym && <GymBlock date={date} workoutType={planDay.type as any} />}
      {isDiscipline && <DisciplineBlock date={date} />}
      {isDiscipline && <ZonesCard type={planDay.type} />}
      {planDay.type !== 'rest' && <MacrosCard workoutType={planDay.type} />}
      <NutritionLog date={date} />

      {planDay.type !== 'rest' && (
        <button onClick={complete} className="btn btn-primary w-full text-base py-4 display">
          ✓ ENTRENAMIENTO COMPLETADO
        </button>
      )}

      <Confetti trigger={confettiKey} />
      <AnimatePresence>
        {celebrate && (
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 pointer-events-none">
            <div className="text-center">
              <div className="display text-orange text-7xl">¡HECHO!</div>
              <div className="display text-bone text-xl mt-2 tracking-widest">+1 al casillero</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {session?.completedAt && (
        <div className="text-center text-bone2 text-xs">Completado · {new Date(session.completedAt).toLocaleTimeString('es-ES')}</div>
      )}

      <NotesField date={date} />
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-ink rounded-lg border border-line p-2">
      <div className="text-[10px] uppercase tracking-widest text-bone2">{label}</div>
      <div className="display text-bone text-2xl leading-none mt-1">{value}<span className="text-bone2 text-xs ml-1">{unit}</span></div>
    </div>
  )
}

function GymBlock({ date, workoutType }: { date: string; workoutType: 'push' | 'pull' | 'fullbody' }) {
  const templates = useLiveQuery(() => db.exerciseTemplates.where('type').equals(workoutType).and(t => t.active).toArray(), [workoutType])
  const session = useLiveQuery(() => db.sessions.where('date').equals(date).first(), [date])
  const sets = useLiveQuery(async () => {
    if (!session?.id) return []
    return db.sets.where('sessionId').equals(session.id).toArray()
  }, [session?.id])

  // Ensure session + set rows exist
  useEffect(() => {
    (async () => {
      if (!templates) return
      let s = await db.sessions.where('date').equals(date).first()
      if (!s) {
        const id = await db.sessions.add({ date, type: workoutType, startedAt: Date.now(), notes: '' })
        s = await db.sessions.get(id)
      }
      if (!s) return
      const existing = await db.sets.where('sessionId').equals(s.id!).count()
      if (existing === 0) {
        const rows: Omit<SetLog, 'id'>[] = []
        templates.sort((a, b) => a.order - b.order).forEach(t => {
          for (let i = 1; i <= t.series; i++) {
            rows.push({
              sessionId: s!.id!, exercise: t.name, exerciseOrder: t.order, setNumber: i,
              reps: undefined, weight: t.pesoSugerido, completed: false,
            })
          }
        })
        await db.sets.bulkAdd(rows as SetLog[])
      }
    })()
  }, [templates, date, workoutType])

  if (!templates || !sets) return <div className="text-bone2 text-sm">Cargando ejercicios…</div>

  // Group sets by exercise
  const grouped = new Map<string, SetLog[]>()
  sets.forEach(s => {
    if (!grouped.has(s.exercise)) grouped.set(s.exercise, [])
    grouped.get(s.exercise)!.push(s)
  })

  return (
    <div className="space-y-3">
      <RestTimer />
      {templates.sort((a, b) => a.order - b.order).map(t => {
        const setRows = (grouped.get(t.name) ?? []).sort((a, b) => a.setNumber - b.setNumber)
        return <ExerciseCard key={t.id} name={t.name} reps={t.reps} rir={t.rir} unit={t.pesoUnidad} sets={setRows} notas={t.notas} currentDate={date} />
      })}
    </div>
  )
}

function ExerciseCard({ name, reps, rir, unit, sets, notas, currentDate }: { name: string; reps: string; rir?: string; unit?: 'kg' | 'bw'; sets: SetLog[]; notas?: string; currentDate: string }) {
  const done = sets.filter(s => s.completed).length

  // Find the most recent previous session that logged this exercise
  const previous = useLiveQuery(async () => {
    const pastSets = await db.sets.where('exercise').equals(name).toArray()
    if (pastSets.length === 0) return null
    const sessIds = Array.from(new Set(pastSets.map(s => s.sessionId)))
    const sessions = await db.sessions.where('id').anyOf(sessIds).toArray()
    const earlier = sessions
      .filter(s => s.date < currentDate)
      .sort((a, b) => b.date.localeCompare(a.date))
    if (earlier.length === 0) return null
    const last = earlier[0]
    const lastSets = pastSets.filter(s => s.sessionId === last.id).sort((a, b) => a.setNumber - b.setNumber)
    return { date: last.date, sets: lastSets }
  }, [name, currentDate])

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="display text-bone text-lg">{name}</div>
          <div className="text-bone2 text-xs mono">{sets.length} × {reps}{rir ? ` · ${rir} RIR` : ''}{unit === 'bw' ? ' · BW' : ''}</div>
          {notas && <div className="text-bone2 text-[11px] italic mt-0.5">{notas}</div>}
        </div>
        <div className="display text-orange text-2xl">{done}/{sets.length}</div>
      </div>

      {previous && (
        <div className="mt-2 text-[10px] text-bone2 mono">
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
        {sets.map(s => {
          const prev = previous?.sets.find(p => p.setNumber === s.setNumber)
          return <SetRow key={s.id} set={s} prev={prev} />
        })}
      </div>
      <button
        className="btn btn-ghost w-full mt-2 text-bone2 text-xs py-1.5"
        onClick={async () => {
          if (sets.length === 0) return
          const last = sets[sets.length - 1]
          await db.sets.add({
            sessionId: last.sessionId,
            exercise: last.exercise,
            exerciseOrder: last.exerciseOrder,
            setNumber: last.setNumber + 1,
            weight: last.weight,
            completed: false,
          })
          vibrate(15)
        }}
      >+ Añadir serie extra</button>
    </div>
  )
}

function SetRow({ set, prev }: { set: SetLog; prev?: SetLog }) {
  const [reps, setReps] = useState<string>(set.reps != null ? String(set.reps) : '')
  const [weight, setWeight] = useState<string>(set.weight != null ? String(set.weight) : '')
  const [completed, setCompleted] = useState(set.completed)

  const status = useAutosave({ reps, weight, completed }, async (v) => {
    await db.sets.update(set.id!, {
      reps: v.reps === '' ? undefined : Number(v.reps),
      weight: v.weight === '' ? undefined : Number(v.weight),
      completed: v.completed,
    })
  })

  function fillFromPrev() {
    if (!prev) return
    if (prev.reps != null) setReps(String(prev.reps))
    if (prev.weight != null) setWeight(String(prev.weight))
    vibrate(15)
  }

  const prevText = prev ? `${prev.weight ?? '–'}×${prev.reps ?? '–'}` : ''

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="display text-bone2 text-sm w-6 text-center">{set.setNumber}</div>
        <input className="input text-center mono" inputMode="decimal" placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
               value={reps} onChange={e => setReps(e.target.value)} />
        <span className="text-bone2 text-xs">×</span>
        <input className="input text-center mono" inputMode="decimal" placeholder={prev?.weight != null ? String(prev.weight) : 'kg'}
               value={weight} onChange={e => setWeight(e.target.value)} />
        <button onClick={() => { setCompleted(c => !c); vibrate(20) }}
          className={`btn ${completed ? 'btn-primary' : 'btn-ghost'} px-3 py-2 min-w-12`}>
          {completed ? '✓' : '○'}
        </button>
        <span className="w-2">{status === 'saving' && <span className="text-bone2 text-xs saving">●</span>}</span>
      </div>
      {prev && (
        <button onClick={fillFromPrev}
          className="ml-8 mt-0.5 text-[10px] text-bone2 mono hover:text-orange active:text-orange">
          ← anterior {prevText}kg · toca para copiar
        </button>
      )}
    </div>
  )
}

function DisciplineBlock({ date }: { date: string }) {
  const session = useLiveQuery(() => db.sessions.where('date').equals(date).first(), [date])
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [hr, setHr] = useState('')
  const [rpe, setRpe] = useState('')

  useEffect(() => {
    if (session) {
      setDistance(session.distanceKm != null ? String(session.distanceKm) : '')
      setDuration(session.durationMin != null ? String(session.durationMin) : '')
      setHr(session.avgHR != null ? String(session.avgHR) : '')
      setRpe(session.rpe != null ? String(session.rpe) : '')
    }
  }, [session?.id])

  useEffect(() => {
    (async () => {
      const s = await db.sessions.where('date').equals(date).first()
      if (!s) await db.sessions.add({ date, type: 'swim', startedAt: Date.now(), notes: '' } as any)
    })()
  }, [date])

  const status = useAutosave({ distance, duration, hr, rpe }, async (v) => {
    const s = await db.sessions.where('date').equals(date).first()
    if (!s) return
    await db.sessions.update(s.id!, {
      distanceKm: v.distance ? Number(v.distance) : undefined,
      durationMin: v.duration ? Number(v.duration) : undefined,
      avgHR: v.hr ? Number(v.hr) : undefined,
      rpe: v.rpe ? Number(v.rpe) : undefined,
    })
  })

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="display text-bone text-lg">Registro de sesión</div>
        <SaveIndicator status={status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Distancia (km)" value={distance} onChange={setDistance} placeholder="0.0" />
        <Field label="Duración (min)" value={duration} onChange={setDuration} placeholder="0" />
        <Field label="FC media (bpm)" value={hr} onChange={setHr} placeholder="0" />
        <Field label="RPE 1-10" value={rpe} onChange={setRpe} placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href="shealth://" className="btn btn-ghost text-sm">📱 Samsung Health</a>
        <GpxImport date={date} onImported={d => { setDistance(String(d.distanceKm)); setDuration(String(d.durationMin)); if (d.avgHR) setHr(String(d.avgHR)) }} />
      </div>
    </div>
  )
}

function GpxImport({ date, onImported }: { date: string; onImported: (d: { distanceKm: number; durationMin: number; avgHR?: number }) => void }) {
  return (
    <label className="btn btn-ghost text-sm cursor-pointer">
      ↑ Importar GPX
      <input type="file" accept=".gpx,application/gpx+xml,text/xml" className="hidden" onChange={async e => {
        const file = e.target.files?.[0]
        if (!file) return
        const text = await file.text()
        try {
          const result = parseGpx(text)
          onImported(result)
          // Also persist directly
          const s = await db.sessions.where('date').equals(date).first()
          if (s) await db.sessions.update(s.id!, { distanceKm: result.distanceKm, durationMin: result.durationMin, avgHR: result.avgHR })
          alert(`Importado: ${result.distanceKm}km · ${result.durationMin}min${result.avgHR ? ` · ${result.avgHR}bpm` : ''}`)
        } catch (err) {
          alert('Error parseando GPX')
        }
        e.target.value = ''
      }} />
    </label>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-bone2">{label}</span>
      <input className="input mt-1 mono" inputMode="decimal" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function NotesField({ date }: { date: string }) {
  const session = useLiveQuery(() => db.sessions.where('date').equals(date).first(), [date])
  const [notes, setNotes] = useState('')
  useEffect(() => { if (session) setNotes(session.notes ?? '') }, [session?.id])
  const status = useAutosave(notes, async (v) => {
    let s = await db.sessions.where('date').equals(date).first()
    if (!s) {
      const id = await db.sessions.add({ date, type: 'rest', startedAt: Date.now(), notes: v })
      s = await db.sessions.get(id)
    } else {
      await db.sessions.update(s.id!, { notes: v })
    }
  })
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-bone2">Notas del día</span>
        <SaveIndicator status={status} />
      </div>
      <textarea rows={3} className="input resize-none" placeholder="Sensaciones, dolor, contexto…"
                value={notes} onChange={e => setNotes(e.target.value)} />
    </div>
  )
}
