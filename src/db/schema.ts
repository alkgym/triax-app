import Dexie, { type Table } from 'dexie'
// Solo datos (rehab.ts importa únicamente tipos de este módulo → sin ciclo runtime)
import { READAPTACION_2026 } from '../lib/rehab'

export type WorkoutType =
  | 'push' | 'pull' | 'fullbody' | 'legs' | 'torso'
  | 'swim' | 'bike' | 'run' | 'brick' | 'rest'
  | 'bike_indoor' | 'swim_pool' | 'gym_free'

export type Phase = 'base' | 'build' | 'peak' | 'taper'

export interface Profile {
  id: 'me'
  nombre: string
  pesoInicial: number
  altura: number
  edad: number
  objetivo: string
  inicioPlan: string // ISO date
  raceDate: string  // ISO date — 2026-09-27
  caloriasObj: number
  proteinaObj: number
  grasasObj: number
  carbosObj: number
}

export type MuscleGroup = 'pecho' | 'espalda' | 'hombro' | 'biceps' | 'triceps' | 'cuadriceps' | 'isquios' | 'gluteo' | 'gemelo' | 'core'

export interface ExerciseTemplate {
  id?: number
  type: WorkoutType         // push | pull | fullbody
  order: number
  name: string
  series: number
  reps: string              // "7", "8-11", "15"
  rir?: string
  pesoSugerido?: number
  pesoUnidad?: 'kg' | 'bw'
  notas?: string
  muscleGroups?: MuscleGroup[]
  active: boolean
}

export interface NutritionEntry {
  id?: number
  date: string
  meal: 'desayuno' | 'comida' | 'merienda' | 'cena' | 'snack'
  description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  timestamp: number
}

export interface GearItem {
  id?: number
  category: 'bici' | 'zapatillas' | 'natacion' | 'wearables' | 'otro'
  name: string
  notes?: string
  bought?: string
  km?: number
  active: boolean
}

export interface PlanDay {
  id?: number
  date: string              // ISO yyyy-mm-dd
  slot?: number             // 0 = primary, 1 = secondary (double session), etc.
  weekNumber: number        // 1..21
  phase: Phase
  type: WorkoutType
  title: string
  description: string       // free-text editable
  targetDistanceKm?: number
  targetDurationMin?: number
  intensity?: string        // "Z2", "Z3-4", "tempo", "intervals"
  drill?: string            // for swim
  timeOfDay?: 'AM' | 'PM'   // hint for double-session ordering display
  isDeload?: boolean
  isBrick?: boolean
}

export interface WorkoutSession {
  id?: number
  date: string
  type: WorkoutType
  startedAt?: number
  completedAt?: number
  notes: string
  // discipline metrics (for swim/bike/run/brick)
  distanceKm?: number
  durationMin?: number
  avgHR?: number
  rpe?: number              // 1-10 perceived effort
  avgPaceSecPerKm?: number  // for run/bike: seconds per km
  avgPaceSec100m?: number   // for swim: seconds per 100m
  cadence?: number          // rpm (bike) or spm (run)
  elevationM?: number       // metres gained
  // extra (unplanned) sessions
  isExtra?: boolean
  extraTitle?: string       // custom label for extra sessions
  // ── lesión lumbar ──
  painProvoked?: number     // 0-10 dolor lumbar provocado por esta sesión
  painLocations?: PainLocation[]
}

export interface SetLog {
  id?: number
  uuid?: string             // stable client UUID — identifies the row across reorderings/renames
  sessionId: number
  templateId?: number       // reference to ExerciseTemplate.id (when known) — survives renames
  exercise: string          // denormalised name (kept in sync via cascade)
  exerciseOrder: number     // denormalised order (kept in sync)
  setNumber: number
  reps?: number
  weight?: number
  rir?: number
  completed: boolean
  notes?: string
  painProvoked?: number     // 0-10 dolor lumbar provocado por este ejercicio/serie
}

export interface BodyMetric {
  id?: number
  date: string
  weight?: number
  bodyFat?: number
  notes?: string
}

// Tensión arterial (manual o leída por BLE del tensiómetro)
export interface BpLog {
  id?: number
  date: string              // ISO yyyy-mm-dd
  timestamp: number
  sys: number               // sistólica mmHg
  dia: number               // diastólica mmHg
  pulse?: number            // pulso lpm
  source: 'manual' | 'ble-estandar' | 'ble-checkme'
  notes?: string
}

export interface PersonalRecord {
  id?: number
  exercise: string
  weight: number
  reps: number
  date: string
}

