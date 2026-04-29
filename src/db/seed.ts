import { db, type ExerciseTemplate, type PlanDay, type Phase, type WorkoutType } from './schema'

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

export function daysUntilRace(today = new Date()): number {
  const [ry, rm, rd] = RACE.split('-').map(Number)
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

const PUSH_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'push', order: 1, name: 'Press Banca', series: 5, reps: '7', rir: '3', pesoSugerido: 120, pesoUnidad: 'kg', muscleGroups: ['pecho','triceps','hombro'], active: true },
  { type: 'push', order: 2, name: 'Extensión Cuádriceps', series: 5, reps: '10-12', pesoUnidad: 'kg', muscleGroups: ['cuadriceps'], active: true },
  { type: 'push', order: 3, name: 'Cruce Poleas Desc. Tumbado', series: 4, reps: '10', pesoSugerido: 39, pesoUnidad: 'kg', muscleGroups: ['pecho'], active: true },
  { type: 'push', order: 4, name: 'Fondos Tríceps', series: 3, reps: '15', rir: '0', pesoUnidad: 'bw', notas: 'Lastrar día 5', muscleGroups: ['triceps','pecho'], active: true },
  { type: 'push', order: 5, name: 'Gemelo Prensa', series: 4, reps: '12', pesoUnidad: 'kg', muscleGroups: ['gemelo'], active: true },
  { type: 'push', order: 6, name: 'Elevaciones Laterales Mancuerna', series: 3, reps: '15', pesoSugerido: 10, pesoUnidad: 'kg', muscleGroups: ['hombro'], active: true },
]

const PULL_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'pull', order: 1, name: 'Remo Máquina', series: 4, reps: '7-8', pesoSugerido: 93, pesoUnidad: 'kg', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 2, name: 'Curl Bíceps Bilateral Polea', series: 3, reps: '8-11', pesoSugerido: 52, pesoUnidad: 'kg', muscleGroups: ['biceps'], active: true },
  { type: 'pull', order: 3, name: 'Dominadas / Jalón Pecho', series: 3, reps: '10', rir: '0', pesoUnidad: 'bw', muscleGroups: ['espalda','biceps'], active: true },
  { type: 'pull', order: 4, name: 'Romanian Deadlift', series: 4, reps: '8', pesoSugerido: 52, pesoUnidad: 'kg', notas: 'Reemplaza Buenos Días — mejor transferencia carrera', muscleGroups: ['isquios','gluteo','espalda'], active: true },
  { type: 'pull', order: 5, name: 'Abducción Glúteo', series: 4, reps: '12', pesoUnidad: 'kg', muscleGroups: ['gluteo'], active: true },
  { type: 'pull', order: 6, name: 'Curl Bayesian Polea Unilateral', series: 4, reps: '10', pesoSugerido: 20, pesoUnidad: 'kg', muscleGroups: ['biceps'], active: true },
]

const FULLBODY_TEMPLATES: Omit<ExerciseTemplate, 'id'>[] = [
  { type: 'fullbody', order: 1, name: 'Sentadilla Búlgara', series: 3, reps: '8/lado', notas: 'Fuerza unilateral bici/carrera', pesoUnidad: 'kg', muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'fullbody', order: 2, name: 'Remo Mancuerna Unilateral', series: 3, reps: '10/lado', notas: 'Espalda asimétrica = nado', pesoUnidad: 'kg', muscleGroups: ['espalda'], active: true },
  { type: 'fullbody', order: 3, name: 'Hip Thrust', series: 3, reps: '10', notas: 'Potencia glútea bici', pesoUnidad: 'kg', muscleGroups: ['gluteo','isquios'], active: true },
  { type: 'fullbody', order: 4, name: 'Press Militar', series: 3, reps: '8', notas: 'Hombro estable nado', pesoUnidad: 'kg', muscleGroups: ['hombro','triceps'], active: true },
  { type: 'fullbody', order: 5, name: 'Zancada Caminando con Peso', series: 3, reps: '12/lado', notas: 'Transferencia carrera', pesoUnidad: 'kg', muscleGroups: ['cuadriceps','gluteo'], active: true },
  { type: 'fullbody', order: 6, name: 'Pallof Press', series: 3, reps: '10/lado', notas: 'Core estabilizador triatlón', pesoUnidad: 'kg', muscleGroups: ['core'], active: true },
  { type: 'fullbody', order: 7, name: 'Plancha Brazos en Movimiento', series: 3, reps: '30"', notas: 'Estabilidad hombro nado', pesoUnidad: 'bw', muscleGroups: ['core','hombro'], active: true },
]

export async function seedIfEmpty() {
  await db.transaction('rw', db.profile, db.exerciseTemplates, db.planDays, async () => {
    const profile = await db.profile.get('me')
    if (!profile) {
      await db.profile.put({
        id: 'me',
        nombre: 'Alex López',
        pesoInicial: 91,
        altura: 180,
        edad: 20,
        objetivo: 'Triatlón Sprint Artiem Half Menorca · Híbrido fuerza + resistencia',
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
      await db.exerciseTemplates.bulkAdd([...PUSH_TEMPLATES, ...PULL_TEMPLATES, ...FULLBODY_TEMPLATES])
    }
    const planCount = await db.planDays.count()
    if (planCount === 0) {
      await db.planDays.bulkAdd(buildPlanDays())
    }
  })
}

export const PLAN_START = START
export const RACE_DATE = RACE
