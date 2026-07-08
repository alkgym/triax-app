// Push-Pull-Legs-Torso (4 strength + 3 endurance) split for triathlon Sprint prep.
// This module:
//   1. Installs strength templates for `legs` and `torso` (idempotent — only adds if missing).
//   2. Transforms existing planDays in-place: every day still maps to its phase / week
//      but the strength rotation goes Push · Pull · Legs · Torso instead of Push · Pull · FullBody.
//
// We DON'T touch endurance days (swim/bike/run/brick) or rest. The 21-week
// periodisation (base/build/peak/taper) stays untouched. Only the gym day
// labels rotate to the new split.

import { db, type ExerciseTemplate, type PlanDay, type WorkoutType } from '../schema'

// ── Templates ────────────────────────────────────────────────────────────────

const PUSH_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'push', order: 1, name: 'Press banca',                series: 4, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', notas: 'Calienta progresivo. Codos 60-70°, escápulas retraídas.', muscleGroups: ['pecho','triceps','hombro'], active: true },
  { type: 'push', order: 2, name: 'Press militar pie',          series: 3, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', notas: 'Glúteos activos. Sin hiperextender lumbar.',                muscleGroups: ['hombro','triceps'],          active: true },
  { type: 'push', order: 3, name: 'Press inclinado mancuerna',  series: 3, reps: '8-10',  rir: '2',   pesoUnidad: 'kg', notas: '30° inclinación. Codos cómodos.',                            muscleGroups: ['pecho','hombro','triceps'], active: true },
  { type: 'push', order: 4, name: 'Aperturas polea alta',       series: 3, reps: '10-12', rir: '1',   pesoUnidad: 'kg', notas: 'Pecho contraído. Sin codos rígidos.',                        muscleGroups: ['pecho'],                     active: true },
  { type: 'push', order: 5, name: 'Elevaciones laterales',      series: 4, reps: '12-15', rir: '1',   pesoUnidad: 'kg', notas: 'Tronco quieto. Codo ligeramente flexionado.',                muscleGroups: ['hombro'],                    active: true },
  { type: 'push', order: 6, name: 'Fondos paralelas',           series: 3, reps: '8-10',  rir: '1',   pesoUnidad: 'bw', notas: 'Tronco vertical = tríceps. Inclinado = pecho.',              muscleGroups: ['triceps','pecho'],           active: true },
]

const PULL_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'pull', order: 1, name: 'Dominada lastrada',          series: 4, reps: '5-8',   rir: '2',   pesoUnidad: 'kg', notas: 'Full ROM. Si BW <8 reps, usa banda asistida.',               muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'pull', order: 2, name: 'Remo Pendlay',               series: 4, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', notas: 'Pausa en suelo cada rep. Tirar al ombligo.',                 muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'pull', order: 3, name: 'Jalón al pecho neutro',      series: 3, reps: '8-10',  rir: '2',   pesoUnidad: 'kg', notas: 'Codos al cuerpo. Pecho arriba.',                             muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'pull', order: 4, name: 'Remo unilateral mancuerna',  series: 3, reps: '10-12', rir: '2',   pesoUnidad: 'kg', notas: 'Banco apoyado. Sin rotar tronco.',                           muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'pull', order: 5, name: 'Curl bíceps barra',          series: 3, reps: '8-10',  rir: '1',   pesoUnidad: 'kg', notas: 'Codos pegados. Sin balanceo.',                               muscleGroups: ['biceps'],                    active: true },
  { type: 'pull', order: 6, name: 'Face pulls',                 series: 3, reps: '12-15', rir: '1',   pesoUnidad: 'kg', notas: 'Manos a la altura de la cara. Codos altos.',                 muscleGroups: ['espalda','hombro'],          active: true },
]

