import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type SetLog, type WorkoutSession, type WorkoutType } from '../db/schema'
import { todayIso, fmtDate, greetingFor, addDays } from '../lib/dates'
import { checkContraindication, suggestedPhase, REHAB_PHASE_META } from '../lib/rehab'
import { WeekStrip } from '../components/WeekStrip'
import { useTodayScheduledType } from '../components/ScheduleEditor'
import { useAutosave, vibrate } from '../db/hooks'
import { SaveIndicator } from '../components/SaveIndicator'
import { RestTimer } from '../components/RestTimer'
import { motion, AnimatePresence } from 'framer-motion'
import { FocusMode } from '../components/FocusMode'
import { useWorkoutSession, isGymType, type WorkoutSessionState, type ExerciseBlock } from '../hooks/useWorkoutSession'
import { saveWeight } from '../lib/weight'

// Rutinas de gym disponibles (las que tienen plantillas seedeadas / creadas por el usuario)
const GYM_ROUTINE_META: Record<string, { label: string; color: string }> = {
  push:     { label: 'Push',      color: '#FF6B2B' },
  pull:     { label: 'Pull',      color: '#3B82F6' },
  fullbody: { label: 'Full Body', color: '#A855F7' },
  legs:     { label: 'Legs',      color: '#10F4A0' },
  torso:    { label: 'Torso',     color: '#22D3EE' },
}

export default function Today() {
  const date = todayIso()
  const profile = useLiveQuery(() => db.profile.get('me'))
  const lastWeight = useLiveQuery(async () => {
    const all = await db.bodyMetrics.orderBy('date').reverse().limit(1).toArray()
    return all[0]
  })
  const primary = useLiveQuery(
    () => db.sessions.where('date').equals(date).filter(s => !s.isExtra).first() ?? null,
    [date],
  ) as WorkoutSession | null | undefined
  const todaysPain = useLiveQuery(() => db.painLogs.where('date').equals(date).toArray(), [date])
  // Tipos de gym con plantillas activas → rutinas lanzables
  const gymTypes = useLiveQuery(async () => {
    const tpls = await db.exerciseTemplates.filter(t => t.active && isGymType(t.type)).toArray()
    const types = Array.from(new Set(tpls.map(t => t.type)))
    return types.sort()
  })

  const activeGymType: WorkoutType | null =
    primary && isGymType(primary.type) ? primary.type : null
  const scheduledType = useTodayScheduledType()
  const [celebrate, setCelebrate] = useState(false)

  async function chooseRoutine(type: WorkoutType) {
    const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
    if (!s) {
      await db.sessions.add({ date, type, startedAt: Date.now(), notes: '', isExtra: false })
    } else if (s.type !== type) {
      await db.sessions.update(s.id!, { type })
    }
    vibrate(20)
  }

  async function cancelRoutine() {
    const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
    if (!s?.id) return
    // borra las series de la sesión y la deja como 'rest' (vuelve el lanzador)
    const sets = await db.sets.where('sessionId').equals(s.id).toArray()
    await db.sets.bulkDelete(sets.map(x => x.id!))
    await db.sessions.update(s.id, { type: 'rest', completedAt: undefined } as any)
    vibrate(30)
  }

  const lastPain = (todaysPain ?? []).slice().sort((a, b) => b.timestamp - a.timestamp)[0]
  const firstName = profile?.nombre?.split(' ')[0] ?? 'Alex'

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header>
        <div className="eyebrow">{greetingFor()}, {firstName}</div>
        <h1 className="font-semibold mt-1 tracking-tight" style={{ color: 'var(--text)', fontSize: 30, letterSpacing: '-0.035em', lineHeight: 1.08 }}>
          {(() => { const d = fmtDate(date); return d.charAt(0).toUpperCase() + d.slice(1) })()}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
          <QuickWeight lastWeight={lastWeight?.weight} />
        </div>
      </header>

      <WeekStrip />

      {/* Check-in de dolor del día */}
      <Link to="/lesion" className="card p-4 flex items-center justify-between gap-3 active:opacity-70 transition-opacity">
        <div className="min-w-0">
          <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            {lastPain ? 'Dolor registrado hoy' : '¿Cómo está tu espalda hoy?'}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            {lastPain ? 'Toca para ver evolución y ejercicios' : 'Registra tu dolor lumbar de hoy'}
          </div>
        </div>
        {lastPain
          ? <span className="num font-bold shrink-0" style={{ fontSize: 32, color: painColor(lastPain.level) }}>{lastPain.level}<span className="text-[12px]" style={{ color: 'var(--text-3)' }}>/10</span></span>
          : <span className="shrink-0 text-[13px] font-medium px-3 py-1.5 rounded-lg" style={{ color: 'var(--accent)', background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>Registrar</span>}
      </Link>

      {/* Check-in del día siguiente (p.ej. tras fútbol) */}
      <NextDayCheckin date={date} />

      {/* Guardia de dolor: si hoy duele, ajusta la recomendación */}
      {lastPain && lastPain.level >= 3 && (() => {
        const high = lastPain.level >= 6
        const phase = REHAB_PHASE_META[suggestedPhase(lastPain.level)]
        const c = high ? '#EF4444' : '#F59E0B'
        return (
          <Link to="/lesion" className="card p-4 block active:opacity-70 transition-opacity" style={{ borderColor: `${c}66`, background: `${c}0f` }}>
            <div className="text-[12px] font-semibold uppercase" style={{ color: c, letterSpacing: '0.05em' }}>
              {high ? `⚠️ Dolor alto hoy · ${lastPain.level}/10` : `Molestia hoy · ${lastPain.level}/10`}
            </div>
            <div className="text-[13px] mt-1" style={{ color: 'var(--text-2)' }}>
              {high
                ? `Prioriza ${phase.label} y evita carga pesada/flexión. Toca para ver ejercicios seguros.`
                : 'Entrena con técnica impecable y lumbar neutra. Toca para ver recomendados.'}
            </div>
          </Link>
        )
      })()}

      {/* Rutina de gym activa o lanzador */}
      {activeGymType ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase" style={{ color: GYM_ROUTINE_META[activeGymType]?.color ?? 'var(--accent)', letterSpacing: '0.08em' }}>
              {GYM_ROUTINE_META[activeGymType]?.label ?? activeGymType}
            </span>
            <button onClick={cancelRoutine} className="text-[12px]" style={{ color: 'var(--text-3)' }}>Cambiar rutina</button>
          </div>
          <GymBlock date={date} workoutType={activeGymType as any} />
          <CompleteButton
            done={!!primary?.completedAt}
            completedAt={primary?.completedAt}
            onComplete={async () => {
              const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
              if (s?.id) {
                await db.sessions.update(s.id, { completedAt: Date.now() })
                vibrate([60, 30, 60, 30, 120])
                setCelebrate(true)
                setTimeout(() => setCelebrate(false), 1900)
              }
            }}
            onUndo={async () => {
              const s = await db.sessions.where('date').equals(date).filter(x => !x.isExtra).first()
              if (s?.id) await db.sessions.update(s.id, { completedAt: undefined } as any)
            }}
          />
        </div>
      ) : (
        <RoutineLauncher gymTypes={(gymTypes ?? []) as WorkoutType[]} scheduledType={scheduledType} onChoose={chooseRoutine} />
      )}

      {/* Cardio / otros entrenos del día */}
      <ExtraWorkoutsBlock date={date} />

      <NotesField date={date} />

      <CelebrationOverlay show={celebrate} />
    </div>
  )
}

