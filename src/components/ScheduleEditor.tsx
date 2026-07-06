import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkoutType } from '../db/schema'
import { todayIso } from '../lib/dates'
import { vibrate } from '../db/hooks'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const CYCLE: WorkoutType[] = ['rest', 'push', 'pull', 'legs', 'torso', 'fullbody']
const META: Record<string, { label: string; color: string }> = {
  rest:     { label: 'Descanso', color: '#3a3a3e' },
  push:     { label: 'Push',     color: '#FF6B2B' },
  pull:     { label: 'Pull',     color: '#3B82F6' },
  legs:     { label: 'Legs',     color: '#10F4A0' },
  torso:    { label: 'Torso',    color: '#22D3EE' },
  fullbody: { label: 'Full',     color: '#A855F7' },
}

export function ScheduleEditor() {
  const schedule = useLiveQuery(() => db.schedule.toArray())
  const byDow = new Map<number, WorkoutType>()
  for (const s of schedule ?? []) byDow.set(s.dow, s.type)

  async function cycle(dow: number) {
    const cur = byDow.get(dow) ?? 'rest'
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]
    await db.schedule.put({ dow, type: next })
    vibrate(12)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>Horario semanal</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>toca para cambiar</div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DOW.map((d, dow) => {
          const type = byDow.get(dow) ?? 'rest'
          const m = META[type]
          const isRest = type === 'rest'
          return (
            <button key={dow} onClick={() => cycle(dow)} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{d}</span>
              <div className="w-full rounded-lg py-2 px-0.5 flex items-center justify-center transition-colors"
                style={{
                  background: isRest ? 'var(--surface-2)' : `${m.color}22`,
                  border: `1px solid ${isRest ? 'var(--border)' : m.color + '66'}`,
                }}>
                <span className="text-[10px] font-semibold leading-tight text-center" style={{ color: isRest ? 'var(--text-3)' : m.color }}>
                  {m.label === 'Descanso' ? '·' : m.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Rutina programada para una fecha ISO concreta (o 'rest'). */
export function useScheduledType(dateIso: string): WorkoutType | null {
  const schedule = useLiveQuery(() => db.schedule.toArray())
  if (!schedule) return null
  const dow = (new Date(dateIso + 'T00:00:00').getDay() + 6) % 7 // lun=0
  return schedule.find(s => s.dow === dow)?.type ?? 'rest'
}

/** Devuelve la rutina programada para hoy (o 'rest'). */
export function useTodayScheduledType(): WorkoutType | null {
  return useScheduledType(todayIso())
}
