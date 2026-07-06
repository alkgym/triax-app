// Alex López — Plan v2: Push · Pull · NadoMid · Pierna · Torso · Bici+Brick · Libre
//
// Distribución semanal:
//   Lun         Push                                       (75-90 min)
//   Mar  AM/PM  Pull + Correr Z2 (doble)                    (60-75 / 30-45 min)
//   Mié         Nado (largo · midweek endurance day)         (45-75 min)
//   Jue         Pierna                                       (75-90 min)
//   Vie  AM/PM  Torso + Nado técnica (doble)                 (60-75 / 30-45 min)
//   Sáb         Bici + Brick correr (doble race-specific)    (60-90 / 15-30 min)
//   Dom         Libre · descanso total
//
// Bici=1/sem (largo Sáb), Correr=2/sem (Mar Z2 + Sáb brick), Nado=2/sem (Mié largo + Vie técnica).
// Periodización: Base 1-8 · Build 9-14 · Peak 15-19 · Taper 20-21. Deload 3+1 (W4, W8, W12, W16).
// Sesgo: -5/8% vs estándar por déficit calórico + 6-7h sueño + trabajo de pie.

import { db, type ExerciseTemplate, type PlanDay } from '../schema'
import { addDays } from '../../lib/dates'

// ── Plantillas afinadas con cargas personalizadas ───────────────────────────

const ALEX_PUSH: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'push', order: 1, name: 'Press banca',                series: 4, reps: '5-7',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 110, notas: '75% 1RM. Calienta 60·80·100. Codos 60-70°.', muscleGroups: ['pecho','triceps','hombro'], active: true },
  { type: 'push', order: 2, name: 'Press militar pie',          series: 3, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 50,  notas: 'Glúteos activos, sin hiperextender.', muscleGroups: ['hombro','triceps'], active: true },
  { type: 'push', order: 3, name: 'Press inclinado mancuerna',  series: 3, reps: '8-10',  rir: '2',   pesoUnidad: 'kg', pesoSugerido: 30,  notas: '30°. Codos cómodos. Por mancuerna.', muscleGroups: ['pecho','hombro','triceps'], active: true },
  { type: 'push', order: 4, name: 'Aperturas polea cruzada',    series: 3, reps: '10-12', rir: '1',   pesoUnidad: 'kg', pesoSugerido: 12,  notas: 'Pecho contraído. Codo ligeramente flexionado.', muscleGroups: ['pecho'], active: true },
  { type: 'push', order: 5, name: 'Elevaciones laterales',      series: 4, reps: '12-15', rir: '1',   pesoUnidad: 'kg', pesoSugerido: 10,  notas: 'Tronco quieto. Codo > muñeca arriba.', muscleGroups: ['hombro'], active: true },
  { type: 'push', order: 6, name: 'Fondos paralelas',           series: 3, reps: '8-10',  rir: '1',   pesoUnidad: 'bw', notas: 'Tronco vertical. Lastre cuando 10+ reps fácil.', muscleGroups: ['triceps','pecho'], active: true },
]

const ALEX_PULL: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'pull', order: 1, name: 'Dominada lastrada',          series: 4, reps: '5-7',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 5,   notas: 'BW+5kg. Mentón sobre barra. Sube 2.5kg cuando alcances 7×4.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 2, name: 'Remo Pendlay',               series: 4, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 80,  notas: 'Pausa en suelo cada rep. Tirar al ombligo.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 3, name: 'Jalón al pecho neutro',      series: 3, reps: '8-10',  rir: '2',   pesoUnidad: 'kg', pesoSugerido: 65,  notas: 'Codos al cuerpo. Pecho arriba. Bajada 2s.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 4, name: 'Remo unilateral mancuerna',  series: 3, reps: '10-12', rir: '2',   pesoUnidad: 'kg', pesoSugerido: 30,  notas: 'Banco apoyado. Sin rotar tronco.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 5, name: 'Curl bíceps barra Z',        series: 3, reps: '8-10',  rir: '1',   pesoUnidad: 'kg', pesoSugerido: 35,  notas: 'Codos pegados. Sin balanceo.', muscleGroups: ['biceps'], active: true },
  { type: 'pull', order: 6, name: 'Face pulls cuerda',          series: 3, reps: '12-15', rir: '1',   pesoUnidad: 'kg', pesoSugerido: 20,  notas: 'Manos a la cara. Codos altos. Pausa 1s.', muscleGroups: ['espalda','hombro'], active: true },
]

