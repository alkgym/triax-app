import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { todayIso, addDays } from '../lib/dates'

function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function WeekStrip() {
  const today = todayIso()
  // Semana actual empezando en LUNES (lun→dom)
  const dowToday = (new Date(today + 'T00:00:00').getDay() + 6) % 7 // lun=0
  const monday = addDays(today, -dowToday)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const pains = useLiveQuery(() => db.painLogs.toArray())

  const trained = new Set((sessions ?? []).filter(s => s.completedAt || s.isExtra).map(s => s.date))
  const painByDay = new Map<string, number[]>()
  for (const p of pains ?? []) { const a = painByDay.get(p.date) ?? []; a.push(p.level); painByDay.set(p.date, a) }

  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dow = DOW[(new Date(d + 'T00:00:00').getDay() + 6) % 7]
          const isToday = d === today
          const vals = painByDay.get(d)
          const avg = vals ? vals.reduce((a, b) => a + b, 0) / vals.length : null
          const did = trained.has(d)
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px]" style={{ color: isToday ? 'var(--accent)' : 'var(--text-3)' }}>{dow}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center relative"
                style={{
                  background: avg != null ? `${painColor(avg)}22` : 'var(--surface-2)',
                  border: isToday ? '1px solid var(--accent)' : `1px solid ${avg != null ? painColor(avg) + '55' : 'var(--border)'}`,
                }}>
                {avg != null
                  ? <span className="num text-[12px] font-semibold" style={{ color: painColor(avg) }}>{Math.round(avg)}</span>
                  : <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>·</span>}
                {did && <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 4px var(--accent)' }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