// ─────────────────────────────────────────────────────────────
// LESIÓN LUMBAR — abombamiento discal L2-L5 (ver memoria clínica)
// ─────────────────────────────────────────────────────────────

export type PainLocation = 'L2-L3' | 'L3-L4' | 'L4-L5' | 'radicular' | 'general'

export type TimeOfDay = 'wake' | 'AM' | 'PM' | 'night'  // wake = recién despertado (ventana vulnerable)

// Qué provocó / contexto del registro de dolor
export type PainContext =
  | 'reposo' | 'manana' | 'tras-gym' | 'tras-correr' | 'tras-bici'
  | 'tras-nadar' | 'tras-futbol' | 'tras-sentarse' | 'tras-dormir' | 'otro'

export interface PainLog {
  id?: number
  date: string                 // ISO yyyy-mm-dd
  timeOfDay: TimeOfDay
  level: number                // 0 (sin dolor) … 10 (máximo)
  locations: PainLocation[]
  context: PainContext
  trigger?: string             // texto libre: qué crees que lo provocó
  notes?: string
  // check-in del día siguiente: enlaza con la actividad del día previo
  nextDayOf?: string           // ISO de la actividad que evalúas (p.ej. fútbol de ayer)
  timestamp: number
}

// Horario semanal: qué rutina toca cada día (dow 0=lunes … 6=domingo)
export interface DaySchedule {
  dow: number               // 0=Lun, 1=Mar, 2=Mié, 3=Jue, 4=Vie, 5=Sáb, 6=Dom
  type: WorkoutType         // gym type | 'rest'
}

export type RehabPhase = 1 | 2 | 3   // 1 activación/estabilización · 2 elongación/descompresión · 3 integración dinámica
export type RehabCategory = 'mckenzie' | 'mcgill' | 'antirotacion' | 'movilidad-cadera' | 'descompresion' | 'core-neutro' | 'rodilla'

export interface RehabExercise {
  id?: number
  name: string
  phase: RehabPhase
  category: RehabCategory
  cues: string                 // ejecución / claves de seguridad
  why: string                  // por qué ayuda según el diagnóstico
  painMax: number              // dolor máx (0-10) hasta el que es apropiado
  sets?: string                // dosis sugerida
  active: boolean
}

export class TriDB extends Dexie {
  profile!: Table<Profile, string>
  exerciseTemplates!: Table<ExerciseTemplate, number>
  planDays!: Table<PlanDay, number>
  sessions!: Table<WorkoutSession, number>
  sets!: Table<SetLog, number>
  bodyMetrics!: Table<BodyMetric, number>
  prs!: Table<PersonalRecord, number>
  nutrition!: Table<NutritionEntry, number>
  gear!: Table<GearItem, number>
  painLogs!: Table<PainLog, number>
  rehabExercises!: Table<RehabExercise, number>
  schedule!: Table<DaySchedule, number>
  bpLogs!: Table<BpLog, number>

