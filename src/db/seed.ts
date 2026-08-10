import { db, type ExerciseTemplate, type PlanDay, type Phase, type WorkoutType } from './schema'
import { REHAB_LIBRARY } from '../lib/rehab'

// Plan: 2026-05-04 (Mon, week 1) → 2026-09-27 (Sun, race day) = 21 weeks
const START = '2026-05-04'
const RACE = '2026-09-27'

const TOTAL_WEEKS = 21

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function daysUntilRace(raceDateIso?: string, today = new Date()): number {
  const dateStr = raceDateIso ?? RACE
  const [ry, rm, rd] = dateStr.split('-').map(Number)
  const race = Date.UTC(ry, rm - 1, rd)
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((race - t) / 86400000)
}

export function weekIndexFor(dateIso: string): number {
  const [sy, sm, sd] = START.split('-').map(Number)
  const start = Date.UTC(sy, sm - 1, sd)
  const [y, m, d] = dateIso.split('-').map(Number)
  const dt = Date.UTC(y, m - 1, d)
  const diffDays = Math.floor((dt - start) / 86400000)
  if (diffDays < 0) return 0
  return Math.floor(diffDays / 7) + 1
}

function phaseFor(week: number): Phase {
  if (week <= 8) return 'base'
  if (week <= 14) return 'build'
  if (week <= 18) return 'peak'
  return 'taper'
}

const SWIM_DRILLS = [
  'Catch-up drill',
  'Fingertip drag',
  'Side kick (6-1-6)',
  'Single arm drill',
  'Zipper / Shark fin',
  'Cuerda estática 2×8\'',
  'Sighting drill (cada 5 brazadas)',
]

