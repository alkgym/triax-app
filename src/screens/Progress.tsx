import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { db } from '../db/schema'
import { todayIso } from '../lib/dates'
import { VolumeRadar } from '../components/VolumeRadar'
import { NutritionLog } from '../components/NutritionLog'

type Tab = 'peso' | 'gym' | 'disc' | 'nutri'

export default function Progress() {
  const [tab, setTab] = useState<Tab>('peso')
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <h1 className="display text-bone text-3xl">Progreso</h1>
      <div className="grid grid-cols-4 gap-1 p-1 bg-ink2 border border-line rounded-lg">
        {(['peso', 'gym', 'disc', 'nutri'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2 text-[10px] uppercase tracking-widest font-bold rounded ${tab === t ? 'bg-orange text-ink' : 'text-bone2'}`}>
            {t === 'peso' ? 'Peso' : t === 'gym' ? 'Gym' : t === 'disc' ? 'Disc.' : 'Nutri'}
          </button>
        ))}
      </div>
      {tab === 'peso' && <PesoTab />}
      {tab === 'gym' && <GymTab />}
      {tab === 'disc' && <DiscTab />}
      {tab === 'nutri' && <NutritionLog />}
    </div>
  )
}

function PesoTab() {
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').toArray())
  const [w, setW] = useState('')
  const [date, setDate] = useState(todayIso())
  async function add() {
    if (!w) return
    await db.bodyMetrics.put({ date, weight: Number(w) })
    setW('')
  }
  const data = (metrics ?? []).filter(m => m.weight != null).map(m => ({ date: m.date.slice(5), peso: m.weight! }))
  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="text-[10px] uppercase tracking-widest text-bone2 mb-2">Registrar peso</div>
        <div className="flex gap-2">
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          <input className="input mono" inputMode="decimal" placeholder="kg" value={w} onChange={e => setW(e.target.value)} />
          <button className="btn btn-primary" onClick={add}>+</button>
        </div>
      </div>
      <div className="card p-3 h-64">
        {data.length === 0 ? <div className="text-bone2 text-sm h-full flex items-center justify-center">Sin datos aún</div> :
          <ResponsiveContainer><LineChart data={data}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis stroke="#A9A39A" fontSize={10} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
            <Line type="monotone" dataKey="peso" stroke="#FF6B2B" strokeWidth={2} dot={{ fill: '#FF6B2B', r: 3 }} />
          </LineChart></ResponsiveContainer>}
      </div>
      <div className="card p-3 space-y-1">
        {(metrics ?? []).slice(-10).reverse().map(m => (
          <div key={m.id} className="flex justify-between text-sm">
            <span className="text-bone2">{m.date}</span>
            <span className="mono text-bone">{m.weight} kg</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GymTab() {
  const sessions = useLiveQuery(() => db.sessions.where('type').anyOf('push', 'pull', 'fullbody').toArray())
  const sets = useLiveQuery(() => db.sets.toArray())
  const exercises = Array.from(new Set((sets ?? []).map(s => s.exercise)))
  const [exercise, setExercise] = useState<string>('')
  const sel = exercise || exercises[0] || ''

  const data = (sets ?? [])
    .filter(s => s.exercise === sel && s.weight != null && s.completed)
    .map(s => {
      const sess = sessions?.find(ss => ss.id === s.sessionId)
      return { date: sess?.date ?? '', weight: s.weight! }
    })
    .filter(d => d.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ date: d.date.slice(5), peso: d.weight }))

  return (
    <div className="space-y-3">
      <VolumeRadar />
      <select className="input" value={sel} onChange={e => setExercise(e.target.value)}>
        {exercises.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      <div className="card p-3 h-64">
        {data.length === 0 ? <div className="text-bone2 text-sm h-full flex items-center justify-center">Aún no hay datos</div> :
          <ResponsiveContainer><LineChart data={data}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis stroke="#A9A39A" fontSize={10} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
            <Line type="monotone" dataKey="peso" stroke="#FF6B2B" strokeWidth={2} dot={{ fill: '#FF6B2B', r: 3 }} />
          </LineChart></ResponsiveContainer>}
      </div>
      <PRBlock />
    </div>
  )
}

function PRBlock() {
  const prs = useLiveQuery(() => db.prs.toArray())
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
      <div className="display text-bone text-lg">PRs</div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
        <input className="input" placeholder="Ejercicio" value={exercise} onChange={e => setExercise(e.target.value)} />
        <input className="input mono w-16" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)} />
        <input className="input mono w-12" placeholder="x" value={reps} onChange={e => setReps(e.target.value)} />
        <button className="btn btn-primary" onClick={add}>+</button>
      </div>
      <div className="space-y-1">
        {(prs ?? []).slice().reverse().map(p => (
          <div key={p.id} className="flex justify-between text-sm">
            <span className="text-bone">{p.exercise}</span>
            <span className="mono text-orange">{p.weight}kg × {p.reps}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiscTab() {
  const sessions = useLiveQuery(() => db.sessions.where('type').anyOf('swim', 'bike', 'run', 'brick').toArray())
  if (!sessions) return null
  const totals = { swim: 0, bike: 0, run: 0 }
  sessions.forEach(s => {
    if (s.distanceKm) {
      if (s.type === 'swim') totals.swim += s.distanceKm
      if (s.type === 'bike') totals.bike += s.distanceKm
      if (s.type === 'run' || s.type === 'brick') totals.run += s.distanceKm
    }
  })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Nado" value={totals.swim.toFixed(1)} unit="km" color="#06B6D4" />
        <Stat label="Bici" value={totals.bike.toFixed(0)} unit="km" color="#22C55E" />
        <Stat label="Carrera" value={totals.run.toFixed(1)} unit="km" color="#EF4444" />
      </div>
      <div className="card p-3 space-y-1">
        {sessions.filter(s => s.completedAt).slice(-15).reverse().map(s => (
          <div key={s.id} className="flex justify-between text-sm border-b border-line py-1">
            <span className="text-bone2">{s.date} · {s.type}</span>
            <span className="mono text-bone">{s.distanceKm ?? '—'} km · {s.durationMin ?? '—'} min</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-bone2">{label}</div>
      <div className="display text-2xl mt-1" style={{ color }}>{value}<span className="text-bone2 text-xs ml-1">{unit}</span></div>
    </div>
  )
}
