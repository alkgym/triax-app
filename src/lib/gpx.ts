// Lightweight GPX parser. Extracts total distance (km), duration (min), and avg HR if present (Garmin/Samsung extensions).
export interface GpxResult {
  distanceKm: number
  durationMin: number
  avgHR?: number
  startTime?: string
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function parseGpx(xmlText: string): GpxResult {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const points = Array.from(doc.getElementsByTagName('trkpt'))
  if (points.length === 0) return { distanceKm: 0, durationMin: 0 }

  let dist = 0
  let prev: { lat: number; lon: number } | null = null
  let firstTime: number | null = null
  let lastTime: number | null = null
  const hrs: number[] = []

  for (const p of points) {
    const lat = Number(p.getAttribute('lat'))
    const lon = Number(p.getAttribute('lon'))
    if (prev) dist += haversine(prev.lat, prev.lon, lat, lon)
    prev = { lat, lon }

    const time = p.getElementsByTagName('time')[0]?.textContent
    if (time) {
      const t = new Date(time).getTime()
      if (firstTime == null) firstTime = t
      lastTime = t
    }
    const hrEl = p.getElementsByTagNameNS('*', 'hr')[0]
    if (hrEl?.textContent) hrs.push(Number(hrEl.textContent))
  }

  const durationMin = firstTime && lastTime ? Math.round((lastTime - firstTime) / 60000) : 0
  const avgHR = hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : undefined
  const startTime = firstTime ? new Date(firstTime).toISOString() : undefined

  return {
    distanceKm: Math.round(dist * 100) / 100,
    durationMin,
    avgHR,
    startTime,
  }
}
