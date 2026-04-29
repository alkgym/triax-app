import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { todayIso, startOfWeek, addDays, dayName, shortDate } from '../lib/dates'
import { TYPE_META } from '../lib/types'

export default function Week() {
  const [anchor, setAnchor] = useState(startOfWeek(todayIso()))
  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i))

  const planDays = useLiveQuery(() => db.planDays.where('date').anyOf(days).toArray(), [anchor])
  const sessions = useLiveQuery(() => db.sessions.where('date').anyOf(days).toArray(), [anchor])

  const completed = sessions?.filter(s => s.completedAt).length ?? 0
  const total = planDays?.filter(d => d.type !== 'rest').length ?? 0

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center justify-between">
        <button className="btn btn-ghost" onClick={() => setAnchor(addDays(anchor, -7))}>‹</button>
        <div className="text-center">
          <div className="text-bone2 text-xs uppercase tracking-widest">Semana</div>
          <h1 className="display text-bone text-2xl">{shortDate(anchor)} → {shortDate(addDays(anchor, 6))}</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => setAnchor(addDays(anchor, 7))}>›</button>
      </header>

      <div className="card p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-bone2 uppercase tracking-widest text-[10px]">Progreso</span>
          <span className="display text-orange text-xl">{completed}/{total}</span>
        </div>
        <div className="h-2 bg-ink rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-orange transition-all" style={{ width: total ? `${(completed / total) * 100}%` : '0%' }} />
        </div>
      </div>

      <div className="space-y-2">
        {days.map(d => {
          const plan = planDays?.find(p => p.date === d)
          const sess = sessions?.find(s => s.date === d)
          const meta = plan ? TYPE_META[plan.type] : TYPE_META.rest
          const done = !!sess?.completedAt
          const isToday = d === todayIso()
          return (
            <Link key={d} to={`/plan/${d}`} className={`card p-3 flex items-center gap-3 ${isToday ? 'border-orange' : ''}`}>
              <div className="text-center w-12">
                <div className="text-bone2 text-[10px] uppercase">{dayName(d).slice(0, 3)}</div>
                <div className="display text-bone text-2xl leading-none">{d.slice(8, 10)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: meta.color }}>{meta.emoji}</span>
                  <span className="display text-bone text-sm" style={{ color: meta.color }}>{meta.label}</span>
                  {plan?.isDeload && <span className="chip text-orange border-orange text-[9px]">Deload</span>}
                </div>
                <div className="text-bone text-sm truncate">{plan?.title ?? '—'}</div>
              </div>
              <div className="text-2xl">{done ? '✓' : (isToday ? '◉' : '○')}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