// Build the 21-week plan, 7 days/week = 147 PlanDays
export function buildPlanDays(): PlanDay[] {
  const days: PlanDay[] = []
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const phase = phaseFor(w)
    const isDeload = w === 4 || w === 8 || w === 12 || w === 16
    for (let dow = 0; dow < 7; dow++) {
      const date = addDays(START, (w - 1) * 7 + dow)
      let type: WorkoutType = 'rest'
      let title = ''
      let description = ''
      let targetDistanceKm: number | undefined
      let targetDurationMin: number | undefined
      let intensity: string | undefined
      let drill: string | undefined
      let isBrick = false

      // Microciclo High-Low (Gemini) — Lun/Mar/Jue/Vie gym + endurance
      switch (dow) {
        case 0: // Lunes — PUSH (tren superior empuje)
          type = 'push'
          title = 'Push · Pecho/Hombro/Tríceps'
          description = 'Sesión de fuerza tren superior empuje. Calentamiento articular 5 min.'
          break
        case 1: // Martes — PULL (tren superior tracción) + Nado técnica matutino
          type = 'pull'
          title = 'Pull · Espalda/Bíceps + Nado técnica AM'
          description = `AM (opcional) Nado técnica 30-40 min · Drill: ${SWIM_DRILLS[(w - 1) % SWIM_DRILLS.length]}\nPM Pesas: tracción superior.`
          break
        case 2: // Miércoles — BICI Z2
          type = 'bike'
          if (phase === 'base') { targetDurationMin = 45 + Math.min(15, (w - 1) * 3); intensity = 'Z2' }
          else if (phase === 'build') { targetDurationMin = 75; intensity = 'Z2 base' }
          else if (phase === 'peak') { targetDurationMin = 90; intensity = 'Z2 base' }
          else { targetDurationMin = 45; intensity = 'Z2 suave' }
          title = `Bici · Z2 ${targetDurationMin}'`
          description = `Rodaje base · Cadencia 85-95 RPM · ${intensity} · Sin fatiga mecánica.`
          break
        case 3: // Jueves — FULL BODY (hipertrofia / tren inferior)
          type = 'fullbody'
          title = 'Full Body · Tren inferior + accesorios'
          description = 'Sesión hipertrofia funcional. Foco unilateral y core (Pallof, plancha).'
          break
        case 4: // Viernes — CARRERA suave + tren superior tracción ligero (opt)
          type = 'run'
          if (phase === 'base') { targetDistanceKm = 4 + Math.min(3, w * 0.5); intensity = 'Z2 conversacional' }
          else if (phase === 'build') {
            targetDistanceKm = w % 2 === 1 ? 7 : 6
            intensity = w % 2 === 1 ? 'Series: 2km cal + 4×1km @4:50/km + 1km cal' : 'Tempo: 1km cal + 4km @5:10/km + 1km cal'
          } else if (phase === 'peak') {
            targetDistanceKm = 7
            intensity = 'Tempo Z3 · 5km @ ritmo objetivo carrera'
          } else { targetDistanceKm = 4; intensity = 'Activación · strides 6×100m' }
          targetDurationMin = Math.round(targetDistanceKm * 5.5)
          title = `Carrera · ${targetDistanceKm.toFixed(1)}km`
          description = `Pliométricos 8' (pogo 3×15", comba 2×45", forward pogo 2×10m) · ${intensity}`
          break
        case 5: // Sábado — Brick (bici + carrera) en build/peak, bici larga en base
          if (phase === 'base') {
            type = 'bike'
            targetDistanceKm = 25 + Math.min(15, w * 2)
            targetDurationMin = 60 + Math.min(30, w * 4)
            intensity = 'Z2 largo · ruta Menorca'
            title = `Bici larga · ${targetDistanceKm}km`
            description = `Rodaje largo Z2 · cadencia 85-95 · nutrición sólida desde min 45.`
          } else if (phase === 'build' || phase === 'peak') {
            type = 'brick'
            isBrick = true
            const bikeKm = phase === 'build' ? 30 + (w - 9) * 2 : 38
            targetDistanceKm = bikeKm
            targetDurationMin = 90 + (w - 9) * 5
            intensity = phase === 'peak' ? 'Bici ritmo carrera + 3km T2' : 'Bici Z3 sweet spot + 3km transición'
            title = `Brick · ${bikeKm}km bici → 3km carrera`
            description = `BRICK TRAINING · ${bikeKm}km bici @${intensity} · Transición rápida (T2 < 90s) · 3km carrera @5:30/km · Choque neurovascular.`
          } else {
            type = 'bike'
            targetDistanceKm = 20
            targetDurationMin = 50
            intensity = 'Z2 activación'
            title = `Bici · ${targetDistanceKm}km activación`
            description = 'Rodaje suave de mantenimiento. 3 aceleraciones de 30" en plano.'
          }
          break
        case 6: // Domingo — Nado largo aguas abiertas / piscina
          type = 'swim'
          if (phase === 'base') {
            targetDistanceKm = 0.6 + Math.min(0.6, (w - 1) * 0.08)
            intensity = `Drill: ${SWIM_DRILLS[(w - 1) % SWIM_DRILLS.length]} · 8×50m @25" desc`
            targetDurationMin = 50
          } else if (phase === 'build') {
            targetDistanceKm = 1.2 + (w - 9) * 0.1
            intensity = '3×200m @20" + 2×300m @30" + 400m test'
            targetDurationMin = 70
          } else if (phase === 'peak') {
            targetDistanceKm = w % 4 === 1 ? 1.0 : 1.5
            intensity = w % 4 === 1 ? '1×1000m mar continuo simulacro · boya' : '2×500m + sighting drills'
            targetDurationMin = 75
          } else {
            targetDistanceKm = 0.8
            intensity = '4×100m técnica + sighting'
            targetDurationMin = 35
          }
          drill = SWIM_DRILLS[(w - 1) % SWIM_DRILLS.length]
          title = `Nado · ${targetDistanceKm.toFixed(2)}km`
          description = `${phase === 'peak' ? '🌊 MAR' : '🏊 Piscina'} · ${intensity}`
          break
      }

      // Race day override: 2026-09-27
      if (date === RACE) {
        type = 'brick'
        title = '🏁 ARTIEM HALF MENORCA · SHORT'
        description = '1km nado + 36km bici + 9km carrera. Ritmo objetivo: nado controlado, bici aero sostenido, carrera @5:30/km.'
        targetDistanceKm = 46
        intensity = 'COMPETICIÓN'
        isBrick = true
      }

      days.push({
        date, weekNumber: w, phase, type, title, description,
        targetDistanceKm, targetDurationMin, intensity, drill,
        isDeload, isBrick,
      })
    }
  }
  return days
}

