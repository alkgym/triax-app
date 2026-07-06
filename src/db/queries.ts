import { db } from './schema'
import { todayIso } from '../lib/dates'

// Compute current streak: consecutive days (going back from today) with at least one completed session.
// A "rest" day breaks the streak unless that rest day is what was planned (then we still count it).
export async function computeStreak(): Promise<number> {
  const today = todayIso()
  const sessions = await db.sessions.toArray()
  const planDays = await db.planDays.toArray()
  const sessByDate = new Map(sessions.map(s => [s.date, s]))
  const planByDate = new Map(planDays.map(p => [p.date, p]))

  let streak = 0
  let cursor = today
  for (let i = 0; i < 365; i++) {
    const plan = planByDate.get(cursor)
    const sess = sessByDate.get(cursor)
    if (plan?.type === 'rest') {
      // rest day — counts towards adherence (it's planned recovery)
      streak += 1
    } else if (sess?.completedAt) {
      streak += 1
    } else {
      break
    }
    // step back one day
    const [y, m, d] = cursor.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    cursor = dt.toISOString().slice(0, 10)
  }
  return streak
}

// Lanza (o cambia a) una rutina de gym para una fecha. Única definición para
// Hoy y Rutinas. Si la sesión existía solo como contenedor (rest/notas), el
// crono del entreno arranca ahora, no cuando se creó la sesión.
export async function startRoutine(date: string, type: import('./schema').WorkoutType): Promise<void> {
  const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
  if (!s) {
    await db.sessions.add({ date, type, startedAt: Date.now(), notes: '', isExtra: false })
  } else if (s.type !== type) {
    const patch: Partial<import('./schema').WorkoutSession> = { type }
    if (s.type === 'rest' && !s.completedAt) patch.startedAt = Date.now()
    await db.sessions.update(s.id!, patch)
  }
}

// Un peso por día: actualiza la fila existente de esa fecha en vez de duplicarla.
export async function upsertWeight(date: string, weight: number): Promise<void> {
  await db.transaction('rw', db.bodyMetrics, async () => {
    const existing = await db.bodyMetrics.where('date').equals(date).first()
    if (existing?.id != null) await db.bodyMetrics.update(existing.id, { weight })
    else await db.bodyMetrics.add({ date, weight })
  })
}

export async function totalCompleted(): Promise<number> {
  const sessions = await db.sessions.toArray()
  return sessions.filter(s => s.completedAt).length
}
