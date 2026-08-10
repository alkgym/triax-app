// prs.ts — registro automático de récords personales (PR).
//
// Cuando se completa una serie cuyo e1RM estimado (Epley) supera el mejor
// histórico de ese ejercicio, se guarda un PersonalRecord. Mismo criterio que
// el badge "PR" de Hoy: mejorar por reps también cuenta, no solo por kg.
// Idempotente (no duplica) y nunca rompe el flujo de completar serie.
import { db } from '../db/schema'
import { epley1RM, setE1RM } from './progression'

export async function maybeRecordPR(uuid: string): Promise<boolean> {
  try {
    const set = await db.sets.where('uuid').equals(uuid).first()
    if (!set || !set.completed || !set.exercise || set.weight == null || set.weight <= 0) return false
    const exercise = set.exercise
    const e1 = setE1RM(set)
    if (e1 == null) return false

    // Mejor e1RM en OTRAS sesiones + en la tabla de PRs.
    const allSets = await db.sets.where('exercise').equals(exercise).toArray()
    const histBest = allSets
      .filter(s => s.sessionId !== set.sessionId)
      .reduce((m, s) => Math.max(m, setE1RM(s) ?? 0), 0)
    const prBest = (await db.prs.where('exercise').equals(exercise).toArray())
      .reduce((m, p) => Math.max(m, epley1RM(p.weight ?? 0, p.reps ?? 1)), 0)
    const beat = Math.max(histBest, prBest)

    // Solo si hay historia previa y se supera (no marca el primer registro de un ejercicio).
    if (beat <= 0 || e1 <= beat) return false

    const sess = await db.sessions.get(set.sessionId)
    const date = sess?.date ?? new Date().toISOString().slice(0, 10)

    // Evita duplicar el mismo PR (mismo ejercicio/peso/día).
    const dupe = await db.prs.where('exercise').equals(exercise)
      .filter(p => p.date === date && p.weight === set.weight && p.reps === (set.reps ?? 1)).count()
    if (dupe > 0) return false

    await db.prs.add({ exercise, weight: set.weight, reps: set.reps ?? 1, date })
    return true
  } catch {
    return false
  }
}