// Rutina real de Alex (split P/P/L/T + Full Body). NOTA: crunch/sit-up retirados
// por flexión lumbar bajo carga (contraindicado, ver lesión).
const PUSH_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'push', order: 1, name: 'Press banca', series: 4, reps: '5-7', muscleGroups: ['pecho','triceps','hombro'], pesoUnidad: 'kg', active: true },
  { type: 'push', order: 2, name: 'Press inclinado mancuerna', series: 3, reps: '8-10', muscleGroups: ['pecho','hombro','triceps'], pesoUnidad: 'kg', active: true },
  { type: 'push', order: 3, name: 'Fondos paralelas', series: 4, reps: '6-8', muscleGroups: ['pecho','triceps','hombro'], pesoUnidad: 'bw', active: true },
  { type: 'push', order: 4, name: 'Cruce polea alta', series: 3, reps: '10-12', muscleGroups: ['pecho'], pesoUnidad: 'kg', active: true },
  { type: 'push', order: 5, name: 'Tríceps trasnuca', series: 3, reps: '8-10', muscleGroups: ['triceps'], pesoUnidad: 'kg', active: true },
  { type: 'push', order: 6, name: 'Elevaciones laterales', series: 4, reps: '12-15', muscleGroups: ['hombro'], pesoUnidad: 'kg', active: true },
]

const PULL_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'pull', order: 1, name: 'Dominada lastrada', series: 4, reps: '5-7', muscleGroups: ['espalda','biceps'], pesoUnidad: 'bw', active: true },
  { type: 'pull', order: 2, name: 'Remo máquina', series: 4, reps: '6-8', muscleGroups: ['espalda','biceps'], pesoUnidad: 'kg', active: true },
  { type: 'pull', order: 3, name: 'Pull over', series: 3, reps: '8-10', muscleGroups: ['espalda'], pesoUnidad: 'kg', active: true },
  { type: 'pull', order: 4, name: 'Curl bíceps martillo', series: 3, reps: '10-12', muscleGroups: ['biceps'], pesoUnidad: 'kg', active: true },
  { type: 'pull', order: 5, name: 'Curl bíceps polea', series: 3, reps: '8-10', muscleGroups: ['biceps'], pesoUnidad: 'kg', active: true },
  { type: 'pull', order: 6, name: 'Face pulls cuerda', series: 3, reps: '12-15', muscleGroups: ['espalda','hombro'], pesoUnidad: 'kg', active: true },
]

const LEGS_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'legs', order: 1, name: 'Sentadilla búlgara', series: 3, reps: '5-7', muscleGroups: ['cuadriceps','gluteo'], pesoUnidad: 'kg', active: true },
  { type: 'legs', order: 2, name: 'Peso muerto rumano', series: 4, reps: '6-8', notas: 'Lumbar neutra, bisagra de cadera', muscleGroups: ['isquios','gluteo'], pesoUnidad: 'kg', active: true },
  { type: 'legs', order: 3, name: 'Extensión cuádriceps', series: 3, reps: '10', muscleGroups: ['cuadriceps'], pesoUnidad: 'kg', active: true },
  { type: 'legs', order: 4, name: 'Abductores', series: 4, reps: '8/lado', muscleGroups: ['gluteo'], pesoUnidad: 'kg', active: true },
  { type: 'legs', order: 5, name: 'Elevación gemelo de pie', series: 4, reps: '12-15', muscleGroups: ['gemelo'], pesoUnidad: 'kg', active: true },
  { type: 'legs', order: 6, name: 'Plancha abs', series: 3, reps: '40"', muscleGroups: ['core'], pesoUnidad: 'bw', active: true },
]

