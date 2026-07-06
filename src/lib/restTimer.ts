// Temporizador de descanso — bus mínimo para arrancarlo desde cualquier sitio
// (completar una serie, botón manual) y que lo pinte un único componente
// flotante. Sin estado global de React: un emitter y localStorage para el
// descanso preferido.

const KEY_TARGET = 'triax.rest.targetSec'
const DEFAULT_SEC = 90
const MIN_SEC = 15
const MAX_SEC = 600

export interface RestState {
  running: boolean
  endsAt: number      // epoch ms
  targetSec: number
}

type Listener = (s: RestState | null) => void
const listeners = new Set<Listener>()
let current: RestState | null = null

export function restTargetSec(): number {
  const v = Number(localStorage.getItem(KEY_TARGET) || '0')
  return v >= MIN_SEC && v <= MAX_SEC ? v : DEFAULT_SEC
}

export function setRestTargetSec(sec: number) {
  const v = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(sec)))
  try { localStorage.setItem(KEY_TARGET, String(v)) } catch { /* quota */ }
}

function emit() { for (const l of listeners) l(current) }

/** Arranca (o reinicia) el descanso. Sin argumento usa el preferido. */
export function startRest(sec = restTargetSec()) {
  current = { running: true, endsAt: Date.now() + sec * 1000, targetSec: sec }
  emit()
}

/** Suma segundos al descanso en curso (y recuerda el nuevo objetivo). */
export function adjustRest(deltaSec: number) {
  if (!current) return
  const remaining = Math.max(0, current.endsAt - Date.now()) / 1000
  const next = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(remaining + deltaSec)))
  current = { ...current, endsAt: Date.now() + next * 1000, targetSec: current.targetSec + deltaSec }
  setRestTargetSec(current.targetSec)
  emit()
}

export function stopRest() {
  current = null
  emit()
}

export function subscribeRest(fn: Listener): () => void {
  listeners.add(fn)
  fn(current)
  return () => { listeners.delete(fn) }
}
