// Swap the content of two dates' plan days. The dates stay fixed; we swap
// each slot's content between the two days.
//
// Multi-slot handling:
//   • For each slot present in either day, we swap fields between matching slots.
//   • If one day has more slots than the other, we MOVE the extras over by updating
//     their date+slot accordingly so both dates keep parity.
//   • Sessions logged (workout history) remain attached to the calendar date where
//     they were performed — only the planning intent moves.

import { db, type PlanDay } from '../db/schema'

const SWAPPABLE_FIELDS: (keyof PlanDay)[] = [
  'type',
  'title',
  'description',
  'targetDistanceKm',
  'targetDurationMin',
  'intensity',
  'drill',
  'timeOfDay',
  'isDeload',
  'isBrick',
]

function pickSwappable(d: PlanDay): Partial<PlanDay> {
  const out: Partial<PlanDay> = {}
  for (const k of SWAPPABLE_FIELDS) (out as any)[k] = (d as any)[k]
  return out
}

export interface SwapResult {
  ok: boolean
  reason?: 'same-date' | 'not-found' | 'error'
}

export async function swapPlanDays(dateA: string, dateB: string): Promise<SwapResult> {
  if (dateA === dateB) return { ok: false, reason: 'same-date' }
  try {
    return await db.transaction('rw', db.planDays, async () => {
      const [aDays, bDays] = await Promise.all([
        db.planDays.where('date').equals(dateA).toArray(),
        db.planDays.where('date').equals(dateB).toArray(),
      ])
      if (aDays.length === 0 || bDays.length === 0) return { ok: false, reason: 'not-found' as const }

      const aBySlot = new Map<number, PlanDay>(aDays.map(d => [d.slot ?? 0, d]))
      const bBySlot = new Map<number, PlanDay>(bDays.map(d => [d.slot ?? 0, d]))
      const allSlots = new Set<number>([...aBySlot.keys(), ...bBySlot.keys()])

      for (const slot of allSlots) {
        const a = aBySlot.get(slot)
        const b = bBySlot.get(slot)
        if (a && b) {
          // Both sides have this slot — swap content
          const aFields = pickSwappable(a)
          const bFields = pickSwappable(b)
          await db.planDays.update(a.id!, bFields)
          await db.planDays.update(b.id!, aFields)
        } else if (a && !b) {
          // Only A has this slot — move it to B's date
          await db.planDays.update(a.id!, { date: dateB })
        } else if (b && !a) {
          // Only B has this slot — move it to A's date
          await db.planDays.update(b.id!, { date: dateA })
        }
      }
      return { ok: true }
    })
  } catch {
    return { ok: false, reason: 'error' }
  }
}
