// ─────────────────────────────────────────────────────────────────────────
// CONOCIMIENTO CLÍNICO — Abombamiento discal posterior multinivel L2-L3, L3-L4,
// L4-L5 (contenido). Codifica el informe diagnóstico de Alex para que la app
// pueda: avisar de contraindicaciones, recomendar ejercicios por dolor/fase, y
// gestionar la ventana de vulnerabilidad matutina.
//
// ⚠️ Esto NO sustituye criterio médico/fisio. Es una ayuda de decisión basada
//    en el informe del propio paciente.
// ─────────────────────────────────────────────────────────────────────────

import type { PainLocation, RehabExercise, RehabPhase, TimeOfDay } from '../db/schema'

export const PAIN_LOCATION_META: Record<PainLocation, { label: string; hint: string }> = {
  'L2-L3':     { label: 'L2-L3', hint: 'Segmento superior' },
  'L3-L4':     { label: 'L3-L4', hint: 'Segmento medio' },
  'L4-L5':     { label: 'L4-L5', hint: 'Segmento inferior (más cargado)' },
  'radicular': { label: 'Radicular', hint: 'Dolor que baja por la pierna · nervio' },
  'general':   { label: 'General', hint: 'Lumbar difuso, sin punto claro' },
}

export const TIME_OF_DAY_META: Record<TimeOfDay, { label: string; emoji: string }> = {
  wake:  { label: 'Al despertar', emoji: '🌅' },
  AM:    { label: 'Mañana',       emoji: '☀️' },
  PM:    { label: 'Tarde',        emoji: '🌆' },
  night: { label: 'Noche',        emoji: '🌙' },
}

// ── Ventana de vulnerabilidad matutina ──────────────────────────────────────
// El disco rehidratado de noche tolera ~18% menos carga en flexión al despertar.
// Prohibido cargar / flexionar tronco / impacto en los primeros 120 min de pie.
export const MORNING_WINDOW_MIN = 120

/** ¿Estamos dentro de la ventana matutina vulnerable?  wakeTime opcional (HH:mm). */
export function morningWindow(now = new Date(), wakeTimeHHmm?: string): { active: boolean; minsLeft: number } {
  let wake: Date
  if (wakeTimeHHmm && /^\d{1,2}:\d{2}$/.test(wakeTimeHHmm)) {
    const [h, m] = wakeTimeHHmm.split(':').map(Number)
    wake = new Date(now); wake.setHours(h, m, 0, 0)
  } else {
    // Heurística: si no hay hora de despertar, asumimos 07:30.
    wake = new Date(now); wake.setHours(7, 30, 0, 0)
  }
  const elapsedMin = (now.getTime() - wake.getTime()) / 60000
  if (elapsedMin < 0 || elapsedMin > MORNING_WINDOW_MIN) return { active: false, minsLeft: 0 }
  return { active: true, minsLeft: Math.round(MORNING_WINDOW_MIN - elapsedMin) }
}

// ── Contraindicaciones (movimientos prohibidos) ─────────────────────────────
// Detección por nombre de ejercicio. Cada patrón explica el riesgo concreto.
export interface Contraindication {
  match: RegExp
  label: string
  riesgo: string
  alternativa: string
}

export const CONTRAINDICATIONS: Contraindication[] = [
  {
    // OJO: no debe marcar "peso muerto rumano" / "Romanian Deadlift" (esos son la ALTERNATIVA segura)
    match: /peso\s*muerto(?!\s*rumano)|(conventional|convencional|sumo)\s*deadlift|deadlift\s*(convencional|conventional|sumo)/i,
    label: 'Peso muerto convencional',
    riesgo: 'Brazo de momento largo sobre L4-L5 + flexión bajo carga → cizallamiento posterior.',
    alternativa: 'Hip hinge con lumbar bloqueada (RDL ligero a rango corto) o hip thrust.',
  },
  {
    // No marcar las seguras: búlgara, frontal, goblet, a cajón, sissy, hack.
    match: /sentadilla(?!\s*(b[uú]lgara|frontal|goblet|caj[oó]n|sissy|hack|isom))|back\s*squat|squat\s*profund/i,
    label: 'Sentadilla trasera profunda',
    riesgo: 'A rango profundo: retroversión pélvica / butt wink → flexión lumbar comprimida.',
    alternativa: 'Sentadilla a cajón (rango parcial, neutra) o prensa horizontal controlada.',
  },
  {
    // Requiere "de piernas"/"leg press" — NO marcar "gemelo prensa" ni "press militar".
    match: /prensa\s*(de\s*)?piernas|leg\s*press|prensa\s*inclinada/i,
    label: 'Prensa de piernas profunda',
    riesgo: 'A rango profundo la pelvis se retroversiona contra el respaldo → aplasta L4-L5/L5-S1.',
    alternativa: 'Prensa con tope a rango parcial (sin perder contacto lumbar) o extensión de cuádriceps.',
  },
  {
    match: /good\s*morning|buenos\s*d[ií]as/i,
    label: 'Buenos días (good morning)',
    riesgo: 'Flexión de tronco con carga axial = vector de cizallamiento máximo.',
    alternativa: 'Pallof / anti-flexión isométrica para el mismo patrón sin riesgo.',
  },
  {
    match: /pascimott?ana?sana|pinza|estiramiento\s*isquio.*flexi|flexi[oó]n\s*profunda/i,
    label: 'Estiramiento en flexión profunda',
    riesgo: 'Isquios bloquean la pelvis y fuerzan flexión extrema de L2-L5 bajo tensión.',
    alternativa: 'Estiramiento de isquios tumbado con pierna recta y lumbar apoyada/neutra.',
  },
  {
    match: /sit[\s-]*up|crunch|abdominal(es)?\s*(cl[aá]sic|tradicional)|encogimiento/i,
    label: 'Sit-up / crunch clásico',
    riesgo: 'Flexión lumbar repetida bajo carga del propio tronco → estrés del anillo posterior.',
    alternativa: 'McGill Big 3 (curl-up modificado, side bridge, bird-dog) — core sin flexionar.',
  },
]

