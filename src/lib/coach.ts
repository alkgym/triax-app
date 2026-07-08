// Smart Coach — analyses past sessions vs plan and proposes adjustments.
// Pure functions. No DB writes here — UI decides whether to apply.

import type { PlanDay, WorkoutSession } from '../db/schema'

export type CoachSeverity = 'info' | 'boost' | 'deload' | 'warn'
export type Discipline = 'run' | 'bike' | 'swim'

export interface CoachSuggestion {
  id: string                  // stable per (date+kind), so we can dismiss
  severity: CoachSeverity
  discipline: Discipline | 'global'
  title: string
  body: string
  // Optional structured action — UI can apply via db.planDays.update
  action?: {
    targetPlanDayId: number
    patch: Partial<PlanDay>
    summary: string           // human label e.g. "+5% distancia"
  }
}

// Convert min:sec/km from secPerKm
function pace(secPerKm?: number) {
  if (!secPerKm) return ''
  const m = Math.floor(secPerKm / 60); const s = Math.round(secPerKm % 60)
  return `${m}:${s.toString().padStart(2,'0')}/km`
}

// True if completed with metrics suggesting "easy day" — RPE ≤ 5 AND duration met or beat plan
function feltEasy(s: WorkoutSession, plan?: PlanDay): boolean {
  if (!s.completedAt) return false
  if (s.rpe == null) return false
  if (s.rpe > 5) return false
  if (plan?.targetDistanceKm && s.distanceKm) {
    return s.distanceKm >= plan.targetDistanceKm * 0.97
  }
  if (plan?.targetDurationMin && s.durationMin) {
    return s.durationMin >= plan.targetDurationMin * 0.95
  }
  return true
}

// True if pace fell short OR RPE was high
function feltHard(s: WorkoutSession, plan?: PlanDay): boolean {
  if (!s.completedAt) return false
  if (s.rpe != null && s.rpe >= 8) return true
  if (plan?.targetDistanceKm && s.distanceKm && s.distanceKm < plan.targetDistanceKm * 0.85) return true
  if (plan?.targetDurationMin && s.durationMin && s.durationMin < plan.targetDurationMin * 0.7) return true
  return false
}

export function analyseCoach(opts: {
  today: string
  sessions: WorkoutSession[]
  planDays: PlanDay[]
}): CoachSuggestion[] {
  const { today, sessions, planDays } = opts
  const suggestions: CoachSuggestion[] = []

  // Index plan day by date for fast lookup
  const planByDate = new Map(planDays.map(p => [p.date, p]))

  // Filter completed, non-extra sessions in chronological order
  const done = sessions
    .filter(s => s.completedAt && !s.isExtra)
    .sort((a,b) => a.date.localeCompare(b.date))

  // Last 14 days only — recent signals
  const cutoff = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 14); return d.toISOString().slice(0,10) })()
  const recent = done.filter(s => s.date >= cutoff)

  const disciplines: Discipline[] = ['run','bike','swim']

  for (const disc of disciplines) {
    const dRecent = recent.filter(s => s.type === disc)
    if (dRecent.length === 0) continue

    // Find next planned session of this discipline AFTER today
    const nextPlan = planDays
      .filter(p => p.type === disc && p.date > today)
      .sort((a,b) => a.date.localeCompare(b.date))[0]

    // Last 2 sessions hard? → propose deload of next planned
    const last2 = dRecent.slice(-2)
    const hardCount = last2.filter(s => feltHard(s, planByDate.get(s.date))).length
    if (hardCount >= 2 && nextPlan?.id) {
      const newDist = nextPlan.targetDistanceKm ? Math.round(nextPlan.targetDistanceKm * 0.85 * 10) / 10 : undefined
      const newDur  = nextPlan.targetDurationMin ? Math.round(nextPlan.targetDurationMin * 0.85) : undefined
      suggestions.push({
        id: `deload-${disc}-${nextPlan.date}`,
        severity: 'deload',
        discipline: disc,
        title: `Reducir próximo ${disc === 'run' ? 'rodaje' : disc === 'bike' ? 'rodaje en bici' : 'nado'}`,
        body: `Encadenas 2 sesiones de ${disc} con esfuerzo alto (RPE ≥8 o ritmo fallado). Te propongo bajar ~15% el ${nextPlan.date} para asimilar.`,
        action: {
          targetPlanDayId: nextPlan.id,
          patch: { targetDistanceKm: newDist, targetDurationMin: newDur },
          summary: `−15% volumen ${nextPlan.date}`,
        },
      })
      continue // don't suggest a boost on top of a deload
    }

    // Last session very easy? → propose boost
    const last = dRecent[dRecent.length - 1]
    if (last && feltEasy(last, planByDate.get(last.date)) && nextPlan?.id) {
      const newDist = nextPlan.targetDistanceKm ? Math.round(nextPlan.targetDistanceKm * 1.05 * 10) / 10 : undefined
      const newDur  = nextPlan.targetDurationMin ? Math.round(nextPlan.targetDurationMin * 1.05) : undefined
      suggestions.push({
        id: `boost-${disc}-${nextPlan.date}`,
        severity: 'boost',
        discipline: disc,
        title: `Subir un poco la próxima de ${disc}`,
        body: `Tu última sesión de ${disc} fue cómoda (RPE ${last.rpe ?? '?'}${last.avgPaceSecPerKm ? `, ritmo ${pace(last.avgPaceSecPerKm)}` : ''}). Toca progresión: +5% para el ${nextPlan.date}.`,
        action: {
          targetPlanDayId: nextPlan.id,
          patch: { targetDistanceKm: newDist, targetDurationMin: newDur },
          summary: `+5% volumen ${nextPlan.date}`,
        },
      })
    }
  }

  // Global fatigue check — average RPE over last 5 sessions ≥ 7.5 → suggest active rest
  const last5 = recent.slice(-5).filter(s => s.rpe != null)
  if (last5.length >= 4) {
    const avgRpe = last5.reduce((a,s) => a + (s.rpe ?? 0), 0) / last5.length
    if (avgRpe >= 7.5) {
      suggestions.push({
        id: `fatigue-${today}`,
        severity: 'warn',
        discipline: 'global',
        title: 'Fatiga acumulada',
        body: `RPE medio de tus últimas 5 sesiones: ${avgRpe.toFixed(1)}. Plantéate 24-48h de descanso activo o sustituir el próximo entreno largo por uno suave.`,
      })
    }
  }

  return suggestions
}