const ALEX_LEGS: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'legs', order: 1, name: 'Sentadilla trasera',         series: 4, reps: '5-7',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 145, notas: '75% de 195. Muslo paralelo. Rodilla sigue al pie.', muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'legs', order: 2, name: 'Peso muerto rumano',         series: 4, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 130, notas: '65% de 200. Cadera atrás, lumbar neutra.', muscleGroups: ['isquios','gluteo'], active: true },
  { type: 'legs', order: 3, name: 'Búlgara mancuerna',          series: 3, reps: '8/lado', rir: '2',  pesoUnidad: 'kg', pesoSugerido: 25,  notas: 'Tronco vertical. Por mancuerna (2×25).', muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'legs', order: 4, name: 'Curl femoral nórdico',       series: 3, reps: '6',     rir: '1-2', pesoUnidad: 'bw', notas: 'Excéntrica 3-4s. Rodillas en colchoneta.', muscleGroups: ['isquios'], active: true },
  { type: 'legs', order: 5, name: 'Elevación gemelo de pie',    series: 4, reps: '12-15', rir: '1',   pesoUnidad: 'kg', pesoSugerido: 80,  notas: 'Full ROM. Pausa 1s arriba.', muscleGroups: ['gemelo'], active: true },
  { type: 'legs', order: 6, name: 'Plancha lateral',            series: 3, reps: '40s/lado', rir: '—',pesoUnidad: 'bw', notas: 'Caderas alineadas. No rotar.', muscleGroups: ['core'], active: true },
]

const ALEX_TORSO: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'torso', order: 1, name: 'Press militar pie pesado',  series: 4, reps: '4-6',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 60,  notas: 'Día pesado de hombro. RIR 2 estricto.', muscleGroups: ['hombro','triceps'], active: true },
  { type: 'torso', order: 2, name: 'Remo Pendlay',              series: 3, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 75,  notas: 'Mantiene capacidad espalda.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'torso', order: 3, name: 'Press banca inclinado',     series: 3, reps: '6-8',   rir: '2',   pesoUnidad: 'kg', pesoSugerido: 95,  notas: 'Inclinado 30°. Refuerzo tras Push.', muscleGroups: ['pecho','hombro','triceps'], active: true },
  { type: 'torso', order: 4, name: 'Dominada lastrada (densidad)', series: 3, reps: '6-8', rir: '2',  pesoUnidad: 'kg', pesoSugerido: 5,   notas: 'Más volumen, no fallar.', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'torso', order: 5, name: 'Pallof press polea',        series: 3, reps: '10/lado', rir: '—',pesoUnidad: 'kg', pesoSugerido: 15,  notas: 'Anti-rotación. Crítico para nado.', muscleGroups: ['core'], active: true },
  { type: 'torso', order: 6, name: 'Rueda abdominal',           series: 3, reps: '8-10',  rir: '1',   pesoUnidad: 'bw', notas: 'No hundir lumbar. Glúteos contraídos.', muscleGroups: ['core'], active: true },
]

// ── Phase definition ─────────────────────────────────────────────────────────

type Phase = 'base' | 'build' | 'peak' | 'taper'

function phaseFor(weekIdx: number): Phase {
  // weekIdx is 0-based; weeks numbered 1-21
  if (weekIdx < 8)  return 'base'
  if (weekIdx < 14) return 'build'
  if (weekIdx < 19) return 'peak'
  return 'taper'
}

function isDeloadWeek(weekIdx: number): boolean {
  // 3+1: weeks W4, W8, W12, W16 (0-indexed: 3, 7, 11, 15)
  return weekIdx === 3 || weekIdx === 7 || weekIdx === 11 || weekIdx === 15
}

// ── Endurance progression — by week ──────────────────────────────────────────
//
// Each endurance "slot" is a function of phase + isDeload + weekIdx. We compute
// it deterministically so it's predictable and easy to inspect.

interface EnduranceSpec {
  type: 'swim' | 'bike' | 'run'
  title: string
  description: string
  distKm?: number
  durMin: number
  intensity: string
  drill?: string
  timeOfDay?: 'AM' | 'PM'
  isBrick?: boolean
}

