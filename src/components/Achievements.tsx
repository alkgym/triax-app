import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { todayIso } from '../lib/dates'

interface Badge { icon: string; label: string; reached: boolean; sub: string }

export function Achievements() {
  const sessions = useLiveQuery(() => db.sessions.toArray())
  if (!sessions) return null

  const isDone = (s: any) => !!s.completedAt || !!s.isExtra
  const doneDates = Array.from(new Set(sessions.filter(isDone).map(s => s.date))).sort()
  const totalSessions = sessions.filter(isDone).length

  // racha actual (desde hoy hacia atrás)
  const doneSet = new Set(doneDates)
  let current = 0; let cur = todayIso()
  while (doneSet.has(cur)) { current++; const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() - 1); cur = d.toISOString().slice(0, 10) }
  // racha más larga
  let longest = 0, run = 0, prev: string | null = null
  for (const d of doneDates) {
    if (prev) {
      const pd = new Date(prev + 'T00:00:00'); pd.setDate(pd.getDate() + 1)
      run = pd.toISOString().slice(0, 10) === d ? run + 1 : 1
    } else run = 1
    longest = Math.max(longest, run); prev = d
  }

  const badges: Badge[] = [
    { icon: '🔥', label: 'Racha 3', reached: longest >= 3, sub: '3 días seguidos' },
    { icon: '🔥', label: 'Racha 7', reached: longest >= 7, sub: '1 semana' },
    { icon: '⚡', label: 'Racha 14', reached: longest >= 14, sub: '2 semanas' },
    { icon: '💎', label: 'Racha 30', reached: longest >= 30, sub: '1 mes' },
    { icon: '💪', label: '10 sesiones', reached: totalSessions >= 10, sub: 'constancia' },
    { icon: '🏋️', label: '25 sesiones', reached: totalSessions >= 25, sub: 'en forma' },
    { icon: '🥇', label: '50 sesiones', reached: totalSessions >= 50, sub: 'dedicación' },
    { icon: '🏆', label: '100 sesiones', reached: totalSessions >= 100, sub: 'élite' },
  ]
  const earned = badges.filter(b => b.reached).length

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Logros</div>
        <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          <span className="num" style={{ color: 'var(--accent)' }}>{earned}</span>/{badges.length} · racha máx <span className="num" style={{ color: 'var(--text-2)' }}>{longest}</span>
          {current > 0 && <> · 🔥<span className="num" style={{ color: '#F59E0B' }}>{current}</span></>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {badges.map((b, i) => (
          <div key={i} className="rounded-lg p-2 flex flex-col items-center text-center gap-0.5"
            style={{
              background: b.reached ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${b.reached ? 'var(--border-strong)' : 'var(--border)'}`,
              opacity: b.reached ? 1 : 0.4,
              filter: b.reached ? 'none' : 'grayscale(1)',
            }}>
            <span style={{ fontSize: 20 }}>{b.icon}</span>
            <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--text-2)' }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