/** Devuelve la contraindicación que coincide con un nombre de ejercicio, o null. */
export function checkContraindication(exerciseName: string): Contraindication | null {
  if (!exerciseName) return null
  return CONTRAINDICATIONS.find(c => c.match.test(exerciseName)) ?? null
}

// ── Biblioteca de ejercicios de rehabilitación (seed) ───────────────────────
// Progresión: Fase 1 centralización (McKenzie) → Fase 2 estabilización isométrica
// (McGill) → Fase 3 integración dinámica anti-movimiento + hip hinge.
export const REHAB_LIBRARY: Omit<RehabExercise, 'id'>[] = [
  // ── FASE 1 · Control de síntomas / centralización ──
  {
    name: 'Extensión en prono (McKenzie)', phase: 1, category: 'mckenzie', painMax: 8,
    cues: 'Tumbado boca abajo, sube sobre antebrazos (esfinge) y progresa a empuje de brazos manteniendo cadera en el suelo. Respira, no aguantes.',
    why: 'Preferencia direccional en extensión: centraliza el dolor y descarga el anillo posterior.',
    sets: '10 reps lentas × 3-4 al día', active: true,
  },
  {
    name: 'Descompresión / decúbito con flexión de cadera 15-20°', phase: 1, category: 'descompresion', painMax: 10,
    cues: 'Tumbado boca arriba, almohada de 15-20° bajo las rodillas. Respiración diafragmática.',
    why: 'Presión intradiscal mínima (~0.09 MPa); optimiza difusión de nutrientes al disco.',
    sets: '5-10 min cuando haya dolor', active: true,
  },
  {
    name: 'Báscula pélvica suave (rango indoloro)', phase: 1, category: 'mckenzie', painMax: 5,
    cues: 'Movimiento mínimo de pelvis buscando la zona NEUTRA, no el rango máximo. Sin dolor.',
    why: 'Reeduca la posición neutra sin entrar en flexión cargada.',
    sets: '10 reps suaves', active: true,
  },

  // ── FASE 2 · Estabilización isométrica (McGill Big 3) ──
  {
    name: 'Curl-up modificado de McGill', phase: 2, category: 'mcgill', painMax: 4,
    cues: 'Una rodilla flexionada, otra estirada. Manos bajo la lumbar para mantener la curva. Sube solo la cabeza/hombros unos cm SIN aplanar la lumbar. Bracing 20-30%.',
    why: 'Activa recto/oblicuos sin flexionar la columna — core stiffness sin cizallamiento.',
    sets: 'Pirámide 6-4-2 isométrica (8-10s)', active: true,
  },
  {
    name: 'Side bridge / plancha lateral', phase: 2, category: 'mcgill', painMax: 4,
    cues: 'Apoyo en antebrazo y rodillas (progresa a pies). Cuerpo en línea, cadera arriba. No dejes caer la pelvis.',
    why: 'Cuadrado lumbar y oblicuos: estabilidad lateral con columna neutra, baja compresión.',
    sets: 'Pirámide 6-4-2 (8-10s/lado)', active: true,
  },
  {
    name: 'Bird-dog', phase: 2, category: 'mcgill', painMax: 4,
    cues: 'Cuadrupedia, columna neutra. Extiende brazo y pierna opuestos sin rotar la pelvis. Imagina un vaso de agua en la zona lumbar.',
    why: 'Multífidos y glúteo con anti-rotación; columna estática bajo carga contralateral.',
    sets: '3×8/lado, pausa 8s', active: true,
  },
  {
    name: 'Abdominal bracing (20-30% CVM)', phase: 2, category: 'core-neutro', painMax: 6,
    cues: 'Tensa el abdomen como si fueras a recibir un golpe, al 20-30% del máximo. Mantén respiración.',
    why: 'Rigidez de tronco frente al cizallamiento sin compresión axial innecesaria.',
    sets: 'Aprendizaje: 10×10s', active: true,
  },

  // ── FASE 3 · Integración dinámica / retorno al deporte ──
  {
    name: 'Pallof press (anti-rotación)', phase: 3, category: 'antirotacion', painMax: 3,
    cues: 'De pie, costado a la polea/goma. Empuja al frente resistiendo la rotación. Lumbar neutra y glúteos activos.',
    why: 'Entrena anti-rotación con columna bloqueada — patrón clave de retorno al deporte.',
    sets: '3×10/lado', active: true,
  },
  {
    name: 'Stir the pot (fitball)', phase: 3, category: 'antirotacion', painMax: 2,
    cues: 'Plancha con antebrazos sobre fitball; dibuja círculos pequeños con perturbación controlada. Tronco rígido.',
    why: 'Estabilidad dinámica con perturbaciones — anti-flexión/extensión/rotación a la vez.',
    sets: '3×8 círculos/sentido', active: true,
  },
  {
    name: 'Hip hinge con lumbar bloqueada', phase: 3, category: 'antirotacion', painMax: 3,
    cues: 'Bisagra de cadera (no flexión lumbar). Palo en la espalda tocando occipucio, dorsal y sacro: no debe despegarse. Carga ligera.',
    why: 'Reaprende el patrón de carga seguro que sustituye al peso muerto convencional.',
    sets: '3×8 con palo / carga ligera', active: true,
  },
  {
    name: 'Estiramiento de isquios con columna neutra', phase: 3, category: 'movilidad-cadera', painMax: 4,
    cues: 'Tumbado, una pierna recta hacia arriba con goma; lumbar pegada al suelo. NUNCA tirar en flexión de tronco.',
    why: 'Gana movilidad de cadena posterior sin bloquear la pelvis ni flexionar L2-L5.',
    sets: '3×30s/pierna', active: true,
  },
  {
    name: 'Movilidad de cadera (90/90, flexor)', phase: 3, category: 'movilidad-cadera', painMax: 4,
    cues: 'Trabaja rotación de cadera y estiramiento de psoas en zancada, manteniendo el tronco erguido y neutro.',
    why: 'Caderas móviles descargan la columna de compensar en flexión.',
    sets: '2×45s/lado', active: true,
  },
]