  constructor() {
    super('TriAxApp')
    this.version(1).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, &date, weekNumber, phase, type',
      sessions: '++id, &date, type, completedAt',
      sets: '++id, sessionId, exercise, exerciseOrder, setNumber',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
    })
    this.version(2).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, &date, weekNumber, phase, type',
      sessions: '++id, &date, type, completedAt',
      sets: '++id, sessionId, exercise, exerciseOrder, setNumber',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
    })
    // v3: remove unique constraint on sessions.date → allow multiple sessions per day (extras)
    this.version(3).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, &date, weekNumber, phase, type',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, sessionId, exercise, exerciseOrder, setNumber',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
    })

    // v5 will be defined below — multi-session days. First, the existing v4:
    // v4: tracker integrity — add stable uuid + templateId to sets.
    //   • All future writes go through transactions; uuid is the canonical key.
    //   • Backfill uuid for existing rows; backfill templateId by joining on (sessionType, order, name).
    this.version(4).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, &date, weekNumber, phase, type',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
    }).upgrade(async tx => {
      const sessionsTable = tx.table('sessions')
      const tplTable = tx.table('exerciseTemplates')
      const setsTable = tx.table('sets')

      const [allSessions, allTemplates] = await Promise.all([
        sessionsTable.toArray(),
        tplTable.toArray(),
      ])
      const sessionType = new Map<number, string>(allSessions.map((s: any) => [s.id, s.type]))

      const ensureUuid = (() => {
        if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return () => (crypto as any).randomUUID() as string
        return () => 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      })()

      await setsTable.toCollection().modify((s: any) => {
        if (!s.uuid) s.uuid = ensureUuid()
        if (s.templateId == null) {
          const sessType = sessionType.get(s.sessionId)
          if (sessType) {
            const tpl = allTemplates.find((t: any) =>
              t.type === sessType && t.order === s.exerciseOrder && t.name === s.exercise)
            if (tpl?.id != null) s.templateId = tpl.id
          }
        }
      })
    })

    // v5: multi-session days — drop unique constraint on planDays.date, add `slot` field.
    //   • slot=0 is the primary session of the day. slot=1+ are secondary planned sessions.
    //   • Compound index [date+slot] lets us fetch all sessions for a date in order.
    //   • Backfill: every existing PlanDay gets slot=0.
    this.version(5).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, date, slot, weekNumber, phase, type, [date+slot]',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
    }).upgrade(async tx => {
      await tx.table('planDays').toCollection().modify((p: any) => {
        if (p.slot == null) p.slot = 0
      })
    })

    // v6: módulo de lesión lumbar — registro de dolor + biblioteca de ejercicios de rehab.
    //   • painLogs: serie temporal de dolor (nivel, ubicación, contexto, check-in día siguiente).
    //   • rehabExercises: biblioteca clínica (fase, categoría, contraindicaciones implícitas).
    this.version(6).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, date, slot, weekNumber, phase, type, [date+slot]',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
      painLogs: '++id, date, timeOfDay, level, context, [date+timeOfDay]',
      rehabExercises: '++id, phase, category, active',
    })

    // v7: horario semanal (día → rutina). Conduce el volumen semanal por grupo
    // y la sugerencia "hoy toca X".
    this.version(7).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, date, slot, weekNumber, phase, type, [date+slot]',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
      painLogs: '++id, date, timeOfDay, level, context, [date+timeOfDay]',
      rehabExercises: '++id, phase, category, active',
      schedule: 'dow',
    })

    // v8: guía de readaptación 2026 (sacralización L5 + hiperlordosis + rodilla dcha).
    //   • Añade a instalaciones existentes los ejercicios del plan que falten (por nombre).
    //   • Desactiva —sin borrar— la extensión en prono (McKenzie): la guía prohíbe
    //     expresamente las hiperextensiones lumbares.
    this.version(8).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, date, slot, weekNumber, phase, type, [date+slot]',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
      painLogs: '++id, date, timeOfDay, level, context, [date+timeOfDay]',
      rehabExercises: '++id, phase, category, active',
      schedule: 'dow',
    }).upgrade(async tx => {
      const tbl = tx.table('rehabExercises')
      const all = await tbl.toArray()
      const names = new Set(all.map((e: any) => e.name))
      for (const e of all) {
        if (/extensi[oó]n en prono/i.test(e.name) && e.active) {
          await tbl.update(e.id, { active: false })
        }
      }
      const missing = READAPTACION_2026.filter(e => !names.has(e.name))
      if (missing.length > 0) await tbl.bulkAdd(missing as any[])
    })

    // v9: tensión arterial (tensiómetro Checkme por BLE + registro manual).
    this.version(9).stores({
      profile: 'id',
      exerciseTemplates: '++id, type, order, active',
      planDays: '++id, date, slot, weekNumber, phase, type, [date+slot]',
      sessions: '++id, date, type, completedAt, isExtra',
      sets: '++id, &uuid, sessionId, templateId, exercise, exerciseOrder, setNumber, [sessionId+templateId+setNumber]',
      bodyMetrics: '++id, date',
      prs: '++id, exercise, date',
      nutrition: '++id, date, meal',
      gear: '++id, category, active',
      painLogs: '++id, date, timeOfDay, level, context, [date+timeOfDay]',
      rehabExercises: '++id, phase, category, active',
      schedule: 'dow',
      bpLogs: '++id, date, timestamp',
    })
  }
}

export const db = new TriDB()

// ── Rastreador de cambios para la sincronización ────────────────────────────
// El middleware DBCore debe registrarse ANTES de abrir la BD para que envuelva
// las mutaciones (registrarlo después de abrir no hace nada — ese fue el bug
// que congeló el auto-sync en junio de 2026). El callback se conecta más tarde
// (lib/sync.installSyncTracker), así el sembrado inicial no cuenta como cambio.
let dirtyHook: (() => void) | null = null
export function setDirtyHook(fn: (() => void) | null) { dirtyHook = fn }

db.use({
  stack: 'dbcore',
  name: 'triax-sync-dirty',
  create(down) {
    return {
      ...down,
      table(name) {
        const table = down.table(name)
        return {
          ...table,
          mutate: async (req) => {
            const res = await table.mutate(req)
            dirtyHook?.()
            return res
          },
        }
      },
    }
  },
})
