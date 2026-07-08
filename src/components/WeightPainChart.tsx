import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { db } from '../db/schema'
import { shortDate } from '../lib/dates'

// Compara la evolución del peso corporal con la del dolor lumbar.
export function WeightPainChart() {
  const metrics = useLiveQuery(() => db.bodyMetrics.toArray())
  const pains = useLiveQuery(() => db.painLogs.toArray())
  if (!metrics || !pains) return null
  if (metrics.filter(m => m.weight != null).length < 2) return null

  const painByDay = new Map<string, number[]>()
  for (const p of pains) { const a = painByDay.get(p.date) ?? []; a.push(p.level); painByDay.set(p.date, a) }
  const weightByDay = new Map<string, number>()
  for (const m of metrics) if (m.weight != null) weightByDay.set(m.date, m.weight)

  const dates = Array.from(new Set([...weightByDay.keys(), ...painByDay.keys()])).sort().slice(-60)
  const data = dates.map(d => {
    const pv = painByDay.get(d)
    return {
      date: shortDate(d),
      peso: weightByDay.get(d) ?? null,
      dolor: pv ? +(pv.reduce((a, b) => a + b, 0) / pv.length).toFixed(1) : null,
    }
  })

  return (
    <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Peso vs Dolor</div>
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
            <YAxis yAxisId="w" stroke="#FF6B2B" fontSize={10} domain={['auto', 'auto']} width={34} />
            <YAxis yAxisId="p" orientation="right" stroke="#22D3EE" fontSize={10} domain={[0, 10]} ticks={[0, 5, 10]} width={24} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="w" type="monotone" dataKey="peso" name="Peso (kg)" stroke="#FF6B2B" strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="p" type="monotone" dataKey="dolor" name="Dolor" stroke="#22D3EE" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>¿Tu dolor sube o baja con los cambios de peso? Naranja = peso · cian = dolor.</div>
    </div>
  )
}
