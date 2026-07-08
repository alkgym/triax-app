// Modo Enfoque — fullscreen UI for gym sessions.
//
// Cursor invariant: we track the CURRENT SET BY uuid, never by array index.
//   • If the underlying set list grows / shrinks (extra sets added, ones deleted)
//     the cursor still references the same physical set. No cross-contamination.
//   • If the cursor's set disappears (rare — only via explicit delete) we fall back
//     to the first incomplete set, then to the last set.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SetLog } from '../db/schema'
import { vibrate } from '../db/hooks'
import type { ExerciseBlock, WorkoutSessionState } from '../hooks/useWorkoutSession'

interface Props {
  state: WorkoutSessionState
  accentColor: string
  onClose: () => void
}

export function FocusMode({ state, accentColor, onClose }: Props) {
  const { blocks, flatSets, updateSet, setCompleted } = state

  // ── Cursor by uuid ─────────────────────────────────────────────────────────
  const initialUuid = useMemo(
    () => flatSets.find(s => !s.completed)?.uuid ?? flatSets[0]?.uuid ?? null,
    // only on mount — don't reset when the user advances
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [currentUuid, setCurrentUuid] = useState<string | null>(initialUuid ?? null)

  // If the cursor's set disappeared (deleted externally), fall back gracefully.
  useEffect(() => {
    if (currentUuid && flatSets.some(s => s.uuid === currentUuid)) return
    const fallback = flatSets.find(s => !s.completed)?.uuid ?? flatSets[flatSets.length - 1]?.uuid ?? null
    setCurrentUuid(fallback)
  }, [flatSets, currentUuid])

  if (flatSets.length === 0) {
    return (
      <FocusShell onClose={onClose} idx={0} total={0}>
        <div className="text-center" style={{ color: 'var(--text-3)' }}>No hay series para hoy.</div>
      </FocusShell>
    )
  }

  const currentIndex = currentUuid ? flatSets.findIndex(s => s.uuid === currentUuid) : -1
  const current = currentIndex >= 0 ? flatSets[currentIndex] : flatSets[0]
  const block = blocks.find(b => b.setRows.some(s => s.uuid === current.uuid))!
  const setNumberInBlock = block.setRows.findIndex(s => s.uuid === current.uuid) + 1

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

  function advanceAfterCompletion() {
    // Find next incomplete AFTER current position; fallback to first incomplete anywhere.
    const after = flatSets.find((s, i) => i > currentIndex && !s.completed)
    if (after?.uuid) { setCurrentUuid(after.uuid); return }
    const anyIncomplete = flatSets.find(s => !s.completed)
    if (anyIncomplete?.uuid) setCurrentUuid(anyIncomplete.uuid)
  }

  return (
    <FocusShell onClose={onClose} idx={Math.max(0, currentIndex)} total={flatSets.length}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.uuid /* stable per-set re-mount → fresh editor state */}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          className="space-y-6"
        >
          <BlockHeader block={block} totalBlocks={blocks.length} />

          <SetIndicator block={block} currentSetNumber={setNumberInBlock} accentColor={accentColor} onJump={gotoUuid} />

          <SetEditor
            key={current.uuid}
            setRow={current}
            updateSet={updateSet}
            setCompleted={setCompleted}
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
    </FocusShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function BlockHeader({ block, totalBlocks }: { block: ExerciseBlock; totalBlocks: number }) {
  return (
    <div className="text-center">
      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
        Ejercicio {block.order} / {totalBlocks}
      </div>
      <h2 className="font-semibold tracking-tight mt-2"
        style={{ color: 'var(--text)', fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {block.name}
      </h2>
      <div className="flex items-center justify-center gap-3 mt-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
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

function SetEditor({ setRow, updateSet, setCompleted, onCompleted, accentColor }: {
  setRow: SetLog
  updateSet: (uuid: string, patch: Partial<SetLog>) => Promise<void>
  setCompleted: (uuid: string, c: boolean) => Promise<void>
  onCompleted: () => void
  accentColor: string
}) {
  const uuid = setRow.uuid!
  const [reps, setReps] = useState(setRow.reps != null ? String(setRow.reps) : '')
  const [weight, setWeight] = useState(setRow.weight != null ? String(setRow.weight) : '')
  const [completed, setCompletedState] = useState(setRow.completed)
  const [showRest, setShowRest] = useState(false)

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
    setCompletedState(true)
    void setCompleted(uuid, true)
    vibrate([60, 30, 100])
    setShowRest(true)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <NumberPad label="REPS" value={reps} onChange={setReps} />
        <NumberPad label="KG" value={weight} onChange={setWeight} />
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

function NumberPad({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        placeholder="—"
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

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </div>
    </motion.div>
  )
}

function FocusRestTimer({ accentColor, onSkip, onDone }: { accentColor: string; onSkip: () => void; onDone: () => void }) {
  const [target, setTarget] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running, setRunning] = useState(true)
  const wakeLock = useRef<any>(null)

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
  }, [running])

  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await (navigator as any).wakeLock.request('screen')
        }
      } catch {}
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
          <button key={s} onClick={() => { setTarget(s); setRemaining(s); setRunning(true); vibrate(10) }}
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