// Tuesday PM: short Z2 run (slot 1, after Pull AM)
function tueRun(weekIdx: number, isDeload: boolean): EnduranceSpec {
  const base = Math.min(3.5 + weekIdx * 0.3, 7)   // 3.5km → 7km cap
  const dist = isDeload ? base * 0.7 : base
  const dur = Math.round(dist * 5.5)              // ~5:30/km Z2
  return {
    type: 'run',
    title: isDeload ? `Correr · DELOAD ${dist.toFixed(1)}km Z2` : `Correr · ${dist.toFixed(1)}km Z2`,
    description: `${dist.toFixed(1)}km a 5:30/km muy cómodo. PM tras Pull. Cadencia 175+ spm.`,
    distKm: +dist.toFixed(1),
    durMin: dur,
    intensity: 'Z2',
    timeOfDay: 'PM',
  }
}

// Wednesday: midweek swim — the long swim of the week
function wedSwim(weekIdx: number, isDeload: boolean): EnduranceSpec {
  // First 3 weeks: technique only, no distance target
  if (weekIdx < 3) {
    return {
      type: 'swim',
      title: 'Nado · Técnica',
      description: `Técnica pura. ${weekIdx === 0 ? '8' : weekIdx === 1 ? '10' : '12'}×25m con descanso largo. Foco: caderas arriba + rotación + respiración bilateral.`,
      durMin: 45 + weekIdx * 5,
      intensity: 'Técnica',
      drill: 'Catch-up · 6-1-6 · fingertip drag',
    }
  }
  // From W4 onwards: distance progresses
  const distM = Math.min(200 + (weekIdx - 3) * 60, 1000)
  const dist = isDeload ? distM * 0.7 : distM
  return {
    type: 'swim',
    title: isDeload ? `Nado · DELOAD ${Math.round(dist)}m` : `Nado · ${Math.round(dist)}m largo`,
    description: `Largo ${Math.round(dist)}m continuo + drills. Foco técnica sostenida. ${weekIdx >= 12 ? 'Mar abierto si disponible.' : ''}`,
    distKm: +(dist / 1000).toFixed(2),
    durMin: Math.round(40 + weekIdx * 1.5),
    intensity: 'Z2 + técnica',
    drill: 'Catch-up + sighting si mar',
  }
}

// Friday PM: short technique swim (slot 1, after Torso AM)
function friSwim(weekIdx: number, isDeload: boolean): EnduranceSpec {
  if (weekIdx < 2) {
    return {
      type: 'swim',
      title: 'Nado · Técnica corta',
      description: 'Sesión técnica corta tras Torso. 6×25m drills. Cuerda elástica si piscina ocupada.',
      durMin: 30,
      intensity: 'Técnica',
      drill: 'Fingertip drag · sculling',
      timeOfDay: 'PM',
    }
  }
  const distM = isDeload ? 150 : Math.min(150 + weekIdx * 15, 500)
  return {
    type: 'swim',
    title: `Nado técnica · ${Math.round(distM)}m`,
    description: `Técnica + ${Math.round(distM)}m. Foco drills + 4×50m a buen ritmo. PM tras Torso.`,
    distKm: +(distM / 1000).toFixed(2),
    durMin: 30 + Math.min(weekIdx, 10),
    intensity: 'Técnica + Z2',
    drill: 'Catch-up · respiración bilateral',
    timeOfDay: 'PM',
  }
}

// Saturday: bike + brick run
function satBike(weekIdx: number, isDeload: boolean, phase: Phase): EnduranceSpec {
  const baseDur = Math.min(40 + weekIdx * 3, 95)
  const dur = isDeload ? baseDur * 0.75 : baseDur
  const intensity = phase === 'base'
    ? 'Z2'
    : phase === 'build'
    ? 'Z2 + sweet spot'
    : phase === 'peak'
    ? 'Race-specific'
    : 'Z2 corto'
  const description = phase === 'base'
    ? `Indoor o outdoor ${Math.round(dur)}min Z2 continuo. Cadencia 85-92 RPM.`
    : phase === 'build'
    ? `${Math.round(dur)}min. ${weekIdx >= 9 ? '3-4×6-8min sweet spot' : '2×8min sweet spot'}, rec 3-4min entre.`
    : phase === 'peak'
    ? `${Math.round(dur)}min race-pace simulado. Equipo de carrera completo.`
    : `Taper: ${Math.round(dur)}min Z2 con 3×3min activación.`
  return {
    type: 'bike',
    title: isDeload ? `Bici · DELOAD ${Math.round(dur)}min` : `Bici · ${Math.round(dur)}min ${intensity}`,
    description,
    durMin: Math.round(dur),
    intensity,
  }
}

