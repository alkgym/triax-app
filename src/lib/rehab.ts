// ─────────────────────────────────────────────────────────────────────────
// CONOCIMIENTO CLÍNICO — dos documentos del propio paciente:
//  1) Informe: abombamiento discal posterior multinivel L2-L3, L3-L4, L4-L5.
//  2) Guía de readaptación progresiva 2026 (Rutina_Readaptacion_Alex_Lopez.pdf):
//     sacralización de L5, hiperlordosis adaptativa y bursa infrapatelar de la
//     rodilla DERECHA (rango seguro 0-60°, máx. 90° asistido).
//     ⛔ Prohíbe expresamente la hiperextensión lumbar (arquear hacia atrás).
// Codifica ambos para: avisar de contraindicaciones, recomendar ejercicios por
// dolor/fase y gestionar la ventana de vulnerabilidad matutina.
//
// ⚠️ Esto NO sustituye criterio médico/fisio. Es una ayuda de decisión basada
//    en los informes del propio paciente.
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

// Líneas rojas de la guía de readaptación 2026 — restricciones absolutas.
export const RED_LINES: { title: string; detail: string }[] = [
  {
    title: 'No hiperextender la lumbar',
    detail: 'Arquear la columna hacia atrás estrecha los recesos laterales de L3-L4 y L4-L5 y pinza las raíces nerviosas.',
  },
  {
    title: 'No hacer flexiones máximas pasivas',
    detail: 'Nada de tocar las puntas de los pies de pie: eleva la presión intradiscal posterior de forma crítica.',
  },
  {
    title: 'Cargas axiales/asimétricas: máx. 5-8 kg por brazo',
    detail: 'En la vida cotidiana. Flexión combinada con rotación del tronco: estrictamente contraindicada.',
  },
  {
    title: 'Rodilla derecha: flexión 0-60° bajo carga',
    detail: 'Máximo 90° asistido. Evitar la compresión patelofemoral sobre la bursa infrapatelar.',
  },
]

