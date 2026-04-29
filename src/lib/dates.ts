function parseUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function toIso(d: Date): string { return d.toISOString().slice(0, 10) }

export function todayIso(): string {
  const n = new Date()
  return toIso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())))
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return parseUTC(iso).toLocaleDateString('es-ES', { ...opts, timeZone: 'UTC' })
}

export function shortDate(iso: string): string {
  return parseUTC(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function startOfWeek(iso: string): string {
  const d = parseUTC(iso)
  const dow = (d.getUTCDay() + 6) % 7 // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow)
  return toIso(d)
}

export function addDays(iso: string, n: number): string {
  const d = parseUTC(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toIso(d)
}

export function dayName(iso: string): string {
  return parseUTC(iso).toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' })
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