// ── Recomendador ────────────────────────────────────────────────────────────

/** Fase sugerida según el nivel de dolor actual (heurística clínica conservadora). */
export function suggestedPhase(painLevel: number): RehabPhase {
  if (painLevel >= 6) return 1   // dolor alto → centralizar
  if (painLevel >= 3) return 2   // moderado → estabilización isométrica
  return 3                       // bajo/sin dolor → integración dinámica
}

/**
 * Recomienda ejercicios de la biblioteca dado el dolor actual.
 * Filtra por painMax (no proponer lo que no toca con ese dolor) y prioriza la
 * fase sugerida, permitiendo también fases anteriores (siempre seguras).
 */
export function recommendRehab(painLevel: number, library: RehabExercise[]): RehabExercise[] {
  const phase = suggestedPhase(painLevel)
  return library
    .filter(e => e.active && painLevel <= e.painMax && e.phase <= phase)
    .sort((a, b) => b.phase - a.phase) // primero los de la fase más avanzada permitida
}

export const REHAB_PHASE_META: Record<RehabPhase, { label: string; desc: string; color: string }> = {
  1: { label: 'Fase 1 · Centralización', desc: 'Control de síntomas (McKenzie, descompresión)', color: '#EF4444' },
  2: { label: 'Fase 2 · Estabilización', desc: 'Core isométrico neutro (McGill Big 3)',        color: '#F59E0B' },
  3: { label: 'Fase 3 · Integración',    desc: 'Anti-movimiento dinámico + hip hinge',         color: '#22C55E' },
}

export const REHAB_CATEGORY_LABEL: Record<RehabExercise['category'], string> = {
  'mckenzie':        'McKenzie',
  'mcgill':          'McGill',
  'antirotacion':    'Anti-rotación',
  'movilidad-cadera':'Movilidad cadera',
  'descompresion':   'Descompresión',
  'core-neutro':     'Core neutro',
}