const LEGS_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'legs', order: 1, name: 'Sentadilla trasera',     series: 4, reps: '5-8',  rir: '2-3', pesoUnidad: 'kg', notas: 'Calienta progresivo. Rodilla sigue al pie.', muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'legs', order: 2, name: 'Peso muerto rumano',     series: 4, reps: '8-10', rir: '2',   pesoUnidad: 'kg', notas: 'Cadera atrás, lumbar neutra.',                muscleGroups: ['isquios','gluteo'],     active: true },
  { type: 'legs', order: 3, name: 'Búlgara unilateral',     series: 3, reps: '8',    rir: '2',   pesoUnidad: 'kg', notas: 'Tronco vertical. Pierna trasera apoyada.',    muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'legs', order: 4, name: 'Curl femoral nórdico',   series: 3, reps: '6',    rir: '1-2', pesoUnidad: 'bw', notas: 'Excéntrica controlada 3-4 s.',                muscleGroups: ['isquios'],              active: true },
  { type: 'legs', order: 5, name: 'Elevación gemelo',       series: 4, reps: '12-15',rir: '1',   pesoUnidad: 'kg', notas: 'Full ROM. Pausa abajo 1 s.',                  muscleGroups: ['gemelo'],               active: true },
  { type: 'legs', order: 6, name: 'Plancha lateral',        series: 3, reps: '40s',  rir: '—',   pesoUnidad: 'bw', notas: 'Caderas alineadas, no rotar.',                muscleGroups: ['core'],                 active: true },
]

const TORSO_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'torso', order: 1, name: 'Press militar pie',       series: 4, reps: '6-8',  rir: '2',   pesoUnidad: 'kg', notas: 'Glúteos activos. Sin hiperextender lumbar.', muscleGroups: ['hombro','triceps'],         active: true },
  { type: 'torso', order: 2, name: 'Remo Pendlay',            series: 4, reps: '6-8',  rir: '2',   pesoUnidad: 'kg', notas: 'Pausa en el suelo cada rep.',                muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'torso', order: 3, name: 'Press banca inclinado',   series: 3, reps: '8-10', rir: '2',   pesoUnidad: 'kg', notas: '30° inclinación. Codos 60-70°.',             muscleGroups: ['pecho','hombro','triceps'], active: true },
  { type: 'torso', order: 4, name: 'Dominada lastrada',       series: 3, reps: '5-8',  rir: '2',   pesoUnidad: 'kg', notas: 'Full ROM. Cintura lastrada si BW fácil.',    muscleGroups: ['espalda','biceps'],         active: true },
  { type: 'torso', order: 5, name: 'Pallof press',            series: 3, reps: '10/lado', rir: '—',pesoUnidad: 'kg', notas: 'Anti-rotación. Polea o banda.',              muscleGroups: ['core'],                     active: true },
  { type: 'torso', order: 6, name: 'Rueda abdominal',         series: 3, reps: '8-10', rir: '1',   pesoUnidad: 'bw', notas: 'No hundir lumbar. Glúteos contraídos.',      muscleGroups: ['core'],                     active: true },
]

/**
 * Canonical templates registry — exposed by type so the UI can offer
 * "Reinstall recommended routine" per tab.
 */
export const CANONICAL_TEMPLATES: Record<string, Omit<ExerciseTemplate, 'id'>[]> = {
  push: PUSH_TEMPLATES,
  pull: PULL_TEMPLATES,
  legs: LEGS_TEMPLATES,
  torso: TORSO_TEMPLATES,
}

export function hasCanonicalRoutine(type: string): boolean {
  return Array.isArray(CANONICAL_TEMPLATES[type])
}

/**
 * Wipe existing templates for a given type (set active=false to preserve history)
 * and insert the canonical defaults. Atomic — runs inside a single Dexie transaction.
 *
 * Returns the number of canonical exercises installed.
 */
