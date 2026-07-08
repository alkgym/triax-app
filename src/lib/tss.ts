// Simplified Training Stress Score — RPE-based.
// Real TSS uses HR/Power. We use RPE as Intensity Factor (RPE/10) when no HR, fall back to discipline defaults.

import type { WorkoutSession } from '../db/schema'

const DEFAULT_IF: Record<string, number> = {
  run: 0.75, bike: 0.65, swim: 0.7, brick: 0.8,
  push: 0.6, pull: 0.6, fullbody: 0.6,
  bike_indoor: 0.7, swim_pool: 0.65, gym_free: 0.55,
}

export function sessionTss(s: WorkoutSession): number {
  if (!s.completedAt) return 0
  const hours = (s.durationMin ?? 30) / 60       // assume 30min if not logged but completed
  const ifVal = s.rpe != null ? Math.max(0.4, Math.min(1.0, s.rpe / 10)) : (DEFAULT_IF[s.type] ?? 0.6)
  return Math.round(hours * ifVal * ifVal * 100)  // hours × IF² × 100
}

export interface LoadPoint {
  date: string                  // YYYY-MM-DD
  tss: number                   // sum of TSS for that day
  ctl: number                   // chronic training load (42-day EMA)
  atl: number                   // acute training load (7-day EMA)
  tsb: number                   // training stress balance = ctl - atl
}

// Build daily load series for [from, to]. Both ISO yyyy-mm-dd, inclusive.
export function buildLoadSeries(opts: {
  from: string
  to: string
  sessions: WorkoutSession[]
}): LoadPoint[] {
  const { from, to, sessions } = opts
  const days: string[] = []
  for (let d = new Date(from + 'T00:00:00'); d <= new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0,10))
  }

  const tssByDate = new Map<string, number>()
  for (const s of sessions) {
    if (!s.completedAt) continue
    tssByDate.set(s.date, (tssByDate.get(s.date) ?? 0) + sessionTss(s))
  }

  // EMA constants — Banister-style
  const kCtl = 2 / (42 + 1)
  const kAtl = 2 / (7 + 1)

  let ctl = 0, atl = 0
  const series: LoadPoint[] = []
  for (const day of days) {
    const tss = tssByDate.get(day) ?? 0
    ctl = ctl + kCtl * (tss - ctl)
    atl = atl + kAtl * (tss - atl)
    series.push({ date: day, tss, ctl: +ctl.toFixed(1), atl: +atl.toFixed(1), tsb: +(ctl - atl).toFixed(1) })
  }
  return series
}

export function tsbStatus(tsb: number): { label: string; color: string; advice: string } {
  if (tsb < -25) return { label: 'Sobrecarga',  color: '#EF4444', advice: 'Riesgo alto. Descanso o sesión muy suave.' }
  if (tsb < -10) return { label: 'Cargado',     color: '#F97316', advice: 'Carga productiva. Cuida descanso/sueño.' }
  if (tsb <= 5)  return { label: 'En forma',    color: '#10F4A0', advice: 'Punto óptimo de fitness/fatiga.' }
  if (tsb <= 25) return { label: 'Fresco',      color: '#06B6D4', advice: 'Listo para sesión clave o competición.' }
  return                  { label: 'Detraining', color: '#A855F7', advice: 'Demasiado fresco — riesgo de pérdida de forma.' }
}
