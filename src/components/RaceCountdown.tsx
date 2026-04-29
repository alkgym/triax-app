import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { daysUntilRace } from '../db/seed'
import { StreakChip } from './StreakChip'

export function RaceCountdown() {
  const profile = useLiveQuery(() => db.profile.get('me'))
  const days = daysUntilRace()
  const weeksLeft = Math.max(0, Math.ceil(days / 7))
  return (
    <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur border-b border-line"
         style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 py-2 gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[.2em] text-bone2">Artiem Half · Menorca</div>
          <div className="display text-bone text-base leading-none mt-0.5 truncate">{profile?.raceDate ?? '2026-09-27'}</div>
          <div className="mt-1"><StreakChip /></div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[.2em] text-bone2">Faltan</div>
          <div className="display text-orange text-3xl leading-none mt-0.5">{days < 0 ? '—' : days}<span className="text-bone2 text-sm ml-1">días</span></div>
          <div className="text-[10px] text-bone2 mono">~{weeksLeft} semanas</div>
        </div>
      </div>
    </div>
  )
}
