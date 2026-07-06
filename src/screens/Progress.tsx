import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { db } from '../db/schema'
import { todayIso, shortDate } from '../lib/dates'
import { VolumeRadar } from '../components/VolumeRadar'
import { MuscleVolume } from '../components/MuscleVolume'
import { Achievements } from '../components/Achievements'
import { WeeklySummary } from '../components/WeeklySummary'
import { WeightPainChart } from '../components/WeightPainChart'
import { ScreenHeader } from '../components/ScreenHeader'
import { isGymType } from '../hooks/useWorkoutSession'
import { downloadBackup } from '../lib/backup'
import { upsertWeight } from '../db/queries'
import { setE1RM } from '../lib/progression'
import { BloodPressurePanel } from '../components/BloodPressurePanel'

type Tab = 'resumen' | 'gym' | 'cardio' | 'peso'

const TAB_LABEL: Record<Tab, string> = { resumen: 'Resumen', gym: 'Gym', cardio: 'Cardio', peso: 'Salud' }

export default function Progress() {
  const [tab, setTab] = useState<Tab>('resumen')
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <ScreenHeader title="Progreso" />
      <div className="grid grid-cols-4 gap-0.5 p-0.5 rounded-lg"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {(['resumen', 'gym', 'cardio', 'peso'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="py-2 text-[12px] font-medium rounded-md transition-colors"
            style={tab === t ? {
              background: 'var(--surface-1)', color: 'var(--text)', border: '1px solid var(--border-strong)',
            } : { color: 'var(--text-3)', border: '1px solid transparent' }}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === 'resumen' && <ResumenTab />}
      {tab === 'gym' && <GymTab />}
      {tab === 'cardio' && <CardioTab />}
      {tab === 'peso' && <PesoTab />}
    </div>
  )
}

function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}

