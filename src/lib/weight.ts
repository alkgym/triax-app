import { db, type BodyMetric } from '../db/schema'

// ─────────────────────────────────────────────────────────────
// Peso corporal — guardado y lectura robustos.
//
// `bodyMetrics` usa `++id` como clave e index NO-único en `date`, así que
// `db.bodyMetrics.put({ date, weight })` (sin id) SIEMPRE inserta una fila
// nueva: pesarse dos veces el mismo día generaba duplicados. Estas utilidades
// centralizan el upsert por fecha (sin borrar histórico de otros días) y la
// deduplicación por fecha en las lecturas (nos quedamos con el registro más
// reciente = mayor id de cada día).
// ─────────────────────────────────────────────────────────────

/** Guarda el peso de un día actualizando el registro existente en lugar de
 *  duplicar. Nunca toca los registros de otros días. */
export async function saveWeight(date: string, weight: number): Promise<void> {
  const existing = await db.bodyMetrics.where('date').equals(date).sortBy('id')
  if (existing.length > 0) {
    const keep = existing[existing.length - 1] // el más reciente
    await db.bodyMetrics.update(keep.id!, { weight })
  } else {
    await db.bodyMetrics.add({ date, weight })
  }
}

/** Un registro por fecha (el más reciente), ordenado por fecha ascendente.
 *  Robustece las lecturas frente a duplicados heredados sin borrarlos. */
export function latestByDate(metrics: BodyMetric[] | undefined): BodyMetric[] {
  const byDate = new Map<string, BodyMetric>()
  for (const m of metrics ?? []) {
    const prev = byDate.get(m.date)
    if (!prev || (m.id ?? 0) >= (prev.id ?? 0)) byDate.set(m.date, m)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/** Último peso registrado (el más reciente por fecha). `undefined` si no hay. */
export function latestWeight(metrics: BodyMetric[] | undefined): BodyMetric | undefined {
  const rows = latestByDate(metrics)
  return rows[rows.length - 1]
}