function satBrick(weekIdx: number, isDeload: boolean, phase: Phase): EnduranceSpec | null {
  // No brick in base (W1-7) or deload, or in race week
  if (phase === 'base' && weekIdx < 6) return null
  if (isDeload) return null
  if (weekIdx === 20) return null   // race week (W21 = race day Sunday)
  const dist = phase === 'peak' ? 3 : 2
  return {
    type: 'run',
    title: `Brick · Correr ${dist}km off-bike`,
    description: `Inmediatamente tras la bici, ${dist}km a 5:40-5:50/km (piernas tocadas, normal). Practica T2 completa: zapas con elásticos, casco fuera lo último.`,
    distKm: dist,
    durMin: Math.round(dist * 5.8),
    intensity: 'Brick',
    timeOfDay: 'PM',
    isBrick: true,
  }
}

// ── Plan day generation ──────────────────────────────────────────────────────

interface BuildOpts {
  startDate: string   // ISO yyyy-mm-dd, must be a Monday
  raceDate: string    // ISO
}

const TITLES = {
  push:  'Push · Pecho/Hombro/Tríceps',
  pull:  'Pull · Espalda/Bíceps',
  legs:  'Pierna · Cuádriceps/Isquios/Glúteo',
  torso: 'Torso · Hombro/Espalda/Core',
} as const

export function buildAlexPlanDays(opts: BuildOpts): Omit<PlanDay, 'id'>[] {
  const out: Omit<PlanDay, 'id'>[] = []
  const TOTAL_WEEKS = 21

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const weekNumber = w + 1
    const phase = phaseFor(w)
    const isDeload = isDeloadWeek(w)
    const deloadTag = isDeload ? '\n\n(Semana DELOAD: -1 serie por ejercicio, RIR +1.)' : ''

    // Mon — Push (single)
    out.push(strengthDay(
      addDays(opts.startDate, w * 7 + 0), weekNumber, phase, 'push',
      TITLES.push, 'Sigue plantilla Push (Ajustes → Plantillas). Calienta press banca progresivo.' + deloadTag,
      isDeload,
    ))

    // Tue — Pull (slot 0, AM) + Correr Z2 (slot 1, PM)
    out.push(strengthDay(
      addDays(opts.startDate, w * 7 + 1), weekNumber, phase, 'pull',
      TITLES.pull, 'Sigue plantilla Pull (Ajustes → Plantillas). Foco dominada lastrada + Pendlay.' + deloadTag,
      isDeload, { slot: 0, timeOfDay: 'AM' },
    ))
    out.push(enduranceDay(addDays(opts.startDate, w * 7 + 1), weekNumber, phase, isDeload, tueRun(w, isDeload), 1))

    // Wed — Nado (single, the long swim of the week)
    out.push(enduranceDay(addDays(opts.startDate, w * 7 + 2), weekNumber, phase, isDeload, wedSwim(w, isDeload), 0))

    // Thu — Pierna (single)
    out.push(strengthDay(
      addDays(opts.startDate, w * 7 + 3), weekNumber, phase, 'legs',
      TITLES.legs, 'Sigue plantilla Pierna. Calienta sentadilla progresivo desde barra. Cuida lumbar en PM rumano.' + deloadTag,
      isDeload,
    ))

    // Fri — Torso (slot 0, AM) + Nado técnica (slot 1, PM)
    out.push(strengthDay(
      addDays(opts.startDate, w * 7 + 4), weekNumber, phase, 'torso',
      TITLES.torso, 'Sigue plantilla Torso. Reforzar hombro pesado + core anti-rotación.' + deloadTag,
      isDeload, { slot: 0, timeOfDay: 'AM' },
    ))
    out.push(enduranceDay(addDays(opts.startDate, w * 7 + 4), weekNumber, phase, isDeload, friSwim(w, isDeload), 1))

    // Sat — Bici (slot 0) + opcional Brick run (slot 1)
    out.push(enduranceDay(addDays(opts.startDate, w * 7 + 5), weekNumber, phase, isDeload, satBike(w, isDeload, phase), 0))
    const brick = satBrick(w, isDeload, phase)
    if (brick) {
      out.push(enduranceDay(addDays(opts.startDate, w * 7 + 5), weekNumber, phase, isDeload, brick, 1))
    }

    // Sun — Libre
    out.push({
      date: addDays(opts.startDate, w * 7 + 6),
      slot: 0, weekNumber, phase, type: 'rest',
      title: 'Domingo libre',
      description: isDeload
        ? 'Domingo libre. Sin obligación. Si te apetece moverte, paseo y foam roller. Prioriza dormir 8h+.'
        : 'Domingo libre. Sin entreno, sin obligación. Recupérate de verdad.',
      isDeload,
    })
  }

  // Race day override (last Sunday)
  const last = out.filter(p => p.type === 'rest').pop()
  if (last && last.date === opts.raceDate) {
    last.type = 'brick'
    last.title = '🏁 ARTIEM HALF MENORCA · Race day'
    last.description = [
      '1km nado · 38km bici · 9km carrera.',
      '',
      'NADO 1km: salida controlada. Sighting cada 6-8 brazadas. Drafting si grupo a tu ritmo.',
      'T1 (<90s): goggles fuera, casco antes que dorsal.',
      'BICI 38km: 88-92 RPM. Gel min 25. Acoples si tienes. Constancia, no atacar.',
      'T2 (<90s): elásticos en zapas. Casco fuera lo último.',
      'CARRERA 9km: 1.5km transición piernas pesadas (normal). Luego 5:30/km estable. Último km, todo.',
    ].join('\n')
    last.intensity = 'Race'
    last.isBrick = true
  }
  return out
}

