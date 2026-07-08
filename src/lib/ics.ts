// Generate an .ics file (RFC 5545) from plan days for one-way Google Calendar / Apple Calendar import.

import type { PlanDay } from '../db/schema'
import { TYPE_META } from './types'

function pad(n: number) { return n.toString().padStart(2, '0') }

function isoDateToCalDate(iso: string) {
  return iso.replaceAll('-', '')   // YYYYMMDD
}

function nowStamp() {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escIcs(s: string) {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function buildIcs(planDays: PlanDay[], opts?: { calendarName?: string }): string {
  const calName = opts?.calendarName ?? 'TRI·AX · Plan Triatlón'
  const stamp = nowStamp()
  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//TRIAX//Plan//ES')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${escIcs(calName)}`)

  for (const d of planDays) {
    if (d.type === 'rest') continue
    const meta = TYPE_META[d.type]
    const start = isoDateToCalDate(d.date)
    // Build next-day for DTEND (all-day events are exclusive end)
    const nextDay = (() => {
      const dt = new Date(d.date + 'T00:00:00')
      dt.setDate(dt.getDate() + 1)
      return isoDateToCalDate(dt.toISOString().slice(0,10))
    })()
    const summary = `${meta.emoji} ${d.title}`
    const desc: string[] = [d.description || '']
    if (d.intensity) desc.push(`Intensidad: ${d.intensity}`)
    if (d.targetDistanceKm) desc.push(`Distancia: ${d.targetDistanceKm} km`)
    if (d.targetDurationMin) desc.push(`Duración: ${d.targetDurationMin} min`)
    if (d.drill) desc.push(`Drill: ${d.drill}`)
    if (d.isBrick) desc.push(`(Brick)`)
    if (d.isDeload) desc.push(`(Deload)`)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:triax-${d.date}-${d.type}@triax-alex.netlify.app`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${start}`)
    lines.push(`DTEND;VALUE=DATE:${nextDay}`)
    lines.push(`SUMMARY:${escIcs(summary)}`)
    lines.push(`DESCRIPTION:${escIcs(desc.join('\\n'))}`)
    lines.push(`CATEGORIES:${escIcs(meta.label)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(text: string, filename = 'triax-plan.ics') {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
