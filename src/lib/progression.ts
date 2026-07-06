// Progresión de fuerza — e1RM (Epley) + coach de doble progresión.
// Funciones puras: nada de DB aquí; la UI decide qué mostrar y qué aplicar.

export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Mejor e1RM de un conjunto de series (solo completadas con peso y reps). */
export function bestE1RM(sets: { reps?: number; weight?: number; completed?: boolean }[]): number {
  return sets.reduce((m, s) => {
    if (!s.completed || s.weight == null || s.reps == null) return m
    return Math.max(m, epley1RM(s.weight, s.reps))
  }, 0)
}

export interface RepTarget {
  min: number
  max: number
  perSide: boolean
  timeBased: boolean   // "40s", "40s/lado" — sin sugerencia de peso
}

// Formatos reales de las plantillas: "8", "8-11", "10/lado", "40s", "40s/lado"
export function parseRepTarget(reps: string): RepTarget | null {
  const s = reps.trim().toLowerCase()
  const perSide = s.includes('/lado')
  const core = s.replace('/lado', '').trim()
  if (/^\d+\s*s$/.test(core)) return { min: 0, max: 0, perSide, timeBased: true }
  const range = core.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (range) return { min: +range[1], max: +range[2], perSide, timeBased: false }
  const single = core.match(/^(\d+)$/)
  if (single) return { min: +single[1], max: +single[1], perSide, timeBased: false }
  return null
}

export type ProgressionKind = 'add-weight' | 'add-reps' | 'consolidate'

export interface ProgressionSuggestion {
  kind: ProgressionKind
  weight?: number      // peso de trabajo sugerido para hoy (kg)
  label: string        // texto corto del chip
  detail: string       // explicación de una línea
}

/** Salto de peso razonable según la carga actual (discos/mancuernas típicos). */
export function weightIncrement(weight: number): number {
  return weight >= 20 ? 2.5 : 1.25
}

/**
 * Doble progresión clásica:
 *  · todas las series planificadas al tope del rango → sube peso
 *  · alguna serie por debajo del mínimo → consolida el peso actual
 *  · en rango pero sin llegar al tope → mismo peso, busca más reps
 */
export function suggestProgression(opts: {
  target: RepTarget | null
  series: number
  lastSets: { reps?: number; weight?: number; completed?: boolean }[]
  bodyweight: boolean
}): ProgressionSuggestion | null {
  const { target, series, lastSets, bodyweight } = opts
  if (!target || target.timeBased) return null

  const done = lastSets.filter(s => s.completed && s.reps != null)
  if (done.length === 0) return null

  const allAtTop = done.every(s => (s.reps ?? 0) >= target.max)
  const anyBelowMin = done.some(s => (s.reps ?? 0) < target.min)
  const allPlannedDone = done.length >= series
  const weights = done.filter(s => s.weight != null && s.weight > 0).map(s => s.weight!)
  const lastWeight = weights.length ? Math.max(...weights) : undefined

  // Peso corporal (o sin peso registrado): solo se progresa por reps
  if (bodyweight || lastWeight == null) {
    if (allPlannedDone && allAtTop) {
      return {
        kind: 'add-reps',
        label: `Supera ${target.max} reps`,
        detail: `Última vez llegaste al tope (${target.max}) en todas las series. Suma reps o añade lastre.`,
      }
    }
    return null
  }

  if (allPlannedDone && allAtTop) {
    const w = Math.round((lastWeight + weightIncrement(lastWeight)) * 100) / 100
    return {
      kind: 'add-weight',
      weight: w,
      label: `Sube a ${w} kg`,
      detail: `Completaste ${done.length} series a ${target.max}+ reps con ${lastWeight} kg. Toca subir.`,
    }
  }
  if (anyBelowMin) {
    return {
      kind: 'consolidate',
      weight: lastWeight,
      label: `Mantén ${lastWeight} kg`,
      detail: `Alguna serie bajó de ${target.min} reps. Consolida el peso antes de subir.`,
    }
  }
  return {
    kind: 'add-reps',
    weight: lastWeight,
    label: `${lastWeight} kg · busca ${target.max}`,
    detail: `Mismo peso: acércate a ${target.max} reps en todas las series.`,
  }
}
