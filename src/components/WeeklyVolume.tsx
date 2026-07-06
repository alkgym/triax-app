import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { db } from '../db/schema'
import { todayIso, startOfWeek, addDays, shortDate } from '../lib/dates'

const WEEKS = 8

function fmtVol(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${Math.round(kg)} kg`
}

/** Volumen de entrenamiento por semana (Σ peso×reps de series completadas). */
export function WeeklyVolume() {
  const data = useLiveQuery(async () => {
    const [sessions, sets] = await Promise.all([db.sessions.toArray(), db.sets.toArray()])
    const dateOf = new Map<number, string>(sessions.map(s => [s.id!, s.date]))
    const byWeek = new Map<string, number>()
    for (const s of sets) {
      if (!s.completed || s.weight == null || s.reps == null) continue
      const d = dateOf.get(s.sessionId)
      if (!d) continue
      const wk = startOfWeek(d)
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + s.weight * s.reps)
    }
    const thisMon = startOfWeek(todayIso())
    return Array.from({ length: WEEKS }, (_, i) => {
      const mon = addDays(thisMon, -7 * (WEEKS - 1 - i))
      return { mon, label: shortDate(mon), vol: Math.round(byWeek.get(mon) ?? 0) }
    })
  })

  if (!data) return null
  const current = data[data.length - 1]
  const prev = data[data.length - 2]
  const anyVolume = data.some(d => d.vol > 0)
  if (!anyVolume) return null
  const delta = prev && prev.vol > 0 ? Math.round(((current.vol - prev.vol) / prev.vol) * 100) : null

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>
          Volumen semanal
        </div>
        <div className="text-right">
          <span className="num font-bold" style={{ color: 'var(--text)', fontSize: 22, letterSpacing: '-0.02em' }}>{fmtVol(current.vol)}</span>
          {delta != null && delta !== 0 && (
            <span className="num text-[11px] ml-2" style={{ color: delta > 0 ? 'var(--green)' : 'var(--text-3)' }}>
              {delta > 0 ? '↗ +' : '↘ '}{delta}%
            </span>
          )}
        </div>
      </div>
      <div className="h-36">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -18 }} barCategoryGap="28%">
            <XAxis dataKey="label" stroke="#A9A39A" fontSize={9.5} tickLine={false} axisLine={{ stroke: '#262626' }} />
            <YAxis stroke="#A9A39A" fontSize={9.5} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}t` : String(v)} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#0A0A0A', border: '1px solid #262626', borderRadius: 8 }}
              formatter={((v: number) => [fmtVol(v), 'Volumen']) as never}
              labelFormatter={((l: string) => `Semana del ${l}`) as never}
            />
            <Bar dataKey="vol" radius={[5, 5, 2, 2]}>
              {data.map((d, i) => (
                <Cell key={d.mon} fill={i === data.length - 1 ? 'var(--accent)' : '#3d3d44'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
        Σ peso × reps de las series completadas · semana actual en naranja
      </div>
    </div>
  )
}
