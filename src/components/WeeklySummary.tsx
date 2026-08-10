import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { todayIso, addDays } from '../lib/dates'
import { painColor } from '../lib/ui'

function mondayOf(iso: string): string {
  const dow = (new Date(iso + 'T00:00:00').getDay() + 6) % 7
  return addDays(iso, -dow)
}
function inRange(d: string, from: string, to: string) { return d >= from && d <= to }

// Comparativa rápida: esta semana vs la semana pasada (entrenos, series, dolor).
export function WeeklySummary() {
  const sessions = useLiveQuery(() => db.sessions.toArray())
  const sets = useLiveQuery(() => db.sets.toArray())
  const pains = useLiveQuery(() => db.painLogs.toArray())
  if (!sessions || !sets || !pains) return null

  const today = todayIso()
  const thisMon = mondayOf(today)
  const lastMon = addDays(thisMon, -7)
  const lastSun = addDays(thisMon, -1)

  const isDone = (s: any) => !!s.completedAt || !!s.isExtra
  const dateOfSession = new Map<number, string>(sessions.map(s => [s.id!, s.date]))

  function weekStats(from: string, to: string) {
    const entrenos = sessions!.filter(s => isDone(s) && inRange(s.date, from, to)).length
    const series = sets!.filter(st => {
      if (!st.completed) return false
      const d = dateOfSession.get(st.sessionId)
      return !!d && inRange(d, from, to)
    }).length
    const ps = pains!.filter(p => inRange(p.date, from, to))
    const dolor = ps.length ? ps.reduce((a, p) => a + p.level, 0) / ps.length : null
    return { entrenos, series, dolor }
  }

  const cur = weekStats(thisMon, today)
  const prev = weekStats(lastMon, lastSun)
  if (cur.entrenos === 0 && prev.entrenos === 0 && cur.dolor == null && prev.dolor == null) return null

  function Delta({ now, before, invert = false, fmt = (n: number) => String(n) }: { now: number | null; before: number | null; invert?: boolean; fmt?: (n: number) => string }) {
    if (now == null) return <span style={{ color: 'var(--text-3)' }}>—</span>
    if (before == null || before === now) return <span className="num" style={{ color: 'var(--text-3)' }}>{fmt(now)}</span>
    const up = now > before
    const good = invert ? !up : up
    return (
      <span className="num" style={{ color: good ? 'var(--green)' : '#EF4444' }}>
        {up ? '↑' : '↓'} {fmt(now)}
      </span>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Tu semana</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>vs semana pasada</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Entrenos</div>
          <div className="text-[22px] font-semibold mt-1 leading-none">
            <Delta now={cur.entrenos} before={prev.entrenos} />
          </div>
          <div className="text-[10px] num mt-1" style={{ color: 'var(--text-3)' }}>antes {prev.entrenos}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Series</div>
          <div className="text-[22px] font-semibold mt-1 leading-none">
            <Delta now={cur.series} before={prev.series} />
          </div>
          <div className="text-[10px] num mt-1" style={{ color: 'var(--text-3)' }}>antes {prev.series}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Dolor med</div>
          <div className="text-[22px] font-semibold mt-1 leading-none" style={{ color: cur.dolor != null ? painColor(cur.dolor) : undefined }}>
            <Delta now={cur.dolor} before={prev.dolor} invert fmt={n => n.toFixed(1)} />
          </div>
          <div className="text-[10px] num mt-1" style={{ color: 'var(--text-3)' }}>antes {prev.dolor != null ? prev.dolor.toFixed(1) : '—'}</div>
        </div>
      </div>
    </div>
  )
}
