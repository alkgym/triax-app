import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { db, type PlanDay, type WorkoutType } from '../db/schema'
import { fmtDate, todayIso } from '../lib/dates'
import { TYPE_META, PHASE_META } from '../lib/types'
import { useAutosave } from '../db/hooks'
import { SaveIndicator } from '../components/SaveIndicator'
import { WorkoutPreview } from '../components/WorkoutPreview'

export default function Plan() {
  const allDays = useLiveQuery(() => db.planDays.orderBy('date').toArray())
  const sessions = useLiveQuery(() => db.sessions.toArray())

  if (!allDays) return <div className="p-4 text-bone2">Cargando plan…</div>

  // Group by week
  const byWeek = new Map<number, PlanDay[]>()
  allDays.forEach(d => {
    if (!byWeek.has(d.weekNumber)) byWeek.set(d.weekNumber, [])
    byWeek.get(d.weekNumber)!.push(d)
  })

  const completedDates = new Set(sessions?.filter(s => s.completedAt).map(s => s.date) ?? [])

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header>
        <h1 className="display text-bone text-3xl">Plan · 21 semanas</h1>
        <p className="text-bone2 text-sm">4 May 2026 → 27 Sep 2026 · Artiem Half Menorca Short</p>
      </header>

      <div className="space-y-3">
        {[...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([w, days]) => {
          const phase = days[0].phase
          const phaseMeta = PHASE_META[phase]
          const isDeload = days.some(d => d.isDeload)
          return (
            <div key={w} className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="display text-bone text-xl leading-none">SEM {w}</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: phaseMeta.color }}>{phaseMeta.label}</div>
                </div>
                {isDeload && <span className="chip text-orange border-orange">Deload</span>}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map(d => {
                  const meta = TYPE_META[d.type]
                  const done = completedDates.has(d.date)
                  const isToday = d.date === todayIso()
                  const isRace = d.date === '2026-09-27'
                  return (
                    <Link key={d.date} to={`/plan/${d.date}`}
                      className={`aspect-square rounded-md flex flex-col items-center justify-center relative ${isToday ? 'ring-2 ring-orange' : ''} ${isRace ? 'ring-2 ring-yellow-400' : ''}`}
                      style={{ background: meta.bg, border: `1px solid ${meta.color}33` }}>
                      <div className="text-[9px] text-bone2">{d.date.slice(8, 10)}</div>
                      <div className="text-sm" style={{ color: meta.color }}>{meta.emoji}</div>
                      {done && <div className="absolute top-0.5 right-0.5 text-[8px] text-green-400">✓</div>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlanDayDetail() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const day = useLiveQuery(() => date ? db.planDays.where('date').equals(date).first() : undefined, [date])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<WorkoutType>('rest')
  const [intensity, setIntensity] = useState('')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')

  useEffect(() => {
    if (day) {
      setTitle(day.title); setDescription(day.description); setType(day.type)
      setIntensity(day.intensity ?? '')
      setDistance(day.targetDistanceKm != null ? String(day.targetDistanceKm) : '')
      setDuration(day.targetDurationMin != null ? String(day.targetDurationMin) : '')
    }
  }, [day?.id])

  const status = useAutosave({ title, description, type, intensity, distance, duration }, async (v) => {
    if (!day?.id) return
    await db.planDays.update(day.id, {
      title: v.title, description: v.description, type: v.type, intensity: v.intensity || undefined,
      targetDistanceKm: v.distance ? Number(v.distance) : undefined,
      targetDurationMin: v.duration ? Number(v.duration) : undefined,
    })
  })

  if (!day) return <div className="p-4 text-bone2">Día no encontrado.</div>
  const meta = TYPE_META[day.type]

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn btn-ghost px-3">‹ Volver</button>
        <SaveIndicator status={status} />
      </header>
      <div>
        <div className="text-bone2 text-xs uppercase tracking-widest">{fmtDate(day.date)}</div>
        <h1 className="display text-bone text-3xl">Sem {day.weekNumber} · {PHASE_META[day.phase].label}</h1>
      </div>

      <div className="card p-3 space-y-3" style={{ borderColor: meta.color + '55' }}>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-bone2">Tipo</span>
          <select className="input mt-1" value={type} onChange={e => setType(e.target.value as WorkoutType)}>
            {(['push','pull','fullbody','swim','bike','run','brick','rest'] as WorkoutType[]).map(t => (
              <option key={t} value={t}>{TYPE_META[t].emoji} {TYPE_META[t].label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-bone2">Título</span>
          <input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-bone2">Descripción</span>
          <textarea className="input mt-1" rows={4} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-bone2">Distancia km</span>
            <input className="input mt-1 mono" inputMode="decimal" value={distance} onChange={e => setDistance(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-bone2">Duración min</span>
            <input className="input mt-1 mono" inputMode="decimal" value={duration} onChange={e => setDuration(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-bone2">Intensidad</span>
            <input className="input mt-1" value={intensity} onChange={e => setIntensity(e.target.value)} />
          </label>
        </div>
      </div>

      <WorkoutPreview
        date={day.date}
        type={type}
        intensity={intensity}
        distanceKm={distance ? Number(distance) : undefined}
        durationMin={duration ? Number(duration) : undefined}
        drill={day.drill}
        description={description}
        isBrick={day.isBrick}
      />
    </div>
  )
}