function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}

// Mini-gráfica de progresión: mejor peso por sesión (últimas 10)
function Sparkline({ points, color }: { points: { w: number }[]; color: string }) {
  const W = 70, H = 20, pad = 2.5
  const ws = points.map(p => p.w)
  const min = Math.min(...ws), max = Math.max(...ws)
  const span = max - min || 1
  const step = (W - pad * 2) / (points.length - 1)
  const x = (i: number) => pad + i * step
  const y = (w: number) => H - pad - ((w - min) / span) * (H - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.w).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].w)} r="2.2" fill={color} />
    </svg>
  )
}

// Celebración al completar el entreno
function CelebrationOverlay({ show }: { show: boolean }) {
  const EMOJIS = ['💪', '🔥', '⚡', '🏋️', '✨']
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ background: 'rgba(8,8,10,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="text-center relative">
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * Math.PI * 2
              return (
                <motion.span key={i} className="absolute" style={{ left: '50%', top: '38%', fontSize: 22 }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                  animate={{ x: Math.cos(a) * 115, y: Math.sin(a) * 95, opacity: 0, scale: 1.25 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}>
                  {EMOJIS[i % EMOJIS.length]}
                </motion.span>
              )
            })}
            <motion.div
              initial={{ scale: 0.7 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="num font-bold gradient-warm" style={{ fontSize: 62, letterSpacing: '-0.04em', lineHeight: 1 }}>
              ¡Hecho!
            </motion.div>
            <div className="text-[14px] mt-2" style={{ color: 'var(--text-2)' }}>Entreno completado 💪</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Check-in del día siguiente: si ayer hubo entreno(s) y aún no has registrado cómo
// amaneciste hoy, pregunta. Clave para correlacionar fútbol/sesiones duras ↔ dolor.
function NextDayCheckin({ date }: { date: string }) {
  const yesterday = addDays(date, -1)
  const yAll = useLiveQuery(() => db.sessions.where('date').equals(yesterday).toArray(), [yesterday])
  const already = useLiveQuery(
    () => db.painLogs.where('date').equals(date).filter(p => p.nextDayOf === yesterday).first(),
    [date, yesterday],
  )
  // Solo cuenta entrenos reales (no días de solo-notas / descanso)
  const ySessions = (yAll ?? []).filter(s => s.type !== 'rest' && (!!s.completedAt || !!s.isExtra || !!s.startedAt))
  if (!yAll) return null
  if (ySessions.length === 0) return null
  if (already) return null

  const labels = Array.from(new Set(ySessions.map(s => s.extraTitle || GYM_ROUTINE_META[s.type]?.label || labelForType(s.type)))).filter(Boolean)
  const summary = labels.slice(0, 3).join(', ')

  async function log(level: number) {
    await db.painLogs.add({
      date, timeOfDay: 'wake', level, locations: [], context: 'tras-dormir',
      nextDayOf: yesterday, trigger: summary ? `tras: ${summary}` : undefined, timestamp: Date.now(),
    })
    vibrate(20)
  }

  return (
    <div className="card p-4 space-y-3" style={{ borderColor: 'rgba(124,92,255,.35)' }}>
      <div>
        <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>¿Cómo amaneciste hoy?</div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          Ayer: {summary || 'entrenaste'}. Registra el dolor al despertar para ver cómo te afecta.
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => i).map(n => (
          <button key={n} onClick={() => log(n)}
            className="num w-8 h-8 rounded-lg text-[13px] font-medium transition-transform active:scale-90"
            style={{ color: painColor(n), background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function labelForType(t: string): string {
  const map: Record<string, string> = {
    run: 'Correr', bike: 'Bici', bike_indoor: 'Bici indoor', swim: 'Nado', swim_pool: 'Piscina',
    futbol: 'Fútbol', gym_free: 'Gym libre', rest: 'Descanso',
  }
  return map[t] ?? t
}

// Etiqueta el dolor lumbar provocado por un ejercicio (se guarda en todas sus series).
function PainTagger({ block, state }: { block: ExerciseBlock; state: WorkoutSessionState }) {
  const current = block.setRows.find(s => s.painProvoked != null)?.painProvoked
  const [open, setOpen] = useState(current != null)

  async function setPain(level: number | null) {
    for (const s of block.setRows) {
      if (s.uuid) await state.updateSet(s.uuid, { painProvoked: level ?? undefined })
    }
    vibrate(15)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[12px]" style={{ color: 'var(--text-3)' }}>
        + dolor lumbar
      </button>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Dolor lumbar provocado</div>
      <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => i).map(n => (
          <button key={n} onClick={() => setPain(n)}
            className="num w-7 h-7 rounded-md text-[12px] font-medium"
            style={current === n
              ? { color: '#fff', background: painColor(n), border: `1px solid ${painColor(n)}` }
              : { color: painColor(n), background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {n}
          </button>
        ))}
        {current != null && (
          <button onClick={() => setPain(null)} className="text-[11px] px-2" style={{ color: 'var(--text-3)' }}>quitar</button>
        )}
      </div>
    </div>
  )
}

function RoutineLauncher({ gymTypes, scheduledType, onChoose }: { gymTypes: WorkoutType[]; scheduledType: WorkoutType | null; onChoose: (t: WorkoutType) => void }) {
  const schedGym = scheduledType && isGymType(scheduledType) ? scheduledType : null
  const m = schedGym ? (GYM_ROUTINE_META[schedGym] ?? { label: schedGym, color: 'var(--accent)' }) : null
  return (
    <div className="space-y-3">
      {/* Sugerencia del horario */}
      {schedGym && m ? (
        <button onClick={() => onChoose(schedGym)} className="card w-full p-4 flex items-center justify-between active:opacity-70 transition-opacity relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: m.color }} />
          <div className="text-left">
            <div className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Hoy toca</div>
            <div className="text-[22px] font-semibold tracking-tight" style={{ color: m.color }}>{m.label}</div>
          </div>
          <span className="shrink-0 text-[13px] font-semibold px-4 py-2 rounded-lg" style={{ background: m.color, color: '#0a0a0a' }}>Empezar →</span>
        </button>
      ) : scheduledType === 'rest' ? (
        <div className="card p-4">
          <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>Hoy: descanso programado</div>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>Entrena libre si quieres, o haz rehab/movilidad.</div>
        </div>
      ) : null}

      <div className="card p-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>¿Qué entrenas hoy?</div>
      {gymTypes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {gymTypes.map(t => {
            const m = GYM_ROUTINE_META[t] ?? { label: t, color: 'var(--accent)' }
            return (
              <button key={t} onClick={() => onChoose(t)}
                className="rounded-lg p-3 text-left transition-colors active:opacity-70"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
                <span className="inline-block w-2 h-2 rounded-full mb-1.5" style={{ background: m.color }} />
                <div className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>{m.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>Registrar series</div>
              </button>
            )
          })}
        </div>
      )}
      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
        Para natación, bici indoor, correr, fútbol u otros, usa <b style={{ color: 'var(--text-2)' }}>Entrenos extra</b> abajo.
      </div>
      <Link to="/rutinas" className="btn btn-ghost w-full text-sm">Ver y editar rutinas →</Link>
      </div>
    </div>
  )
}

function QuickWeight({ lastWeight }: { lastWeight?: number }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const n = Number(val.replace(',', '.'))
    if (!n || saving) return
    setSaving(true)
    await saveWeight(todayIso(), n)
    setSaving(false)
    setEditing(false)
    setVal('')
    vibrate(20)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          autoFocus
          inputMode="decimal"
          placeholder={lastWeight != null ? String(lastWeight) : 'kg'}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setVal('') } }}
          className="num bg-transparent w-14"
          style={{ color: 'var(--text)', fontWeight: 500, borderBottom: '1px solid var(--text-3)' }}
        />
        <button onClick={save} className="text-[12px] font-medium" style={{ color: 'var(--accent)' }} disabled={saving}>
          {saving ? '…' : 'OK'}
        </button>
        <button onClick={() => { setEditing(false); setVal('') }} className="text-[12px]" style={{ color: 'var(--text-3)' }}>
          ×
        </button>
      </span>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1">
      {lastWeight != null
        ? <><span className="num" style={{ color: 'var(--text)' }}>{lastWeight}</span> kg</>
        : <span style={{ color: 'var(--accent)' }}>+ peso</span>}
    </button>
  )
}

function GymBlock({ date, workoutType }: { date: string; workoutType: 'push' | 'pull' | 'fullbody' | 'legs' | 'torso' }) {
  const state = useWorkoutSession(date, workoutType)
  if (!state.ready) return <div className="text-[13px]" style={{ color: 'var(--text-3)' }}>Cargando ejercicios…</div>
  if (state.blocks.length === 0) {
    return (
      <div className="card p-4 text-[13px]" style={{ color: 'var(--text-2)' }}>
        Esta rutina no tiene ejercicios todavía. Añádelos en <Link to="/rutinas" style={{ color: 'var(--accent)' }}>Rutinas</Link>.
      </div>
    )
  }

  const typeColor =
    workoutType === 'push'  ? '#FF6B2B'
  : workoutType === 'pull'  ? '#3B82F6'
  : workoutType === 'legs'  ? '#10F4A0'
  : workoutType === 'torso' ? '#22D3EE'
  : '#A855F7'

  return (
    <div className="space-y-4">
      <FocusModeToggle state={state} accentColor={typeColor} />
      <RestTimer />
      {state.blocks.map((b, idx) => (
        <ExerciseCard
          key={b.blockUuid}
          index={idx + 1}
          block={b}
          state={state}
          currentDate={date}
          accentColor={typeColor}
        />
      ))}
    </div>
  )
}

function FocusModeToggle({ state, accentColor }: { state: WorkoutSessionState; accentColor: string }) {
  const [open, setOpen] = useState(false)
  const totalSets = state.flatSets.length
  const doneSets = state.flatSets.filter(s => s.completed).length

  return (
    <>
      <button
        onClick={() => { setOpen(true); vibrate(20) }}
        className="card w-full p-4 flex items-center justify-between transition-colors active:opacity-70"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
            <span style={{ color: accentColor, fontSize: 12 }}>●</span>
          </div>
          <div className="text-left min-w-0">
            <div className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>Modo Enfoque</div>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>Una serie a la vez · cronómetro auto</div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3 flex items-center gap-2">
          <div className="num font-semibold" style={{ color: 'var(--text)', fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {doneSets}<span style={{ color: 'var(--text-3)', fontSize: 16 }}>/{totalSets}</span>
          </div>
          <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>
        </div>
      </button>
      <AnimatePresence>
        {open && <FocusMode state={state} accentColor={accentColor} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function ExerciseCard({ index, block, state, currentDate, accentColor }: {
  index: number
  block: ExerciseBlock
  state: WorkoutSessionState
  currentDate: string
  accentColor: string
}) {
  const { name, reps, rir, pesoUnidad: unit, notas, setRows: sets, templateId } = block
  const done = sets.filter(s => s.completed).length
  const allDone = done === sets.length && sets.length > 0
  const contra = checkContraindication(name)

  // Previous-session reference: prefer templateId match (rename-safe), fall back to name.
  const previous = useLiveQuery(async () => {
    const byTpl = templateId != null
      ? await db.sets.where('templateId').equals(templateId).toArray()
      : []
    const byName = await db.sets.where('exercise').equals(name).toArray()
    const pastSets = [...byTpl, ...byName.filter(b => !byTpl.some(t => t.id === b.id))]
    if (pastSets.length === 0) return null
    const sessIds = Array.from(new Set(pastSets.map(s => s.sessionId)))
    const sessions = await db.sessions.where('id').anyOf(sessIds).filter(s => !s.isExtra).toArray()
    const earlier = sessions.filter(s => s.date < currentDate).sort((a, b) => b.date.localeCompare(a.date))
    if (earlier.length === 0) return null
    const earlierIds = new Set(earlier.map(s => s.id))
    const best = pastSets
      .filter(s => earlierIds.has(s.sessionId) && s.completed && s.weight != null)
      .reduce((m, s) => Math.max(m, s.weight!), 0)
    // Sesión de referencia: la MÁS reciente que de verdad tenga peso anotado
    // para este ejercicio. Si la semana pasada no registré peso, retrocede a
    // la anterior que sí lo tenga — así el objetivo nunca sale a 0 / en blanco.
    const setsBySession = new Map<number, SetLog[]>()
    for (const s of pastSets) {
      if (!earlierIds.has(s.sessionId)) continue
      const arr = setsBySession.get(s.sessionId!)
      if (arr) arr.push(s)
      else setsBySession.set(s.sessionId!, [s])
    }
    const hasWeight = (arr: SetLog[] | undefined) => !!arr?.some(s => s.weight != null && s.weight > 0)
    const last = earlier.find(s => hasWeight(setsBySession.get(s.id!))) ?? earlier[0]
    const lastSets = (setsBySession.get(last.id!) ?? []).slice().sort((a, b) => a.setNumber - b.setNumber)
    // Histórico: mejor peso completado por sesión (ascendente, últimas 10)
    const maxBySession = new Map<number, number>()
    for (const s of pastSets) {
      if (s.completed && s.weight != null && earlierIds.has(s.sessionId)) {
        maxBySession.set(s.sessionId, Math.max(maxBySession.get(s.sessionId) ?? 0, s.weight))
      }
    }
    const history = earlier
      .filter(sess => maxBySession.has(sess.id!))
      .map(sess => ({ date: sess.date, w: maxBySession.get(sess.id!)! }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10)
    return { date: last.date, sets: lastSets, best: best > 0 ? best : null, history }
  }, [name, templateId, currentDate])

  const isPr = !!(previous?.best != null && sets.some(s => s.completed && (s.weight ?? 0) > previous.best!))

  return (
    <div
      className="card overflow-hidden"
      style={allDone ? { borderColor: 'rgba(34,197,94,0.4)' } : {}}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-medium mt-0.5"
            style={{ background: 'var(--surface-2)', color: accentColor, border: '1px solid var(--border-strong)' }}>
            {index}
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-medium leading-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
              {name}
              {isPr && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 pop-check"
                  style={{ color: '#0a0a0a', background: 'linear-gradient(135deg,#FFD479,#F59E0B)' }}>🏆 PR</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px]" style={{ color: 'var(--text-3)' }}>
              <span className="num">{sets.length} × {reps}</span>
              {rir && <span style={{ color: 'var(--text-2)' }}>{rir} RIR</span>}
              {unit === 'bw' && <span>BW</span>}
            </div>
            {notas && <div className="text-[12px] mt-1.5" style={{ color: 'var(--text-3)' }}>{notas}</div>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="num text-[18px] font-semibold" style={{ color: allDone ? 'var(--green)' : 'var(--text)' }}>
            {done}<span className="text-[12px] font-normal" style={{ color: 'var(--text-3)' }}>/{sets.length}</span>
          </span>
        </div>
      </div>

      {/* Aviso de contraindicación según el diagnóstico lumbar */}
      {contra && (
        <div className="mx-4 mb-3 rounded-lg p-2.5" style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.3)' }}>
          <div className="text-[11px] font-semibold" style={{ color: '#EF4444' }}>⛔ Contraindicado · {contra.label}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{contra.riesgo}</div>
          <div className="text-[11px] mt-0.5" style={{ color: '#22C55E' }}>✓ {contra.alternativa}</div>
        </div>
      )}

      {/* Previous session reference + progresión */}
      {previous && (
        <div className="mx-4 mb-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <span className="shrink-0">Ant. {previous.date}</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {previous.sets.map((p, i) => (
                <span key={p.id} className="num" style={{ color: 'var(--text-2)' }}>
                  {i > 0 && <span style={{ color: 'var(--text-3)' }} className="mx-1">·</span>}
                  {p.weight ?? '–'}×{p.reps ?? '–'}
                </span>
              ))}
            </div>
            {previous.history && previous.history.length >= 2 && (
              <Sparkline points={previous.history} color={accentColor} />
            )}
          </div>
          {previous.history && previous.history.length >= 2 && (() => {
            const first = previous.history[0].w
            const last = previous.history[previous.history.length - 1].w
            const delta = first > 0 ? Math.round(((last - first) / first) * 100) : 0
            if (delta === 0) return null
            return (
              <div className="text-[10.5px] num" style={{ color: delta > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                {delta > 0 ? '↗' : '↘'} {delta > 0 ? '+' : ''}{delta}% en {previous.history.length} sesiones
              </div>
            )
          })()}
        </div>
      )}

      <div className="mx-4 h-px mb-3" style={{ background: 'var(--border)' }} />

      {/* Sets */}
      <div className="px-4 space-y-2">
        {sets.map(s => {
          const prev = previous?.sets.find(p => p.setNumber === s.setNumber)
          return <SetRow key={s.uuid ?? s.id} set={s} prev={prev} state={state} accentColor={accentColor} canDelete={sets.length > 1} />
        })}
      </div>

      {/* Add set + tagger de dolor */}
      <div className="px-4 pt-3 pb-4 space-y-3">
        <button
          className="w-full py-2.5 rounded-lg text-[12px] font-medium transition-colors"
          style={{ color: 'var(--text-3)', background: 'transparent', border: '1px dashed var(--border-strong)' }}
          onClick={async () => {
            if (templateId == null) return
            await state.addExtraSet(templateId)
            vibrate(15)
          }}
        >+ serie extra</button>
        <PainTagger block={block} state={state} />
      </div>
    </div>
  )
}

function SetRow({ set, prev, state, accentColor, canDelete }: {
  set: SetLog; prev?: SetLog; state: WorkoutSessionState; accentColor: string; canDelete: boolean
}) {
  const uuid = set.uuid!  // post-migration always present
  const [reps, setReps] = useState<string>(set.reps != null ? String(set.reps) : '')
  const [weight, setWeight] = useState<string>(set.weight != null ? String(set.weight) : '')
  const [completed, setCompleted] = useState(set.completed)
  const [confirmDel, setConfirmDel] = useState(false)
  const lastExternalRef = useRef({ reps: set.reps, weight: set.weight, completed: set.completed })

  // ── External sync (FocusMode etc.) ─────────────────────────────────
  useEffect(() => {
    const ext = { reps: set.reps, weight: set.weight, completed: set.completed }
    const last = lastExternalRef.current
    if (ext.reps !== last.reps && (ext.reps != null ? String(ext.reps) : '') !== reps) {
      setReps(ext.reps != null ? String(ext.reps) : '')
    }
    if (ext.weight !== last.weight && (ext.weight != null ? String(ext.weight) : '') !== weight) {
      setWeight(ext.weight != null ? String(ext.weight) : '')
    }
    if (ext.completed !== last.completed && ext.completed !== completed) {
      setCompleted(ext.completed)
    }
    lastExternalRef.current = ext
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.reps, set.weight, set.completed])

  const status = useAutosave({ reps, weight, completed }, async (v) => {
    const patch = {
      reps: v.reps === '' ? undefined : Number(v.reps),
      weight: v.weight === '' ? undefined : Number(v.weight),
      completed: v.completed,
    }
    lastExternalRef.current = { reps: patch.reps, weight: patch.weight, completed: patch.completed }
    await state.updateSet(uuid, patch)
  })

  function fillFromPrev() {
    if (!prev) return
    if (prev.reps != null) setReps(String(prev.reps))
    if (prev.weight != null) setWeight(String(prev.weight))
    vibrate(15)
  }

  async function del() {
    await state.deleteSet(uuid)
    vibrate(30)
  }

  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2.5"
      style={{
        background: completed ? 'rgba(34,197,94,0.06)' : 'var(--surface-2)',
        border: `1px solid ${completed ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
      }}
    >
      {/* Set number */}
      <div className="shrink-0 w-5 text-center">
        <span className="num text-[13px] font-medium" style={{ color: completed ? 'var(--green)' : 'var(--text-3)' }}>
          {set.setNumber}
        </span>
      </div>

      {/* Reps input */}
      <div className="flex-1 min-w-0">
        <input
          className="num w-full bg-transparent text-center font-medium text-[15px] focus:outline-none"
          style={{ color: 'var(--text)' }}
          inputMode="decimal"
          placeholder={prev?.reps != null ? String(prev.reps) : '—'}
          value={reps}
          onChange={e => setReps(e.target.value)}
        />
      </div>

      <span className="text-[12px] shrink-0" style={{ color: 'var(--text-3)' }}>×</span>

      {/* Weight input */}
      <div className="flex-1 min-w-0">
        <input
          className="num w-full bg-transparent text-center font-medium text-[15px] focus:outline-none"
          style={{ color: 'var(--text)' }}
          inputMode="decimal"
          placeholder={prev?.weight != null ? String(prev.weight) : '—'}
          value={weight}
          onChange={e => setWeight(e.target.value)}
        />
      </div>

      {/* Prev hint */}
      {prev && !completed && (
        <button
          onClick={fillFromPrev}
          className="shrink-0 num text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{ color: accentColor, border: '1px solid var(--border)' }}
        >
          {prev.weight ?? '–'}×{prev.reps ?? '–'}
        </button>
      )}

      {/* Complete toggle */}
      <button
        onClick={() => { setCompleted(c => !c); vibrate(20) }}
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors"
        style={completed
          ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }
          : { background: 'transparent', border: '1px solid var(--border-strong)' }
        }
      >
        <span style={{ color: completed ? 'var(--green)' : 'var(--text-3)', fontSize: 14 }}>
          {completed ? '✓' : '○'}
        </span>
      </button>

      {/* Delete (only if more than one set) */}
      {canDelete && (
        confirmDel ? (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setConfirmDel(false)} className="text-[11px] px-1.5" style={{ color: 'var(--text-3)' }}>No</button>
            <button onClick={del} className="text-[11px] px-1.5" style={{ color: 'var(--red)' }}>Borrar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="shrink-0 text-[14px] px-1" style={{ color: 'var(--text-3)' }}>×</button>
        )
      )}

      {/* Saving indicator */}
      {status === 'saving' && (
        <span className="shrink-0 w-1 h-1 rounded-full saving" style={{ background: 'var(--text-3)' }} />
      )}
    </div>
  )
}

function CompleteButton({ done, completedAt, onComplete, onUndo }: {
  done: boolean
  completedAt?: number
  onComplete: () => void
  onUndo: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  if (done) {
    const time = completedAt
      ? new Date(completedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : ''
    return (
      <div className="space-y-2">
        <div className="card p-4 flex items-center justify-center gap-3">
          <span style={{ color: 'var(--green)', fontSize: 18 }}>✓</span>
          <div className="text-center">
            <div className="text-[14px] font-medium" style={{ color: 'var(--green)' }}>Completado</div>
            {time && <div className="text-[12px] num mt-0.5" style={{ color: 'var(--text-3)' }}>{time}</div>}
          </div>
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="btn flex-1">Cancelar</button>
            <button onClick={() => { onUndo(); setConfirming(false) }} className="btn flex-1" style={{ color: 'var(--accent)' }}>Desmarcar</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-[12px] w-full text-center py-1 transition-colors" style={{ color: 'var(--text-3)' }}>
            ¿Desmarcar?
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onComplete}
      className="btn btn-primary w-full"
      style={{
        height: 60,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.02em',
        boxShadow: '0 4px 16px rgba(255,87,34,0.35), 0 1px 0 rgba(255,255,255,0.2) inset',
      }}
    >
      Completar entreno →
    </button>
  )
}

// ── Entrenos extra (cardio / fútbol / gym libre) ────────────────────────────────

type ExtraType = 'swim' | 'bike' | 'run' | 'push' | 'pull' | 'fullbody' | 'bike_indoor' | 'swim_pool' | 'gym_free' | 'futbol'

const EXTRA_TYPES: { type: ExtraType; label: string; color: string }[] = [
  { type: 'run',         label: 'Correr',     color: '#FF5722' },
  { type: 'bike_indoor', label: 'Bici indoor',color: '#10B981' },
  { type: 'bike',        label: 'Bici',       color: '#34D399' },
  { type: 'swim',        label: 'Nado',       color: '#22D3EE' },
  { type: 'swim_pool',   label: 'Piscina',    color: '#0EA5E9' },
  { type: 'futbol',      label: 'Fútbol',     color: '#F97316' },
  { type: 'gym_free',    label: 'Gym libre',  color: '#F59E0B' },
  { type: 'push',        label: 'Push',       color: '#FF8A65' },
  { type: 'pull',        label: 'Pull',       color: '#A78BFA' },
]

function fmtExtraPace(s: WorkoutSession): string {
  if (!s.distanceKm || !s.durationMin) return ''
  if (s.type === 'swim' || s.type === 'swim_pool') {
    const sec = (s.durationMin * 60) / (s.distanceKm * 10)
    const m = Math.floor(sec / 60); const ss = Math.round(sec % 60)
    return `${m}:${ss.toString().padStart(2,'0')}/100m`
  }
  if (s.type === 'bike' || s.type === 'bike_indoor') {
    return `${(s.distanceKm / (s.durationMin / 60)).toFixed(1)} km/h`
  }
  if (s.type === 'run') {
    const sec = (s.durationMin * 60) / s.distanceKm
    const m = Math.floor(sec / 60); const ss = Math.round(sec % 60)
    return `${m}:${ss.toString().padStart(2,'0')}/km`
  }
  return ''
}

function ExtraWorkoutsBlock({ date }: { date: string }) {
  const extras = useLiveQuery(
    () => db.sessions.where('date').equals(date).filter(s => !!s.isExtra).toArray(),
    [date]
  )
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>Entrenos extra</span>
        <button
          onClick={() => { setAdding(a => !a); vibrate(15) }}
          className="text-[13px] font-medium"
          style={{ color: adding ? 'var(--text-3)' : 'var(--accent)' }}
        >
          {adding ? 'Cancelar' : '+ Añadir'}
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <AddExtraForm date={date} onDone={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {extras && extras.length > 0 && (
        <div className="space-y-2">
          {extras.map(s => <ExtraSessionCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  )
}

function AddExtraForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [type, setType] = useState<ExtraType>('run')
  const [title, setTitle] = useState('')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [rpe, setRpe] = useState('')
  const [pain, setPain] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = EXTRA_TYPES.find(t => t.type === type)!

  async function save() {
    setSaving(true)
    const dKm = distance ? Number(distance) : undefined
    const dMin = duration ? Number(duration) : undefined
    let avgPaceSecPerKm: number | undefined
    let avgPaceSec100m: number | undefined
    if (dKm && dMin) {
      if (type === 'swim' || type === 'swim_pool') avgPaceSec100m = (dMin * 60) / (dKm * 10)
      else if (type === 'run') avgPaceSecPerKm = (dMin * 60) / dKm
    }
    await db.sessions.add({
      date,
      type: type as WorkoutType,
      isExtra: true,
      extraTitle: title.trim() || undefined,
      startedAt: Date.now(),
      completedAt: Date.now(),
      notes: notes.trim(),
      distanceKm: dKm,
      durationMin: dMin,
      rpe: rpe ? Number(rpe) : undefined,
      painProvoked: pain ? Number(pain) : undefined,
      avgPaceSecPerKm,
      avgPaceSec100m,
    })
    vibrate([40, 20, 80])
    setSaving(false)
    onDone()
  }

  const isEndurance = type === 'run' || type === 'bike' || type === 'bike_indoor' || type === 'swim' || type === 'swim_pool'

  return (
    <div className="card p-4 space-y-4">
      {/* Type selector */}
      <div>
        <div className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>Tipo</div>
        <div className="grid grid-cols-3 gap-1.5">
          {EXTRA_TYPES.map(t => (
            <button
              key={t.type}
              onClick={() => { setType(t.type); vibrate(8) }}
              className="rounded-lg py-2.5 px-2 flex items-center justify-center gap-1.5 transition-colors"
              style={type === t.type
                ? { background: 'var(--surface-3)', border: '1px solid var(--border-strong)' }
                : { background: 'transparent', border: '1px solid var(--border)' }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
              <span className="text-[12px] font-medium" style={{ color: type === t.type ? 'var(--text)' : 'var(--text-2)' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title (optional) */}
      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Título (opcional)</span>
        <input className="input mt-1.5" placeholder={`${selected.label}`} value={title} onChange={e => setTitle(e.target.value)} />
      </label>

      {/* Metrics */}
      {isEndurance ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Distancia (km)</span>
            <input className="input mt-1.5 num" inputMode="decimal" placeholder="0.0" value={distance} onChange={e => setDistance(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Duración (min)</span>
            <input className="input mt-1.5 num" inputMode="decimal" placeholder="0" value={duration} onChange={e => setDuration(e.target.value)} />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Duración (min)</span>
          <input className="input mt-1.5 num" inputMode="decimal" placeholder="0" value={duration} onChange={e => setDuration(e.target.value)} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>RPE 1-10</span>
          <input className="input mt-1.5 num" inputMode="decimal" placeholder="—" value={rpe} onChange={e => setRpe(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Dolor lumbar 0-10</span>
          <input className="input mt-1.5 num" inputMode="decimal" placeholder="—" value={pain} onChange={e => setPain(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Notas</span>
        <input className="input mt-1.5" placeholder="Sensaciones" value={notes} onChange={e => setNotes(e.target.value)} />
      </label>

      {/* Live pace preview */}
      {isEndurance && distance && duration && (() => {
        const dKm = Number(distance); const dMin = Number(duration)
        if (!dKm || !dMin) return null
        let pace = ''
        if (type === 'swim' || type === 'swim_pool') { const s = (dMin*60)/(dKm*10); pace = `${Math.floor(s/60)}:${Math.round(s%60).toString().padStart(2,'0')}/100m` }
        else if (type === 'bike' || type === 'bike_indoor') { pace = `${(dKm/(dMin/60)).toFixed(1)} km/h` }
        else { const s = (dMin*60)/dKm; pace = `${Math.floor(s/60)}:${Math.round(s%60).toString().padStart(2,'0')}/km` }
        return (
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Ritmo</span>
            <span className="num font-semibold" style={{ color: 'var(--text)', fontSize: 24, letterSpacing: '-0.02em' }}>{pace}</span>
          </div>
        )
      })()}

      <button
        onClick={save}
        disabled={saving}
        className="btn btn-primary w-full"
        style={{ height: 44, opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Guardando…' : `Guardar ${selected.label.toLowerCase()}`}
      </button>
    </div>
  )
}

function ExtraSessionCard({ session: s }: { session: WorkoutSession }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const meta = EXTRA_TYPES.find(t => t.type === s.type)
  const pace = fmtExtraPace(s)
  const label = s.extraTitle || `${meta?.label ?? s.type}`

  async function del() {
    await db.sessions.delete(s.id!)
    vibrate(30)
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: meta?.color ?? 'var(--text-3)' }} />
          <div className="min-w-0">
            <div className="text-[15px] font-medium truncate" style={{ color: 'var(--text)' }}>{label}</div>
            <div className="flex items-center gap-3 mt-1 text-[12px] flex-wrap" style={{ color: 'var(--text-2)' }}>
              {s.distanceKm && <span><span className="num" style={{ color: 'var(--text)' }}>{s.distanceKm}</span> km</span>}
              {s.durationMin && <span><span className="num" style={{ color: 'var(--text)' }}>{s.durationMin}</span> min</span>}
              {pace && <span className="num" style={{ color: 'var(--text)' }}>{pace}</span>}
              {s.rpe && <span>RPE <span className="num" style={{ color: 'var(--text)' }}>{s.rpe}</span></span>}
              {s.painProvoked != null && <span style={{ color: painColor(s.painProvoked) }}>dolor <span className="num">{s.painProvoked}</span></span>}
            </div>
            {s.notes && <div className="text-[12px] mt-1 truncate" style={{ color: 'var(--text-3)' }}>{s.notes}</div>}
          </div>
        </div>
        <div className="shrink-0">
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDel(false)} className="text-[12px]" style={{ color: 'var(--text-3)' }}>No</button>
              <button onClick={del} className="text-[12px] font-medium" style={{ color: 'var(--red)' }}>Borrar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="text-[18px] px-1" style={{ color: 'var(--text-3)' }}>×</button>
          )}
        </div>
      </div>
    </div>
  )
}

function NotesField({ date }: { date: string }) {
  const session = useLiveQuery(() => db.sessions.where('date').equals(date).filter(s => !s.isExtra).first(), [date])
  const [notes, setNotes] = useState('')
  useEffect(() => { if (session) setNotes(session.notes ?? '') }, [session?.id])
  const status = useAutosave(notes, async (v) => {
    let s = await db.sessions.where('date').equals(date).filter(s => !s.isExtra).first()
    if (!s) {
      const id = await db.sessions.add({ date, type: 'rest', startedAt: Date.now(), notes: v, isExtra: false })
      s = await db.sessions.get(id)
    } else {
      await db.sessions.update(s.id!, { notes: v })
    }
  })
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>Notas del día</span>
        <SaveIndicator status={status} />
      </div>
      <textarea rows={3} className="input resize-none" placeholder="Sensaciones, dolor, contexto…"
                value={notes} onChange={e => setNotes(e.target.value)} />
    </div>
  )
}