export async function reinstallTemplates(type: string): Promise<number> {
  const canonical = CANONICAL_TEMPLATES[type]
  if (!canonical) throw new Error(`No canonical routine for type: ${type}`)

  return await db.transaction('rw', db.exerciseTemplates, async () => {
    // Soft-deactivate existing templates of this type. We DON'T hard-delete
    // because already-logged sets reference templateId — keeping the row
    // (just inactive) lets the historical view continue to resolve names
    // and prevents orphan reads.
    const existing = await db.exerciseTemplates.where('type').equals(type).toArray()
    await Promise.all(
      existing.filter(t => t.active).map(t => db.exerciseTemplates.update(t.id!, { active: false }))
    )

    // Insert canonical, ordered.
    await db.exerciseTemplates.bulkAdd(canonical as ExerciseTemplate[])
    return canonical.length
  })
}

export async function installPpltTemplatesIfMissing(): Promise<{ legs: boolean; torso: boolean }> {
  let legsAdded = false, torsoAdded = false
  await db.transaction('rw', db.exerciseTemplates, async () => {
    const legsExisting = await db.exerciseTemplates.where('type').equals('legs').count()
    if (legsExisting === 0) {
      await db.exerciseTemplates.bulkAdd(LEGS_TEMPLATES as ExerciseTemplate[])
      legsAdded = true
    }
    const torsoExisting = await db.exerciseTemplates.where('type').equals('torso').count()
    if (torsoExisting === 0) {
      await db.exerciseTemplates.bulkAdd(TORSO_TEMPLATES as ExerciseTemplate[])
      torsoAdded = true
    }
  })
  return { legs: legsAdded, torso: torsoAdded }
}

// ── Plan transformation ──────────────────────────────────────────────────────
//
// We read every PlanDay, and for the days that are currently push/pull/fullbody
// we re-assign according to the new rotation. The user keeps title/description
// edits on endurance days; only gym day labels change.
//
// Rotation rule: count gym-day index across the whole plan and map
//   index % 4 → 0:push  1:pull  2:legs  3:torso
// This preserves the existing weekly cadence (gym days fall on the same
// weekdays as before) but the type rotates through 4 instead of 3.

const STRENGTH_OLD: WorkoutType[] = ['push', 'pull', 'fullbody']
const ROTATION: WorkoutType[] = ['push', 'pull', 'legs', 'torso']
const TITLES: Record<WorkoutType, string> = {
  push: 'Push · Pecho/Hombro/Tríceps',
  pull: 'Pull · Espalda/Bíceps',
  legs: 'Legs · Cuádriceps/Isquios/Glúteo',
  torso: 'Torso · Hombro/Espalda/Core',
  fullbody: 'Full Body',
  swim: 'Nado', bike: 'Bici', run: 'Carrera', brick: 'Brick',
  rest: 'Descanso',
  bike_indoor: 'Bici Indoor', swim_pool: 'Piscina', gym_free: 'Gym',
}

export async function migratePlanToPplt(): Promise<{ updated: number }> {
  const all = await db.planDays.orderBy('date').toArray()
  let updated = 0
  await db.transaction('rw', db.planDays, async () => {
    let gymIdx = 0
    for (const d of all) {
      if (STRENGTH_OLD.includes(d.type)) {
        const newType = ROTATION[gymIdx % 4]
        gymIdx++
        if (newType !== d.type) {
          await db.planDays.update(d.id!, {
            type: newType,
            title: TITLES[newType],
            // Wipe the description if it was the canned one — preserve user edits.
            description: looksLikeCannedDescription(d) ? '' : d.description,
          })
          updated++
        }
      }
    }
  })
  return { updated }
}

function looksLikeCannedDescription(d: PlanDay): boolean {
  if (!d.description) return true
  const desc = d.description.toLowerCase()
  return desc.includes('plantilla') || desc.includes('seguir orden') || desc.length < 40
}

// Convenience: do both in one shot.
export async function applyPpltSplit(): Promise<{ legsAdded: boolean; torsoAdded: boolean; planUpdated: number }> {
  const tpl = await installPpltTemplatesIfMissing()
  const plan = await migratePlanToPplt()
  return { legsAdded: tpl.legs, torsoAdded: tpl.torso, planUpdated: plan.updated }
}
