// Google Calendar deep link builder.
// Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...
//
// Dates use the all-day format YYYYMMDD/YYYYMMDDnext  (DTEND is exclusive).

import type { ExerciseTemplate, PlanDay, WorkoutType } from '../db/schema'
import { TYPE_META } from './types'

function isoToCompact(iso: string) {
  return iso.replaceAll('-', '')   // YYYY-MM-DD → YYYYMMDD
}

function nextDay(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return isoToCompact(d.toISOString().slice(0, 10))
}

export function buildPlanDayDescription(plan: PlanDay, templates?: ExerciseTemplate[]): string {
  const lines: string[] = []
  if (plan.intensity) lines.push(`Intensidad: ${plan.intensity}`)
  if (plan.targetDistanceKm != null) lines.push(`Distancia: ${plan.targetDistanceKm} km`)
  if (plan.targetDurationMin != null) lines.push(`Duración: ${plan.targetDurationMin} min`)
  if (plan.drill) lines.push(`Drill: ${plan.drill}`)
  if (plan.isBrick) lines.push('— BRICK —')
  if (plan.isDeload) lines.push('— Semana DELOAD —')

  if (templates && templates.length > 0) {
    lines.push('')
    lines.push('Ejercicios:')
    for (const t of [...templates].sort((a, b) => a.order - b.order)) {
      if (!t.active) continue
      const peso = t.pesoUnidad === 'bw' ? 'BW' : (t.pesoSugerido != null ? `${t.pesoSugerido}kg` : '—')
      const rir = t.rir ? `, RIR ${t.rir}` : ''
      lines.push(`${t.order}. ${t.name} — ${t.series}×${t.reps}${rir} (${peso})`)
    }
  }

  if (plan.description) {
    lines.push('')
    lines.push(plan.description)
  }

  lines.push('')
  lines.push('— TRI·AX')
  return lines.join('\n')
}

/**
 * Build a Google Calendar TEMPLATE URL for a plan day. The user opens it,
 * Google Calendar pre-fills the form, and they save with one tap.
 *
 * @param plan       the planned day
 * @param templates  optional exercise templates to include in the description
 */
export function googleCalendarUrl(plan: PlanDay, templates?: ExerciseTemplate[]): string {
  const meta = TYPE_META[plan.type]
  const text = `${meta?.label ?? plan.type}: ${plan.title}`
  const startCompact = isoToCompact(plan.date)
  const endCompact = nextDay(plan.date)
  const details = buildPlanDayDescription(plan, templates)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${startCompact}/${endCompact}`,
    details,
    location: 'Casa / Gym / Piscina',
    trp: 'false',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Whole-plan ICS file is already handled by `lib/ics.ts`. This is the
 * one-shot per-day deep link for "add THIS workout to my Calendar".
 */
export function openInGoogleCalendar(plan: PlanDay, templates?: ExerciseTemplate[]) {
  const url = googleCalendarUrl(plan, templates)
  // Use _blank so the user returns to TRI·AX afterwards.
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Shape-test: ensure the resulting URL is valid, all params present, dates compact. */
export function _validateCalendarUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.host !== 'calendar.google.com') return false
    if (!u.searchParams.get('text')) return false
    const dates = u.searchParams.get('dates') ?? ''
    if (!/^\d{8}\/\d{8}$/.test(dates)) return false
    return true
  } catch { return false }
}

// Re-export type helper so other modules can stay lean.
export type { WorkoutType }
