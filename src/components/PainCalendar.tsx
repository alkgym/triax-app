import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function PainCalendar() {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const pains = useLiveQuery(() => db.painLogs.toArray())
  const sessions = useLiveQuery(() => db.sessions.toArray())

  // dolor medio por día
  const painByDay = new Map<string, number[]>()
  for (const p of pains ?? []) { const a = painByDay.get(p.date) ?? []; a.push(p.level); painByDay.set(p.date, a) }
  const trained = new Set((sessions ?? []).filter(s => s.completedAt || s.isExtra).map(s => s.date))

  const firstDow = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7 // lun=0
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const todayIsoStr = iso(now.getFullYear(), now.getMonth(), now.getDate())

  const cells: ({ day: number; date: string } | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: iso(ym.y, ym.m, d) })

  function shift(delta: number) {
    setYm(({ y, m }) => {
      const nm = m + delta
      if (nm < 0) return { y: y - 1, m: 11 }
      if (nm > 11) return { y: y + 1, m: 0 }
      return { y, m: nm }
    })
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Calendario</div>
        <div className="flex items-center gap-3">
          <button onClick={() => shift(-1)} className="px-1.5 text-[15px]" style={{ color: 'var(--text-3)' }}>‹</button>
          <span className="text-[12px] num" style={{ color: 'var(--text-2)' }}>{MONTHS[ym.m]} {ym.y}</span>
          <button onClick={() => shift(1)} className="px-1.5 text-[15px]" style={{ color: 'var(--text-3)' }}>›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-center text-[10px]" style={{ color: 'var(--text-3)' }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const vals = painByDay.get(c.date)
          const avg = vals ? vals.reduce((a, b) => a + b, 0) / vals.length : null
          const isTrained = trained.has(c.date)
          const isToday = c.date === todayIsoStr
          return (
            <div key={i} className="aspect-square rounded-md flex items-center justify-center relative"
              style={{
                background: avg != null ? `${painColor(avg)}26` : 'var(--surface-2)',
                border: isToday ? '1px solid var(--accent)' : `1px solid ${avg != null ? painColor(avg) + '55' : 'var(--border)'}`,
              }}>
              <span className="num text-[11px]" style={{ color: avg != null ? painColor(avg) : 'var(--text-3)' }}>{c.day}</span>
              {isTrained && <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-3)' }}>
        <div className="flex items-center gap-1.5">
          <span>Dolor</span>
          {[1, 3, 5, 7, 9].map(l => <span key={l} className="w-3 h-3 rounded-sm" style={{ background: `${painColor(l)}55`, border: `1px solid ${painColor(l)}` }} />)}
        </div>
        <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} /><span>entreno</span></div>
      </div>
    </div>
  )
}