function strengthDay(
  date: string, weekNumber: number, phase: Phase, type: 'push' | 'pull' | 'legs' | 'torso',
  title: string, description: string, isDeload: boolean,
  extra: Partial<PlanDay> = {},
): Omit<PlanDay, 'id'> {
  return {
    date, slot: 0, weekNumber, phase, type, title, description, isDeload, ...extra,
  }
}

function enduranceDay(
  date: string, weekNumber: number, phase: Phase, isDeload: boolean,
  spec: EnduranceSpec, slot: number,
): Omit<PlanDay, 'id'> {
  return {
    date, slot, weekNumber, phase, type: spec.type,
    title: spec.title, description: spec.description,
    targetDistanceKm: spec.distKm,
    targetDurationMin: spec.durMin,
    intensity: spec.intensity,
    drill: spec.drill,
    timeOfDay: spec.timeOfDay,
    isDeload,
    isBrick: spec.isBrick,
  }
}

// ── Apply orchestrator ──────────────────────────────────────────────────────

export interface AlexPlanResult {
  templatesInstalled: { push: number; pull: number; legs: number; torso: number }
  planDaysCreated: number
}

export async function applyAlexPlan(opts: BuildOpts): Promise<AlexPlanResult> {
  return await db.transaction('rw', db.exerciseTemplates, db.planDays, async () => {
    // 1. Replace strength templates (soft-deactivate existing → preserve historical sets)
    await deactivateAndReplace('push',  ALEX_PUSH)
    await deactivateAndReplace('pull',  ALEX_PULL)
    await deactivateAndReplace('legs',  ALEX_LEGS)
    await deactivateAndReplace('torso', ALEX_TORSO)

    // 2. Wipe existing planDays + insert new 21-week plan
    await db.planDays.clear()
    const days = buildAlexPlanDays(opts)
    await db.planDays.bulkAdd(days as PlanDay[])

    return {
      templatesInstalled: {
        push: ALEX_PUSH.length, pull: ALEX_PULL.length,
        legs: ALEX_LEGS.length, torso: ALEX_TORSO.length,
      },
      planDaysCreated: days.length,
    }
  })
}

async function deactivateAndReplace(type: string, fresh: Omit<ExerciseTemplate, 'id'>[]) {
  const existing = await db.exerciseTemplates.where('type').equals(type).toArray()
  await Promise.all(existing.filter(t => t.active).map(t =>
    db.exerciseTemplates.update(t.id!, { active: false })
  ))
  await db.exerciseTemplates.bulkAdd(fresh as ExerciseTemplate[])
}