function ResumenTab() {
  const today = todayIso()
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const pains = useLiveQuery(() => db.painLogs.orderBy('date').toArray())
  const lastWeight = useLiveQuery(async () => (await db.bodyMetrics.orderBy('date').reverse().limit(1).toArray())[0])

  if (!sessions || !pains) return <div className="text-[13px]" style={{ color: 'var(--text-3)' }}>Cargando…</div>

  const isDone = (s: any) => !!s.completedAt || !!s.isExtra
  const doneDates = new Set(sessions.filter(isDone).map(s => s.date))

  // Racha: días consecutivos con algún entreno registrado
  let streak = 0; let cursor = today
  while (doneDates.has(cursor)) {
    streak++
    const d = new Date(cursor + 'T00:00:00'); d.setDate(d.getDate() - 1); cursor = d.toISOString().slice(0, 10)
  }

  // Esta semana (lun→dom)
  const dow = (new Date(today + 'T00:00:00').getDay() + 6) % 7
  const monday = new Date(today + 'T00:00:00'); monday.setDate(monday.getDate() - dow)
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10) })
  const weekDone = sessions.filter(s => isDone(s) && weekDays.includes(s.date)).length

  const gymSess = sessions.filter(s => isGymType(s.type) && isDone(s)).length
  const cardio = sessions.filter(s => isDone(s) && ['run', 'bike', 'bike_indoor', 'swim', 'swim_pool'].includes(s.type))
  const swimKm = cardio.filter(s => s.type === 'swim' || s.type === 'swim_pool').reduce((a, s) => a + (s.distanceKm ?? 0), 0)
  const bikeKm = cardio.filter(s => s.type === 'bike' || s.type === 'bike_indoor').reduce((a, s) => a + (s.distanceKm ?? 0), 0)
  const runKm = cardio.filter(s => s.type === 'run').reduce((a, s) => a + (s.distanceKm ?? 0), 0)

  // Dolor
  const sortedPain = pains.slice().sort((a, b) => (a.date + a.timestamp).localeCompare(b.date + b.timestamp))
  const lastPain = sortedPain[sortedPain.length - 1]
  const last7 = sortedPain.filter(p => p.date >= weekDays[0])
  const avg7 = last7.length ? last7.reduce((a, p) => a + p.level, 0) / last7.length : null
  const byDay = new Map<string, number[]>()
  for (const p of sortedPain) { const arr = byDay.get(p.date) ?? []; arr.push(p.level); byDay.set(p.date, arr) }
  const painData = Array.from(byDay.entries())
    .map(([date, vals]) => ({ date: shortDate(date), dolor: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) }))
    .slice(-21)

  async function exportBackup() {
    await downloadBackup()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Racha" value={String(streak)} unit="días seguidos" color="#F59E0B" />
        <StatCard label="Esta semana" value={String(weekDone)} unit="entrenos" color="#FF5722" />
        <StatCard label="Gym total" value={String(gymSess)} unit="sesiones" color="#A78BFA" />
        <StatCard label="Dolor (7d)" value={avg7 != null ? avg7.toFixed(1) : '—'} unit={lastPain ? `último ${lastPain.level}/10` : 'sin registros'} color={avg7 != null ? painColor(avg7) : '#525252'} />
      </div>

      <WeeklySummary />

      <Achievements />

      {/* Curva de dolor */}
      {painData.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Evolución del dolor</div>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={painData} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="painFillR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B2B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#FF6B2B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
                <YAxis stroke="#A9A39A" fontSize={10} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626', borderRadius: 8 }} />
                <ReferenceLine y={5} stroke="#F59E0B" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="dolor" stroke="#FF6B2B" strokeWidth={2} fill="url(#painFillR)" dot={{ fill: '#FF6B2B', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Volumen cardio acumulado (sin objetivos) */}
      <div className="card p-4 space-y-3">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Cardio acumulado</div>
        <div className="grid grid-cols-3 gap-3">
          <VolumeItem label="Nado" value={swimKm.toFixed(1)} unit="km" color="#22D3EE" />
          <VolumeItem label="Bici" value={bikeKm.toFixed(0)} unit="km" color="#34D399" />
          <VolumeItem label="Correr" value={runKm.toFixed(1)} unit="km" color="#FF5722" />
        </div>
      </div>

      {lastWeight?.weight != null && (
        <div className="card p-4 flex items-baseline justify-between">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Último peso</span>
          <span className="num font-semibold" style={{ color: 'var(--text)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {lastWeight.weight}<span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 4 }}>kg</span>
          </span>
        </div>
      )}

      <button onClick={exportBackup} className="btn btn-ghost w-full text-sm">↓ Exportar backup JSON</button>
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: color }} />
      <div className="text-[11px] font-semibold uppercase" style={{ color, letterSpacing: '0.08em' }}>{label}</div>
      <div className="num font-semibold leading-none mt-2" style={{ color: 'var(--text)', fontSize: '38px', letterSpacing: '-0.03em' }}>{value}</div>
      <div className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>{unit}</div>
    </div>
  )
}

function VolumeItem({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase" style={{ color, letterSpacing: '0.1em' }}>{label}</div>
      <div className="num font-semibold mt-1.5" style={{ color: 'var(--text)', fontSize: '30px', lineHeight: 1, letterSpacing: '-0.025em' }}>
        {value}<span className="text-[13px] font-normal ml-1" style={{ color: 'var(--text-3)' }}>{unit}</span>
      </div>
    </div>
  )
}

function PesoTab() {
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').toArray())
  const [w, setW] = useState('')
  const [date, setDate] = useState(todayIso())
  async function add() {
    if (!w) return
    await upsertWeight(date, Number(w))
    setW('')
  }
  const data = (metrics ?? []).filter(m => m.weight != null).map(m => ({ date: m.date.slice(5), peso: m.weight! }))
  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Registrar peso</div>
        <div className="flex gap-2">
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          <input className="input num" inputMode="decimal" placeholder="kg" value={w} onChange={e => setW(e.target.value)} />
          <button className="btn btn-primary" onClick={add}>+</button>
        </div>
      </div>
      <div className="card p-3 h-64">
        {data.length === 0 ? <div className="text-[13px] h-full flex items-center justify-center" style={{ color: 'var(--text-3)' }}>Sin datos aún</div> :
          <ResponsiveContainer><LineChart data={data}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis stroke="#A9A39A" fontSize={10} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
            <Line type="monotone" dataKey="peso" stroke="#FF6B2B" strokeWidth={2} dot={{ fill: '#FF6B2B', r: 3 }} />
          </LineChart></ResponsiveContainer>}
      </div>
      <WeightPainChart />
      <div className="card p-3 space-y-1">
        {(metrics ?? []).slice().reverse().map(m => <MetricRow key={m.id} metric={m} />)}
      </div>
      <div className="text-[11px] font-semibold uppercase px-1 pt-2" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Tensión arterial</div>
      <BloodPressurePanel />
    </div>
  )
}