export const CONTRAINDICATIONS: Contraindication[] = [
  {
    // Guía 2026: hiperextensión lumbar prohibida (sacralización L5 + hiperlordosis).
    // No debe marcar "extensión de cuádriceps" (rodilla, segura).
    match: /hiperextensi[oó]n|superm[aá]n|extensi[oó]n\s+(lumbar|de\s+espalda|en\s+prono)|back\s*extension/i,
    label: 'Hiperextensión lumbar',
    riesgo: 'Arquear la columna estrecha los recesos laterales L3-L4/L4-L5 y pinza las raíces (guía 2026: línea roja).',
    alternativa: 'Core neutro: bracing abdominal activo, dead bug, puente de glúteo con retroversión.',
  },
  {
    // Guía 2026: rodilla derecha en rango 0-60° bajo carga (bursa infrapatelar).
    match: /zancada|lunge|b[uú]lgara|split\s*squat|pist[oó]l|sissy|sentadilla\s*profunda/i,
    label: 'Rodilla dcha: limita a 0-60°',
    riesgo: 'La flexión profunda de rodilla bajo carga comprime la bursa infrapatelar (rango seguro 0-60°, máx. 90° asistido).',
    alternativa: 'Recorta el rango a 0-60° o usa la sentadilla asistida con fitball en pared.',
  },
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

// ── Guía de readaptación progresiva 2026 (PDF del paciente) ────────────────
// Fase I (sem. 1-4): activación profunda + isometría · Fase II (sem. 5-8):
// elongación y descompresión · Fase III (sem. 9-12+): fuerza funcional 0-60°.
export const READAPTACION_2026: Omit<RehabExercise, 'id'>[] = [
  // ── FASE I · Activación profunda y estabilización isométrica ──
  {
    name: 'Bracing abdominal activo (faja estabilizadora)', phase: 1, category: 'core-neutro', painMax: 8,
    cues: 'Supino, rodillas a 90°, pies apoyados. Coactiva todo el abdomen como si fueran a golpearte, expandiendo hacia los lados sin meter barriga ni cortar la respiración. Lumbar sutilmente contra el suelo, sin forzar.',
    why: 'Genera la "faja anatómica" que fija el segmento hipermóvil L4-L5 sin carga axial.',
    sets: '3×10 · 6 s · diario', active: true,
  },
  {
    name: 'Dead bug estático modificado', phase: 1, category: 'core-neutro', painMax: 6,
    cues: 'Posición de mesa (rodillas 90°, brazos al techo) + bracing previo. Baja brazo y pierna contraria muy controlado con la lumbar inmóvil y pegada al suelo. Pierna derecha: rango corto si tensa la rótula.',
    why: 'Estabilidad anti-extensión con la columna fija — sin tracción rotuliana derecha.',
    sets: '3×6/lado · diario', active: true,
  },
  {
    name: 'Isometría de cuádriceps 0-10° (rodilla protegida)', phase: 1, category: 'rodilla', painMax: 8,
    cues: 'Toalla enrollada bajo la corva derecha. Presiona el rodillo hacia abajo activando el cuádriceps y eleva ligeramente el talón. Rango mínimo: los primeros 10° de extensión.',
    why: 'Activa el vasto medial oblicuo y estabiliza la rótula sin inflamar la bursa infrapatelar.',
    sets: '3×12 · 6 s · diario', active: true,
  },

  // ── FASE II · Elongación miofascial y descompresión lumbar ──
  {
    name: 'Apertura de cadena posterior en pared (RPG)', phase: 2, category: 'descompresion', painMax: 8,
    cues: 'Supino, piernas rectas apoyadas en la pared (~90°; aléjate si tiran los isquios). Brazos abiertos, palmas arriba. Respira con el diafragma y en cada exhalación relaja hombros manteniendo la columna alineada.',
    why: 'Alarga la cadena posterior y descarga la lumbar alta sin flexionar la columna.',
    sets: '10 min · 4×/semana', active: true,
  },
  {
    name: 'Estiramiento de isquios con cincha (supino)', phase: 2, category: 'movilidad-cadera', painMax: 6,
    cues: 'Supino, una pierna flexionada con pie apoyado; cincha en la planta del pie contrario. Eleva la pierna estirada tirando de la cincha. CRUCIAL: pelvis y sacro pegados al suelo.',
    why: 'Reduce la anteversión pélvica sin flexionar la columna lumbar.',
    sets: '3×30 s/pierna · diario', active: true,
  },
  {
    name: 'Estiramiento de flexores de cadera con retroversión', phase: 2, category: 'movilidad-cadera', painMax: 6,
    cues: 'Caballero sirviente con almohadilla gruesa bajo la rodilla derecha. Primero retroversión pélvica activa (aplana la lumbar) y solo entonces desplaza el peso adelante hasta notar el psoas. La lumbar nunca se arquea.',
    why: 'Alarga el psoas que tira de la pelvis a anteversión e hiperlordosis.',
    sets: '3×20 s/lado · diario', active: true,
  },

  // ── FASE III · Fuerza funcional e integración dinámica ──
  {
    name: 'Sentadilla asistida con fitball en pared (0-60°)', phase: 3, category: 'rodilla', painMax: 3,
    cues: 'Fitball entre la lumbar y la pared, pies al ancho de hombros y ligeramente adelantados. Desciende vertical dejando rodar el balón. Baja SOLO hasta 60° de flexión de rodilla (nunca pases de 90°).',
    why: 'Elimina la carga axial sobre los discos y protege bursa infrapatelar y menisco interno derecho.',
    sets: '3×10-12 · 3×/semana', active: true,
  },
  {
    name: 'Puente de glúteo isométrico con retroversión activa', phase: 3, category: 'core-neutro', painMax: 5,
    cues: 'Supino, rodillas flexionadas. Antes de despegar: bracing y lumbar plana contra el suelo. Empuja con los talones hasta alinear rodillas-cadera-hombros y aprieta fuerte los glúteos arriba.',
    why: 'Bloquea la hiperlordosis y equilibra la musculatura lumbopélvica.',
    sets: '3×8 · 8 s arriba · 3×/semana', active: true,
  },
]

// ── Biblioteca de ejercicios de rehabilitación (seed) ───────────────────────
// Progresión: Fase 1 centralización → Fase 2 estabilización isométrica
// (McGill) → Fase 3 integración dinámica anti-movimiento + hip hinge.
// Incluye la guía de readaptación 2026 completa (arriba).
export const REHAB_LIBRARY: Omit<RehabExercise, 'id'>[] = [
  ...READAPTACION_2026,
  // ── FASE 1 · Control de síntomas / centralización ──
  {
    // ⛔ DESACTIVADO por la guía 2026: la hiperextensión lumbar es línea roja
    //    con sacralización L5 + hiperlordosis (estrecha los recesos L3-L5).
    name: 'Extensión en prono (McKenzie)', phase: 1, category: 'mckenzie', painMax: 8,
    cues: 'Tumbado boca abajo, sube sobre antebrazos (esfinge) y progresa a empuje de brazos manteniendo cadera en el suelo. Respira, no aguantes.',
    why: 'Preferencia direccional en extensión: centraliza el dolor y descarga el anillo posterior.',
    sets: '10 reps lentas × 3-4 al día', active: false,
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
  1: { label: 'Fase 1 · Activación',     desc: 'Control de síntomas · core profundo isométrico', color: '#EF4444' },
  2: { label: 'Fase 2 · Estabilización', desc: 'McGill + elongación y descompresión',            color: '#F59E0B' },
  3: { label: 'Fase 3 · Integración',    desc: 'Fuerza funcional en rangos protegidos',          color: '#22C55E' },
}

export const REHAB_CATEGORY_LABEL: Record<RehabExercise['category'], string> = {
  'mckenzie':        'McKenzie',
  'mcgill':          'McGill',
  'antirotacion':    'Anti-rotación',
  'movilidad-cadera':'Movilidad cadera',
  'descompresion':   'Descompresión',
  'core-neutro':     'Core neutro',
  'rodilla':         'Rodilla',
}
