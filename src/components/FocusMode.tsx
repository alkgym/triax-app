// Modo Enfoque — fullscreen UI for gym sessions.
//
// Cursor invariant: we track the CURRENT SET BY uuid, never by array index.
//   • If the underlying set list grows / shrinks (extra sets added, ones deleted)
//     the cursor still references the same physical set. No cross-contamination.
//   • If the cursor's set disappears (rare — only via explicit delete) we fall back
//     to the first incomplete set, then to the last set.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SetLog } from '../db/schema'
import { vibrate } from '../db/hooks'
import { todayIso } from '../lib/dates'
import { epley1RM, setE1RM, parseRepTarget, suggestProgression } from '../lib/progression'
import { restTargetSec, setRestTargetSec } from '../lib/restTimer'
import type { ExerciseBlock, WorkoutSessionState } from '../hooks/useWorkoutSession'

interface Props {
  state: WorkoutSessionState
  accentColor: string
  onClose: () => void
}

// Referencia de la última sesión para un ejercicio (versión ligera del cálculo
// de ExerciseCard): series de la última vez + mejor e1RM histórico.
function usePreviousForBlock(block: ExerciseBlock | null, date: string) {
  return useLiveQuery(async () => {
    if (!block) return null
    const byTpl = block.templateId != null
      ? await db.sets.where('templateId').equals(block.templateId).toArray()
      : []
    const byName = await db.sets.where('exercise').equals(block.name).toArray()
    const past = [...byTpl, ...byName.filter(b => !byTpl.some(t => t.id === b.id))]
    if (past.length === 0) return null
    const sessIds = Array.from(new Set(past.map(s => s.sessionId)))
    const sessions = await db.sessions.where('id').anyOf(sessIds).filter(s => !s.isExtra).toArray()
    const earlier = sessions.filter(s => s.date < date).sort((a, b) => b.date.localeCompare(a.date))
    if (earlier.length === 0) return null
    const earlierIds = new Set(earlier.map(s => s.id))
    const bestE1 = past.filter(s => earlierIds.has(s.sessionId)).reduce((m, s) => Math.max(m, setE1RM(s) ?? 0), 0)
    const lastSets = past.filter(s => s.sessionId === earlier[0].id).sort((a, b) => a.setNumber - b.setNumber)
    return { lastSets, bestE1: bestE1 > 0 ? bestE1 : null, lastDate: earlier[0].date }
  }, [block?.templateId, block?.name, date])
}