function MetricRow({ metric: m }: { metric: { id?: number; date: string; weight?: number } }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span style={{ color: 'var(--text-3)' }}>{m.date}</span>
      <div className="flex items-center gap-2">
        <span className="num" style={{ color: 'var(--text)' }}>{m.weight} kg</span>
        {confirm ? (
          <div className="flex gap-1">
            <button onClick={() => setConfirm(false)} className="text-[11px] px-1.5" style={{ color: 'var(--text-3)' }}>No</button>
            <button onClick={async () => { await db.bodyMetrics.delete(m.id!); setConfirm(false) }} className="text-[11px] px-1.5" style={{ color: '#EF4444' }}>Borrar</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="px-1" style={{ color: 'var(--text-3)' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function GymTab() {
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const sets = useLiveQuery(() => db.sets.toArray())
  const exercises = Array.from(new Set((sets ?? []).map(s => s.exercise)))
  const [exercise, setExercise] = useState<string>('')
  const sel = exercise || exercises[0] || ''

  // Por sesión: mejor peso real y mejor e1RM (Epley) — dos señales de progreso
  const bySession = new Map<string, { peso: number; e1rm: number }>()
  for (const s of sets ?? []) {
    if (s.exercise !== sel || s.weight == null || !s.completed) continue
    const sess = sessions?.find(ss => ss.id === s.sessionId)
    if (!sess?.date) continue
    const cur = bySession.get(sess.date) ?? { peso: 0, e1rm: 0 }
    cur.peso = Math.max(cur.peso, s.weight)
    const e1 = setE1RM(s)
    if (e1 != null) cur.e1rm = Math.max(cur.e1rm, Math.round(e1 * 10) / 10)
    bySession.set(sess.date, cur)
  }
  const data = Array.from(bySession.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date: date.slice(5), peso: v.peso, e1rm: v.e1rm > 0 ? v.e1rm : undefined }))

  return (
    <div className="space-y-3">
      <MuscleVolume />
      <VolumeRadar />
      <select className="input" value={sel} onChange={e => setExercise(e.target.value)}>
        {exercises.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      <div className="card p-3 h-64">
        {data.length === 0 ? <div className="text-[13px] h-full flex items-center justify-center" style={{ color: 'var(--text-3)' }}>Aún no hay datos</div> :
          <ResponsiveContainer><LineChart data={data}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis stroke="#A9A39A" fontSize={10} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
            <Line name="Mejor peso" type="monotone" dataKey="peso" stroke="#FF6B2B" strokeWidth={2} dot={{ fill: '#FF6B2B', r: 3 }} />
            <Line name="e1RM est." type="monotone" dataKey="e1rm" stroke="#A78BFA" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
          </LineChart></ResponsiveContainer>}
      </div>
      <div className="text-[11px] px-1" style={{ color: 'var(--text-3)' }}>
        — <span style={{ color: '#FF6B2B' }}>mejor peso</span> por sesión · <span style={{ color: '#A78BFA' }}>e1RM estimado</span> (peso × reps, fórmula de Epley)
      </div>
      <PRBlock />
    </div>
  )
}

function PRBlock() {
  const prs = useLiveQuery(() => db.prs.orderBy('date').toArray())
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  async function add() {
    if (!exercise || !weight) return
    await db.prs.add({ exercise, weight: Number(weight), reps: Number(reps || '1'), date: todayIso() })
    setExercise(''); setWeight(''); setReps('')
  }
  return (
    <div className="card p-3 space-y-2">
      <div className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>PRs · Marcas personales</div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
        <input className="input" placeholder="Ejercicio" value={exercise} onChange={e => setExercise(e.target.value)} />
        <input className="input num w-16" placeholder="kg" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} />
        <input className="input num w-12" placeholder="reps" inputMode="numeric" value={reps} onChange={e => setReps(e.target.value)} />
        <button className="btn btn-primary" onClick={add}>+</button>
      </div>
      <div className="space-y-1">
        {(prs ?? []).slice().reverse().map(p => <PRRow key={p.id} pr={p} />)}
        {(prs ?? []).length === 0 && <div className="text-[12px] text-center py-2" style={{ color: 'var(--text-3)' }}>Sin marcas registradas aún</div>}
      </div>
    </div>
  )
}

function PRRow({ pr: p }: { pr: { id?: number; exercise: string; weight: number; reps: number; date: string } }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <div className="min-w-0">
        <span style={{ color: 'var(--text)' }}>{p.exercise}</span>
        <span className="num text-[10px] ml-2" style={{ color: 'var(--text-3)' }}>{p.date}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="num font-bold" style={{ color: 'var(--accent)' }}>{p.weight}kg × {p.reps}</span>
        {confirm ? (
          <div className="flex gap-1">
            <button onClick={() => setConfirm(false)} className="text-[11px] px-1.5" style={{ color: 'var(--text-3)' }}>No</button>
            <button onClick={async () => { await db.prs.delete(p.id!); setConfirm(false) }} className="text-[11px] px-1.5" style={{ color: '#EF4444' }}>Borrar</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="px-1" style={{ color: 'var(--text-3)' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function fmtPaceKm(secPerKm: number | undefined): string {
  if (!secPerKm || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60); const s = Math.round(secPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}/km`
}
function fmtPace100m(sec100m: number | undefined): string {
  if (!sec100m || sec100m <= 0) return '—'
  const m = Math.floor(sec100m / 60); const s = Math.round(sec100m % 60)
  return `${m}:${s.toString().padStart(2, '0')}/100m`
}
function fmtSpeed(distKm: number, durMin: number): string {
  if (!distKm || !durMin) return '—'
  return (distKm / (durMin / 60)).toFixed(1) + ' km/h'
}

function CardioTab() {
  const sessions = useLiveQuery(() => db.sessions.filter(s => ['swim', 'swim_pool', 'bike', 'bike_indoor', 'run'].includes(s.type)).toArray())
  if (!sessions) return null
  const totals = { swim: 0, bike: 0, run: 0 }
  sessions.forEach(s => {
    if (s.distanceKm) {
      if (s.type === 'swim' || s.type === 'swim_pool') totals.swim += s.distanceKm
      if (s.type === 'bike' || s.type === 'bike_indoor') totals.bike += s.distanceKm
      if (s.type === 'run') totals.run += s.distanceKm
    }
  })
  const done = sessions.filter(s => s.completedAt || s.isExtra).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Nado" value={totals.swim.toFixed(1)} unit="km" color="#06B6D4" />
        <Stat label="Bici" value={totals.bike.toFixed(0)} unit="km" color="#22C55E" />
        <Stat label="Correr" value={totals.run.toFixed(1)} unit="km" color="#EF4444" />
      </div>
      <div className="card p-3 space-y-0">
        {done.slice(0, 30).map(s => (
          <div key={s.id} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex justify-between text-sm">
              <span className="num" style={{ color: 'var(--text-3)' }}>{s.date}</span>
              <span className="uppercase text-xs tracking-widest" style={{ color: 'var(--text)' }}>{s.type}</span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="num text-sm" style={{ color: 'var(--accent)' }}>{s.distanceKm ?? '—'} km · {s.durationMin ?? '—'} min</span>
              <span className="num text-xs" style={{ color: 'var(--text-3)' }}>
                {s.type === 'swim' || s.type === 'swim_pool' ? fmtPace100m(s.avgPaceSec100m) :
                 (s.type === 'bike' || s.type === 'bike_indoor') && s.distanceKm && s.durationMin ? fmtSpeed(s.distanceKm, s.durationMin) :
                 fmtPaceKm(s.avgPaceSecPerKm)}
              </span>
            </div>
            {s.painProvoked != null && <div className="text-[10px] num" style={{ color: painColor(s.painProvoked) }}>dolor {s.painProvoked}/10</div>}
          </div>
        ))}
        {done.length === 0 && <div className="text-[13px] py-4 text-center" style={{ color: 'var(--text-3)' }}>Sin sesiones de cardio aún</div>}
      </div>
    </div>
  )
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="num text-2xl mt-1 font-semibold" style={{ color }}>{value}<span className="text-xs ml-1" style={{ color: 'var(--text-3)' }}>{unit}</span></div>
    </div>
  )
}
