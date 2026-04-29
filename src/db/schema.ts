import Dexie, { type Table } from 'dexie'

export type WorkoutType = 'push' | 'pull' | 'fullbody' | 'swim' | 'bike' | 'run' | 'brick' | 'rest'

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
  weekNumber: number        // 1..21
  phase: Phase
  type: WorkoutType
  title: string
  description: string       // free-text editable
  targetDistanceKm?: number
  targetDurationMin?: number
  intensity?: string        // "Z2", "Z3-4", "tempo", "intervals"
  drill?: string            // for swim
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
}

export interface SetLog {
  id?: number
  sessionId: number
  exercise: string
  exerciseOrder: number
  setNumber: number
  reps?: number
  weight?: number
  rir?: number
  completed: boolean
  notes?: string
}

export interface BodyMetric {
  id?: number
  date: string
  weight?: number
  bodyFat?: number
  notes?: string
}

export interface PersonalRecord {
  id?: number
  exercise: string
  weight: number
  reps: number
  date: string
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
  }
}

export const db = new TriDB()