export function FocusMode({ state, accentColor, onClose }: Props) {
  const { blocks, flatSets, updateSet } = state

  // ── Cursor by uuid ─────────────────────────────────────────────────────────
  const initialUuid = useMemo(
    () => flatSets.find(s => !s.completed)?.uuid ?? flatSets[0]?.uuid ?? null,
    // only on mount — don't reset when the user advances
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [currentUuid, setCurrentUuid] = useState<string | null>(initialUuid ?? null)
  // Petición de relleno de inputs desde fuera del editor (anterior / coach)
  const [fill, setFill] = useState<{ w?: number; r?: number; n: number }>({ n: 0 })

  // If the cursor's set disappeared (deleted externally), fall back gracefully.
  useEffect(() => {
    if (currentUuid && flatSets.some(s => s.uuid === currentUuid)) return
    const fallback = flatSets.find(s => !s.completed)?.uuid ?? flatSets[flatSets.length - 1]?.uuid ?? null
    setCurrentUuid(fallback)
  }, [flatSets, currentUuid])

  const currentIndex = currentUuid ? flatSets.findIndex(s => s.uuid === currentUuid) : -1
  const current = currentIndex >= 0 ? flatSets[currentIndex] : flatSets[0]
  const block = current ? blocks.find(b => b.setRows.some(s => s.uuid === current.uuid)) ?? null : null
  const setNumberInBlock = block ? block.setRows.findIndex(s => s.uuid === current.uuid) + 1 : 0

  const date = state.session?.date ?? todayIso()
  const previous = usePreviousForBlock(block, date)
  const prevSet = previous?.lastSets.find(p => p.setNumber === setNumberInBlock)

  const suggestion = useMemo(() => {
    if (!block || !previous) return null
    return suggestProgression({
      target: parseRepTarget(block.reps),
      series: block.series,
      lastSets: previous.lastSets,
      bodyweight: block.pesoUnidad === 'bw',
    })
  }, [block, previous])

  if (flatSets.length === 0 || !current || !block) {
    return (
      <FocusShell onClose={onClose} idx={0} total={0}>
        <div className="text-center" style={{ color: 'var(--text-3)' }}>No hay series para hoy.</div>
      </FocusShell>
    )
  }

  function gotoUuid(uuid: string) {
    if (!flatSets.some(s => s.uuid === uuid)) return
    setCurrentUuid(uuid)
    vibrate(8)
  }

  function gotoOffset(delta: -1 | 1) {
    const i = currentIndex + delta
    if (i < 0 || i >= flatSets.length) return
    gotoUuid(flatSets[i].uuid!)
  }

  // Salta a un ejercicio: su primera serie sin completar, o la primera.
  function gotoBlock(b: ExerciseBlock) {
    const target = b.setRows.find(s => !s.completed) ?? b.setRows[0]
    if (target?.uuid) gotoUuid(target.uuid)
  }

  function advanceAfterCompletion() {
    // Find next incomplete AFTER current position; fallback to first incomplete anywhere.
    const after = flatSets.find((s, i) => i > currentIndex && !s.completed)
    if (after?.uuid) { setCurrentUuid(after.uuid); return }
    const anyIncomplete = flatSets.find(s => !s.completed)
    if (anyIncomplete?.uuid) setCurrentUuid(anyIncomplete.uuid)
  }

  return (
    <FocusShell onClose={onClose} idx={Math.max(0, currentIndex)} total={flatSets.length}>
      {/* Slider de ejercicios: salto directo y progreso por ejercicio */}
      <ExerciseSlider blocks={blocks} currentBlock={block} accentColor={accentColor} onJump={gotoBlock} />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.uuid /* stable per-set re-mount → fresh editor state */}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          drag="x"
          dragSnapToOrigin
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 && Math.abs(info.offset.y) < 60) gotoOffset(1)
            else if (info.offset.x > 70 && Math.abs(info.offset.y) < 60) gotoOffset(-1)
          }}
          className="space-y-5 mt-5"
        >
          <BlockHeader block={block} />

          <SetIndicator block={block} currentSetNumber={setNumberInBlock} accentColor={accentColor} onJump={gotoUuid} />

          {/* Coach de progresión — tocar aplica el peso sugerido a esta serie */}
          {suggestion && !current.completed && (
            <button
              onClick={() => {
                if (suggestion.weight != null) setFill(f => ({ w: suggestion.weight, n: f.n + 1 }))
                vibrate(12)
              }}
              className="w-full rounded-xl px-3 py-2 text-left"
              style={{
                background: suggestion.kind === 'add-weight' ? 'rgba(34,197,94,.07)' : 'var(--surface-1)',
                border: `1px solid ${suggestion.kind === 'add-weight' ? 'rgba(34,197,94,.35)' : 'var(--border-strong)'}`,
              }}>
              <span className="text-[12px] font-semibold"
                style={{ color: suggestion.kind === 'add-weight' ? 'var(--green)' : suggestion.kind === 'consolidate' ? '#F59E0B' : accentColor }}>
                {suggestion.kind === 'add-weight' ? '↗ ' : suggestion.kind === 'consolidate' ? '◼ ' : '→ '}{suggestion.label}
              </span>
              {suggestion.weight != null && (
                <span className="text-[11px] ml-2" style={{ color: 'var(--text-3)' }}>tocar para usar</span>
              )}
            </button>
          )}

          <SetEditor
            key={current.uuid}
            setRow={current}
            prevSet={prevSet}
            prevDate={previous?.lastDate}
            bestE1={previous?.bestE1 ?? null}
            fill={fill}
            updateSet={updateSet}
            onCompleted={advanceAfterCompletion}
            accentColor={accentColor}
          />
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 mt-8">
        <button onClick={() => gotoOffset(-1)} disabled={currentIndex === 0}
          className="btn flex-1" style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}>← Anterior</button>
        <button onClick={() => gotoOffset(1)} disabled={currentIndex === flatSets.length - 1}
          className="btn flex-1" style={{ opacity: currentIndex === flatSets.length - 1 ? 0.3 : 1 }}>Siguiente →</button>
      </div>
      <div className="text-center text-[10.5px] mt-3" style={{ color: 'var(--text-3)' }}>
        desliza la tarjeta ⟷ para cambiar de serie
      </div>
    </FocusShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// Slider horizontal de ejercicios: chip por ejercicio con progreso (hechas/total).