const TORSO_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'torso', order: 1, name: 'Press inclinado mancuerna', series: 4, reps: '4-6', muscleGroups: ['pecho','hombro','triceps'], pesoUnidad: 'kg', active: true },
  { type: 'torso', order: 2, name: 'Remo bajo polea', series: 3, reps: '6-8', muscleGroups: ['espalda','biceps'], pesoUnidad: 'kg', active: true },
  { type: 'torso', order: 3, name: 'Cruce poleas tumbado', series: 3, reps: '6-8', muscleGroups: ['pecho'], pesoUnidad: 'kg', active: true },
  { type: 'torso', order: 4, name: 'Jalón al pecho', series: 3, reps: '6-8', muscleGroups: ['espalda','biceps'], pesoUnidad: 'kg', active: true },
  { type: 'torso', order: 5, name: 'Curl bíceps', series: 3, reps: '10', muscleGroups: ['biceps'], pesoUnidad: 'kg', active: true },
  { type: 'torso', order: 6, name: 'Extensión tríceps', series: 3, reps: '8-10', muscleGroups: ['triceps'], pesoUnidad: 'kg', active: true },
]

const FULLBODY_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'fullbody', order: 1, name: 'Sentadilla búlgara', series: 3, reps: '8/lado', muscleGroups: ['cuadriceps','gluteo'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 2, name: 'Remo mancuerna unilateral', series: 3, reps: '10/lado', muscleGroups: ['espalda'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 3, name: 'Hip thrust', series: 3, reps: '10', muscleGroups: ['gluteo','isquios'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 4, name: 'Press militar', series: 3, reps: '8', muscleGroups: ['hombro','triceps'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 5, name: 'Zancada caminando con peso', series: 3, reps: '12/lado', muscleGroups: ['cuadriceps','gluteo'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 6, name: 'Pallof press', series: 3, reps: '10/lado', muscleGroups: ['core'], pesoUnidad: 'kg', active: true },
  { type: 'fullbody', order: 7, name: 'Plancha brazos en movimiento', series: 3, reps: '30"', muscleGroups: ['core','hombro'], pesoUnidad: 'bw', active: true },
]

export async function seedIfEmpty() {
  await db.transaction('rw', [db.profile, db.exerciseTemplates, db.planDays, db.rehabExercises, db.schedule], async () => {
    const profile = await db.profile.get('me')
    if (!profile) {
      await db.profile.put({
        id: 'me',
        nombre: 'Alex López',
        pesoInicial: 91,
        altura: 180,
        edad: 21,
        objetivo: 'Entrenamiento personal + readaptación lumbar',
        inicioPlan: START,
        raceDate: RACE,
        caloriasObj: 2975,
        proteinaObj: 176,
        grasasObj: 88,
        carbosObj: 370,
      })
    }
    const tplCount = await db.exerciseTemplates.count()
    if (tplCount === 0) {
      await db.exerciseTemplates.bulkAdd([...PUSH_TEMPLATES, ...PULL_TEMPLATES, ...LEGS_TEMPLATES, ...TORSO_TEMPLATES, ...FULLBODY_TEMPLATES])
    }
    // Plan de 21 semanas de triatlón retirado (Fase A · entreno personal).
    // buildPlanDays() se conserva por compatibilidad pero ya NO se siembra.
    const rehabCount = await db.rehabExercises.count()
    if (rehabCount === 0) {
      await db.rehabExercises.bulkAdd(REHAB_LIBRARY)
    }
    const schedCount = await db.schedule.count()
    if (schedCount === 0) {
      // Lun Push · Mar Pull · Mié descanso · Jue Legs · Vie Torso · Sáb/Dom descanso
      await db.schedule.bulkAdd([
        { dow: 0, type: 'push' }, { dow: 1, type: 'pull' }, { dow: 2, type: 'rest' },
        { dow: 3, type: 'legs' }, { dow: 4, type: 'torso' }, { dow: 5, type: 'rest' }, { dow: 6, type: 'rest' },
      ])
    }
  })
}

export const PLAN_START = START
export const RACE_DATE = RACE
