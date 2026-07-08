import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { db, type PainLocation, type PainContext, type TimeOfDay } from '../db/schema'
import { todayIso, shortDate } from '../lib/dates'
import {
  TIME_OF_DAY_META, REHAB_PHASE_META, REHAB_CATEGORY_LABEL,
  CONTRAINDICATIONS, recommendRehab, suggestedPhase, morningWindow,
} from '../lib/rehab'
import { BackMap } from '../components/BackMap'
import { PainCalendar } from '../components/PainCalendar'
import { ScreenHeader } from '../components/ScreenHeader'

const CONTEXT_META: Record<PainContext, string> = {
  'reposo': 'En reposo', 'manana': 'Por la mañana', 'tras-gym': 'Tras gym',
  'tras-correr': 'Tras correr', 'tras-bici': 'Tras bici', 'tras-nadar': 'Tras nadar',
  'tras-futbol': 'Tras fútbol', 'tras-sentarse': 'Tras estar sentado',
  'tras-dormir': 'Tras dormir', 'otro': 'Otro',
}

function levelColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}

export default function Lesion() {
  const logs = useLiveQuery(() => db.painLogs.orderBy('date').toArray())
  const rehab = useLiveQuery(() => db.rehabExercises.toArray())

  const sorted = useMemo(
    () => (logs ?? []).slice().sort((a, b) => (a.date + a.timestamp).localeCompare(b.date + b.timestamp)),
    [logs],
  )
  const latest = sorted[sorted.length - 1]
  const currentLevel = latest?.level ?? 0
  const phase = suggestedPhase(currentLevel)
  const phaseMeta = REHAB_PHASE_META[phase]

  const mw = morningWindow()

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <ScreenHeader title="Lesión" sub="Abombamiento discal L2-L5 · seguimiento y readaptación" />

      {/* Aviso ventana matutina */}
      {mw.active && (
        <div className="card p-4" style={{ borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)' }}>
          <div className="text-[12px] font-semibold uppercase" style={{ color: '#EF4444', letterSpacing: '0.06em' }}>
            🌅 Ventana matutina · {mw.minsLeft} min restantes
          </div>
          <div className="text-[13px] mt-1.5" style={{ color: 'var(--text-2)' }}>
            El disco está rehidratado: tolera ~18% menos carga en flexión. Evita cargas pesadas,
            flexión de tronco e impacto hasta completar los primeros 120 min de pie.
          </div>
        </div>
      )}

      {/* Estado actual + fase sugerida */}
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: phaseMeta.color }} />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Dolor actual</div>
            <div className="text-[13px] mt-2 font-semibold" style={{ color: phaseMeta.color }}>{phaseMeta.label}</div>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{phaseMeta.desc}</div>
            {latest && <div className="text-[11px] num mt-1.5" style={{ color: 'var(--text-3)' }}>último: {latest.date}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className="num font-bold leading-none" style={{ fontSize: '72px', letterSpacing: '-0.06em', color: levelColor(currentLevel) }}>
              {currentLevel}
            </div>
            <div className="text-[11px] mt-1 font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.1em' }}>/ 10</div>
          </div>
        </div>
      </div>

      <PainLogForm />

      {sorted.length > 0 && <PainTrend logs={sorted} />}

      <PainCalendar />

      {sorted.length >= 3 && <Correlations logs={sorted} />}

      <ExercisePainCorrelation />

      <NextDayCorrelation />

      <RehabRecommendations level={currentLevel} library={rehab ?? []} />

      <Contraindications />

      {sorted.length > 0 && <RecentLogs logs={sorted.slice().reverse()} />}
    </div>
  )
}