function ExerciseSlider({ blocks, currentBlock, accentColor, onJump }: {
  blocks: ExerciseBlock[]
  currentBlock: ExerciseBlock
  accentColor: string
  onJump: (b: ExerciseBlock) => void
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentBlock.blockUuid])

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1" style={{ scrollSnapType: 'x proximity' }}>
      {blocks.map(b => {
        const done = b.setRows.filter(s => s.completed).length
        const total = b.setRows.length
        const isCurrent = b.blockUuid === currentBlock.blockUuid
        const allDone = total > 0 && done === total
        return (
          <button
            key={b.blockUuid}
            ref={isCurrent ? activeRef : undefined}
            onClick={() => onJump(b)}
            className="shrink-0 rounded-xl px-3 py-2 text-left transition-colors"
            style={{
              scrollSnapAlign: 'center',
              background: isCurrent ? `color-mix(in srgb, ${accentColor} 16%, var(--surface-1))` : 'var(--surface-1)',
              border: `1px solid ${isCurrent ? accentColor : allDone ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
              maxWidth: 150,
            }}>
            <div className="text-[12px] font-medium truncate"
              style={{ color: isCurrent ? 'var(--text)' : allDone ? 'var(--green)' : 'var(--text-2)' }}>
              {allDone ? '✓ ' : ''}{b.name}
            </div>
            <div className="num text-[10.5px] mt-0.5" style={{ color: isCurrent ? accentColor : 'var(--text-3)' }}>
              {done}/{total} series
            </div>
          </button>
        )
      })}
    </div>
  )
}

function BlockHeader({ block }: { block: ExerciseBlock }) {
  return (
    <div className="text-center">
      <h2 className="font-semibold tracking-tight"
        style={{ color: 'var(--text)', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {block.name}
      </h2>
      <div className="flex items-center justify-center gap-3 mt-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
        <span><span className="num" style={{ color: 'var(--text)' }}>{block.reps}</span> reps</span>
        {block.rir && <><span style={{ color: 'var(--text-3)' }}>·</span><span>{block.rir} RIR</span></>}
        {block.pesoUnidad === 'bw' && <><span style={{ color: 'var(--text-3)' }}>·</span><span>BW</span></>}
      </div>
      {block.notas && <p className="text-[12px] mt-2" style={{ color: 'var(--text-3)' }}>{block.notas}</p>}
    </div>
  )
}

function SetIndicator({ block, currentSetNumber, accentColor, onJump }: {
  block: ExerciseBlock; currentSetNumber: number; accentColor: string; onJump: (uuid: string) => void
}) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {block.setRows.map((s, i) => {
        const isCurrent = i + 1 === currentSetNumber
        const isDone = s.completed
        return (
          <button key={s.uuid} onClick={() => s.uuid && onJump(s.uuid)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: isCurrent ? accentColor : isDone ? 'var(--surface-3)' : 'transparent',
              border: `1px solid ${isCurrent ? accentColor : isDone ? 'var(--border-strong)' : 'var(--border)'}`,
            }}>
            <span className="num text-[13px] font-medium"
              style={{ color: isCurrent ? '#0a0a0a' : isDone ? 'var(--text)' : 'var(--text-3)' }}>
              {isDone ? '✓' : i + 1}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SetEditor — owns the form state for ONE set, identified by its uuid.
// On mount: hydrates from setRow. On unmount: persists pending edits.

function SetEditor({ setRow, prevSet, prevDate, bestE1, fill, updateSet, onCompleted, accentColor }: {
  setRow: SetLog
  prevSet?: SetLog
  prevDate?: string
  bestE1: number | null
  fill: { w?: number; r?: number; n: number }
  updateSet: (uuid: string, patch: Partial<SetLog>) => Promise<void>
  onCompleted: () => void
  accentColor: string
}) {
  const uuid = setRow.uuid!
  const [reps, setReps] = useState(setRow.reps != null ? String(setRow.reps) : '')
  const [weight, setWeight] = useState(setRow.weight != null ? String(setRow.weight) : '')
  const [completed, setCompletedState] = useState(setRow.completed)
  const [showRest, setShowRest] = useState(false)

  // Relleno externo (anterior / coach) — solo reacciona a peticiones nuevas.
  const fillSeen = useRef(fill.n)
  useEffect(() => {
    if (fill.n === fillSeen.current) return
    fillSeen.current = fill.n
    if (fill.w != null) setWeight(String(fill.w))
    if (fill.r != null) setReps(String(fill.r))
  }, [fill])

  // Track latest values for the unmount flush — avoids stale-closure double-writes.
  const latestRef = useRef({ reps, weight, completed })
  useEffect(() => { latestRef.current = { reps, weight, completed } }, [reps, weight, completed])

  // Debounced autosave for in-flight typing (300ms).
  useEffect(() => {
    const id = window.setTimeout(() => {
      void updateSet(uuid, {
        reps: reps === '' ? undefined : Number(reps),
        weight: weight === '' ? undefined : Number(weight),
      })
    }, 300)
    return () => window.clearTimeout(id)
  }, [uuid, reps, weight, updateSet])

  // Unmount flush — guaranteed final write of whatever the user typed last.
  useEffect(() => {
    return () => {
      const v = latestRef.current
      void updateSet(uuid, {
        reps: v.reps === '' ? undefined : Number(v.reps),
        weight: v.weight === '' ? undefined : Number(v.weight),
        completed: v.completed,
      })
    }
  }, [uuid, updateSet])

  function complete() {
    if (completed) return
    // Un toque: si están vacíos, la serie adopta los valores de la última vez.
    const w = weight === '' && prevSet?.weight != null ? String(prevSet.weight) : weight
    const r = reps === '' && prevSet?.reps != null ? String(prevSet.reps) : reps
    setWeight(w); setReps(r)
    setCompletedState(true)
    // Una sola escritura atómica (valores + completado): así el detector de PR
    // de updateSet ve la serie ya rellena, sin esperar al autosave debounced.
    void updateSet(uuid, {
      weight: w === '' ? undefined : Number(w),
      reps: r === '' ? undefined : Number(r),
      completed: true,
    })
    vibrate([60, 30, 100])
    setShowRest(true)
  }

  // e1RM en vivo del valor tecleado — y aviso de PR si supera el histórico.
  const w = Number(weight || (prevSet?.weight ?? 0))
  const r = Number(reps || (prevSet?.reps ?? 0))
  const liveE1 = w > 0 && r > 0 ? epley1RM(w, r) : null
  const wouldBePr = liveE1 != null && bestE1 != null && liveE1 > bestE1

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <NumberPad label="KG" value={weight} onChange={setWeight} placeholder={prevSet?.weight != null ? String(prevSet.weight) : '—'} />
        <NumberPad label="REPS" value={reps} onChange={setReps} placeholder={prevSet?.reps != null ? String(prevSet.reps) : '—'} />
      </div>

      {/* Referencia de la última sesión + e1RM en vivo */}
      <div className="flex items-center justify-center gap-3 flex-wrap text-[12px]">
        {prevSet && (prevSet.weight != null || prevSet.reps != null) && !completed && (
          <button
            onClick={() => {
              if (prevSet.weight != null) setWeight(String(prevSet.weight))
              if (prevSet.reps != null) setReps(String(prevSet.reps))
              vibrate(12)
            }}
            className="num px-3 py-1.5 rounded-lg"
            style={{ color: accentColor, background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
            Anterior{prevDate ? ` (${prevDate.slice(5)})` : ''}: {prevSet.weight ?? '–'}×{prevSet.reps ?? '–'} · usar
          </button>
        )}
        {liveE1 != null && (
          <span className="num" style={{ color: wouldBePr ? '#F5B93E' : 'var(--text-3)' }}>
            {wouldBePr ? '🏆 ¡Sería PR! ' : ''}e1RM ~{Math.round(liveE1 * 10) / 10} kg
          </span>
        )}
      </div>

      <button
        onClick={complete}
        disabled={completed}
        className="w-full rounded-xl transition-colors active:opacity-80"
        style={{
          height: 56,
          background: completed ? 'var(--surface-2)' : accentColor,
          color: completed ? 'var(--green)' : '#0A0A0A',
          border: completed ? '1px solid rgba(34,197,94,0.4)' : 'none',
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {completed ? '✓ Hecho' : 'Completar'}
      </button>

      <AnimatePresence>
        {showRest && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FocusRestTimer accentColor={accentColor} onSkip={() => { setShowRest(false); onCompleted() }} onDone={() => { setShowRest(false); onCompleted() }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NumberPad({ label, value, onChange, placeholder = '—' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        placeholder={placeholder}
        className="w-full num bg-transparent text-center mt-2 focus:outline-none"
        style={{
          fontSize: 64,
          letterSpacing: '-0.04em',
          fontWeight: 600,
          lineHeight: 1,
          color: value ? 'var(--text)' : 'var(--text-3)',
          borderBottom: '1px solid var(--border-strong)',
          paddingBottom: 6,
        }}
      />
      <div className="flex gap-1.5 mt-3 justify-center">
        {[-2.5, -1, +1, +2.5].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => {
              const n = Number(value || '0') + d
              onChange(String(Math.max(0, Math.round(n * 10) / 10)))
              vibrate(8)
            }}
            className="chip num"
          >
            {d > 0 ? '+' : ''}{d}
          </button>
        ))}
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function FocusShell({ children, onClose, idx, total }: {
  children: React.ReactNode; onClose: () => void; idx: number; total: number
}) {
  useEffect(() => {
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = o }
  }, [])

  const pct = total > 0 ? ((idx + 1) / total) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: 'var(--bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onClose} className="text-[13px] px-2 py-1" style={{ color: 'var(--text-2)' }}>
          ← Cerrar
        </button>
        <div className="num text-[13px]" style={{ color: 'var(--text-3)' }}>
          {total > 0 ? `${idx + 1} / ${total}` : '—'}
        </div>
      </div>

      <div className="mx-4 h-px overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div
          className="h-full"
          style={{ background: 'var(--accent)' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </div>
    </motion.div>
  )
}

function FocusRestTimer({ accentColor, onSkip, onDone }: { accentColor: string; onSkip: () => void; onDone: () => void }) {
  // Comparte el descanso preferido con el temporizador flotante de la lista.
  const [target, setTarget] = useState(() => restTargetSec())
  const [remaining, setRemaining] = useState(() => restTargetSec())
  const [running, setRunning] = useState(true)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          window.clearInterval(id)
          setRunning(false)
          vibrate([200, 100, 200, 100, 400])
          setTimeout(onDone, 600)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen')
        }
      } catch { /* sin soporte */ }
    }
    if (running) acquire()
    return () => { wakeLock.current?.release().catch(() => {}); wakeLock.current = null }
  }, [running])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const pct = ((target - remaining) / target) * 100

  return (
    <div className="card p-5">
      <div className="text-center">
        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Descanso · auto</div>
        <div className="num leading-none mt-2" style={{ fontSize: '56px', color: 'var(--text)', fontWeight: 600, letterSpacing: '-0.03em' }}>
          {mm}:{ss}
        </div>
      </div>

      <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: accentColor }} />
      </div>

      <div className="flex gap-1.5 mt-4 justify-center">
        {[60, 90, 120, 180].map(s => (
          <button key={s} onClick={() => { setTarget(s); setRemaining(s); setRunning(true); setRestTargetSec(s); vibrate(10) }}
            className="chip"
            style={target === s ? { color: 'var(--text)', borderColor: 'var(--text-2)' } : {}}>
            {s}s
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setRunning(r => !r)} className="btn flex-1">
          {running ? 'Pausa' : 'Reanudar'}
        </button>
        <button onClick={onSkip} className="btn flex-1">Saltar</button>
      </div>
    </div>
  )
}
