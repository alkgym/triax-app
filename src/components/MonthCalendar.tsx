import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { todayIso, addDays } from '../lib/dates'
import { vibrate } from '../db/hooks'
import { typeColor } from '../lib/colors'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Calendario mensual: ver cualquier semana/día con exactitud y saltar a él
 * para registrar entrenos olvidados o editar los existentes.
 */
export function MonthCalendar({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  const today = todayIso()
  const [ym, setYm] = useState(() => selected.slice(0, 7)) // yyyy-mm visible

  const [year, month] = ym.split('-').map(Number)
  const first = `${ym}-01`
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${ym}-${String(daysInMonth).padStart(2, '0')}`
  const firstDow = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7 // lun=0

  const sessions = useLiveQuery(
    () => db.sessions.where('date').between(first, last, true, true).toArray(),
    [first, last],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, { primary?: { type: string; done: boolean }; extras: string[] }>()
    for (const s of sessions ?? []) {
      const d = m.get(s.date) ?? { extras: [] }
      if (s.isExtra) d.extras.push(s.type)
      else if (s.type !== 'rest') d.primary = { type: s.type, done: !!s.completedAt }
      m.set(s.date, d)
    }
    return m
  }, [sessions])

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    setYm(d.toISOString().slice(0, 7))
    vibrate(10)
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ]

  return (
    <div className="card p-3 space-y-2">
      {/* Cabecera mes */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => shiftMonth(-1)} className="px-3 py-1 text-[16px]" style={{ color: 'var(--text-2)' }}>‹</button>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
          {MONTHS[month - 1]} <span className="num" style={{ color: 'var(--text-3)' }}>{year}</span>
        </div>
        <button onClick={() => shiftMonth(1)} className="px-3 py-1 text-[16px]" style={{ color: 'var(--text-2)' }}>›</button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] py-0.5" style={{ color: 'var(--text-3)' }}>{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const info = byDay.get(d)
          const isToday = d === today
          const isSel = d === selected
          const isFuture = d > today
          return (
            <button
              key={d}
              onClick={() => { onSelect(d); vibrate(10) }}
              className="rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors active:opacity-70"
              style={{
                height: 44,
                background: isSel ? 'var(--surface-3)' : 'var(--surface-2)',
                border: isSel ? '1px solid var(--accent)' : isToday ? '1px solid var(--border-strong)' : '1px solid var(--border)',
                opacity: isFuture ? 0.45 : 1,
              }}
            >
              <span className="num text-[12px]" style={{
                color: isSel ? 'var(--accent)' : isToday ? 'var(--text)' : 'var(--text-2)',
                fontWeight: isToday || isSel ? 700 : 400,
              }}>
                {Number(d.slice(8))}
              </span>
              <span className="flex items-center gap-0.5" style={{ height: 6 }}>
                {info?.primary && (
                  <span className="rounded-full" style={{
                    width: 6, height: 6,
                    background: info.primary.done ? typeColor(info.primary.type) : 'transparent',
                    border: `1.5px solid ${typeColor(info.primary.type)}`,
                  }} />
                )}
                {info?.extras.slice(0, 2).map((t, j) => (
                  <span key={j} className="rounded-full" style={{ width: 4, height: 4, background: typeColor(t) }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-1 pt-1">
        <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
          ● entreno hecho · ○ empezado · puntos pequeños: extras
        </div>
        {selected !== today && (
          <button onClick={() => { onSelect(today); setYm(today.slice(0, 7)) }}
            className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ color: 'var(--accent)', border: '1px solid var(--border-strong)' }}>
            Hoy
          </button>
        )}
      </div>
    </div>
  )
}