function PainLogForm() {
  const [level, setLevel] = useState(2)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('AM')
  const [locations, setLocations] = useState<PainLocation[]>([])
  const [context, setContext] = useState<PainContext>('reposo')
  const [trigger, setTrigger] = useState('')
  const [date, setDate] = useState(todayIso())
  const [saved, setSaved] = useState(false)

  function toggleLoc(l: PainLocation) {
    setLocations(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])
  }

  async function save() {
    await db.painLogs.add({
      date, timeOfDay, level, locations, context,
      trigger: trigger.trim() || undefined,
      timestamp: Date.now(),
    })
    setTrigger(''); setLocations([]); setLevel(2)
    setSaved(true); setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Registrar dolor</div>

      {/* Nivel */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Nivel</span>
          <span className="num font-bold text-[20px]" style={{ color: levelColor(level) }}>{level}</span>
        </div>
        <input type="range" min={0} max={10} step={1} value={level}
          onChange={e => setLevel(Number(e.target.value))}
          className="w-full" style={{ accentColor: levelColor(level) }} />
        <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          <span>Sin dolor</span><span>Máximo</span>
        </div>
      </div>

      {/* Momento del día */}
      <div>
        <div className="text-[12px] mb-2" style={{ color: 'var(--text-2)' }}>Momento</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(TIME_OF_DAY_META) as TimeOfDay[]).map(t => (
            <button key={t} onClick={() => setTimeOfDay(t)}
              className="py-2 rounded-lg text-[11px] font-medium transition-colors"
              style={timeOfDay === t
                ? { background: 'var(--surface-1)', color: 'var(--text)', border: '1px solid var(--border-strong)' }
                : { color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              {TIME_OF_DAY_META[t].emoji}<br />{TIME_OF_DAY_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Ubicación — mapa lumbar interactivo */}
      <div>
        <div className="text-[12px] mb-2" style={{ color: 'var(--text-2)' }}>¿Dónde te duele? <span style={{ color: 'var(--text-3)' }}>(toca el disco)</span></div>
        <BackMap selected={locations} onToggle={toggleLoc} />
      </div>

      {/* Contexto */}
      <div>
        <div className="text-[12px] mb-2" style={{ color: 'var(--text-2)' }}>¿Cuándo / tras qué?</div>
        <select className="input" value={context} onChange={e => setContext(e.target.value as PainContext)}>
          {(Object.keys(CONTEXT_META) as PainContext[]).map(c => (
            <option key={c} value={c}>{CONTEXT_META[c]}</option>
          ))}
        </select>
      </div>

      {/* Trigger + fecha */}
      <div className="flex gap-2">
        <input type="date" className="input shrink-0" style={{ width: 150 }} value={date} onChange={e => setDate(e.target.value)} />
        <input className="input flex-1" placeholder="Qué crees que lo provocó (opcional)" value={trigger} onChange={e => setTrigger(e.target.value)} />
      </div>

      <button className="btn btn-primary w-full" onClick={save}>
        {saved ? '✓ Registrado' : 'Guardar registro'}
      </button>
    </div>
  )
}

function PainTrend({ logs }: { logs: { date: string; level: number }[] }) {
  // Promedio por día (puede haber varios registros/día)
  const byDay = new Map<string, number[]>()
  for (const l of logs) {
    const arr = byDay.get(l.date) ?? []
    arr.push(l.level); byDay.set(l.date, arr)
  }
  const data = Array.from(byDay.entries())
    .map(([date, vals]) => ({ date: shortDate(date), dolor: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) }))
    .slice(-30)

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Evolución del dolor</div>
      <div className="h-52">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="painFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B2B" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FF6B2B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis stroke="#A9A39A" fontSize={10} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626', borderRadius: 8 }} />
            <ReferenceLine y={5} stroke="#F59E0B" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="dolor" stroke="#FF6B2B" strokeWidth={2} fill="url(#painFill)" dot={{ fill: '#FF6B2B', r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Correlations({ logs }: { logs: { context: PainContext; level: number }[] }) {
  // Dolor medio por contexto → qué actividades duelen más
  const agg = new Map<PainContext, { sum: number; n: number }>()
  for (const l of logs) {
    const a = agg.get(l.context) ?? { sum: 0, n: 0 }
    a.sum += l.level; a.n += 1; agg.set(l.context, a)
  }
  const rows = Array.from(agg.entries())
    .map(([ctx, { sum, n }]) => ({ ctx, avg: sum / n, n }))
    .filter(r => r.n >= 1)
    .sort((a, b) => b.avg - a.avg)

  if (rows.length === 0) return null

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Qué te da más dolor</div>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.ctx}>
            <div className="flex justify-between text-[12px] mb-1">
              <span style={{ color: 'var(--text-2)' }}>{CONTEXT_META[r.ctx]} <span style={{ color: 'var(--text-3)' }}>· {r.n}×</span></span>
              <span className="num" style={{ color: levelColor(r.avg) }}>{r.avg.toFixed(1)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full transition-all" style={{ width: `${(r.avg / 10) * 100}%`, background: levelColor(r.avg) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        Media de dolor registrada en cada contexto. Cuantos más registros, más fiable.
      </div>
    </div>
  )
}

function RehabRecommendations({ level, library }: { level: number; library: any[] }) {
  const recs = recommendRehab(level, library as any)
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>
        Ejercicios recomendados hoy
      </div>
      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
        Según tu dolor actual ({level}/10) · {REHAB_PHASE_META[suggestedPhase(level)].label}
      </div>
      {recs.length === 0 && (
        <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
          Con este nivel de dolor, prioriza descanso en posición de descarga (tumbado, almohada bajo rodillas) y consulta a tu fisio.
        </div>
      )}
      <div className="space-y-2">
        {recs.map((e: any) => (
          <div key={e.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button onClick={() => setOpen(open === e.id ? null : e.id)}
              className="w-full flex items-center justify-between gap-2 p-3 text-left">
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{e.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: REHAB_PHASE_META[e.phase as 1|2|3].color }}>
                  {REHAB_CATEGORY_LABEL[e.category as keyof typeof REHAB_CATEGORY_LABEL]} · {e.sets ?? ''}
                </div>
              </div>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{open === e.id ? '−' : '+'}</span>
            </button>
            {open === e.id && (
              <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="text-[12px] pt-2" style={{ color: 'var(--text-2)' }}><b>Cómo:</b> {e.cues}</div>
                <div className="text-[12px]" style={{ color: 'var(--text-3)' }}><b>Por qué:</b> {e.why}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const ACTIVITY_LABEL: Record<string, string> = {
  push: 'Push', pull: 'Pull', fullbody: 'Full Body', legs: 'Legs', torso: 'Torso',
  run: 'Correr', bike: 'Bici', bike_indoor: 'Bici indoor', swim: 'Nado', swim_pool: 'Piscina',
  futbol: 'Fútbol', gym_free: 'Gym libre', rest: 'Descanso', brick: 'Brick',
}

function ExercisePainCorrelation() {
  const sets = useLiveQuery(() => db.sets.filter(s => s.painProvoked != null).toArray())
  if (!sets || sets.length === 0) return null
  const agg = new Map<string, { sum: number; n: number }>()
  for (const s of sets) {
    const a = agg.get(s.exercise) ?? { sum: 0, n: 0 }
    a.sum += s.painProvoked!; a.n += 1; agg.set(s.exercise, a)
  }
  const rows = Array.from(agg.entries())
    .map(([name, { sum, n }]) => ({ name, avg: sum / n, n }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8)

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Ejercicios que más te duelen</div>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.name}>
            <div className="flex justify-between text-[12px] mb-1 gap-2">
              <span className="truncate" style={{ color: 'var(--text-2)' }}>{r.name}</span>
              <span className="num shrink-0" style={{ color: levelColor(r.avg) }}>{r.avg.toFixed(1)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full" style={{ width: `${(r.avg / 10) * 100}%`, background: levelColor(r.avg) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Dolor lumbar que etiquetas en cada ejercicio del gym.</div>
    </div>
  )
}

function NextDayCorrelation() {
  const checkins = useLiveQuery(() => db.painLogs.filter(p => !!p.nextDayOf).toArray())
  const sessions = useLiveQuery(() => db.sessions.toArray())
  if (!checkins || !sessions || checkins.length === 0) return null

  const byDate = new Map<string, string[]>()
  for (const s of sessions) {
    const arr = byDate.get(s.date) ?? []
    arr.push(s.type); byDate.set(s.date, arr)
  }
  const agg = new Map<string, { sum: number; n: number }>()
  for (const c of checkins) {
    const types = Array.from(new Set(byDate.get(c.nextDayOf!) ?? []))
    for (const t of types) {
      const a = agg.get(t) ?? { sum: 0, n: 0 }
      a.sum += c.level; a.n += 1; agg.set(t, a)
    }
  }
  const rows = Array.from(agg.entries())
    .map(([type, { sum, n }]) => ({ type, avg: sum / n, n }))
    .sort((a, b) => b.avg - a.avg)
  if (rows.length === 0) return null

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Dolor al día siguiente</div>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.type}>
            <div className="flex justify-between text-[12px] mb-1">
              <span style={{ color: 'var(--text-2)' }}>{ACTIVITY_LABEL[r.type] ?? r.type} <span style={{ color: 'var(--text-3)' }}>· {r.n}×</span></span>
              <span className="num" style={{ color: levelColor(r.avg) }}>{r.avg.toFixed(1)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full" style={{ width: `${(r.avg / 10) * 100}%`, background: levelColor(r.avg) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Cómo amaneces el día después de cada actividad (check-in matutino).</div>
    </div>
  )
}

function Contraindications() {
  const [show, setShow] = useState(false)
  return (
    <div className="card p-4">
      <button onClick={() => setShow(s => !s)} className="w-full flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase" style={{ color: '#EF4444', letterSpacing: '0.06em' }}>⛔ Movimientos a evitar</span>
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{show ? 'ocultar' : 'ver'}</span>
      </button>
      {show && (
        <div className="space-y-3 mt-3">
          {CONTRAINDICATIONS.map(c => (
            <div key={c.label} className="pl-3" style={{ borderLeft: '2px solid rgba(239,68,68,.5)' }}>
              <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{c.label}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{c.riesgo}</div>
              <div className="text-[12px] mt-0.5" style={{ color: '#22C55E' }}>✓ {c.alternativa}</div>
            </div>
          ))}
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            Basado en tu informe diagnóstico. No sustituye criterio médico/fisio.
          </div>
        </div>
      )}
    </div>
  )
}

function RecentLogs({ logs }: { logs: any[] }) {
  return (
    <div className="card p-4 space-y-1">
      <div className="text-[12px] font-semibold uppercase mb-1" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Registros recientes</div>
      {logs.slice(0, 20).map(l => <LogRow key={l.id} log={l} />)}
    </div>
  )
}

function LogRow({ log: l }: { log: any }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="num font-bold text-[16px] w-6 text-center shrink-0" style={{ color: levelColor(l.level) }}>{l.level}</span>
        <div className="min-w-0">
          <div className="text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
            {CONTEXT_META[l.context as PainContext]}
            {l.locations?.length ? ' · ' + l.locations.join(', ') : ''}
          </div>
          <div className="text-[11px] num" style={{ color: 'var(--text-3)' }}>
            {l.date} · {TIME_OF_DAY_META[l.timeOfDay as TimeOfDay]?.label}
            {l.trigger ? ` · ${l.trigger}` : ''}
          </div>
        </div>
      </div>
      {confirm ? (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setConfirm(false)} className="text-[11px] px-2 py-0.5 rounded" style={{ color: 'var(--text-3)' }}>No</button>
          <button onClick={async () => { await db.painLogs.delete(l.id); setConfirm(false) }}
            className="text-[11px] px-2 py-0.5 rounded" style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,.4)' }}>Borrar</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="shrink-0 px-1" style={{ color: 'var(--text-3)' }}>✕</button>
      )}
    </div>
  )
}
