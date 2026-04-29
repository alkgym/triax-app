import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { computeStreak, totalCompleted } from '../db/queries'

export function StreakChip() {
  // Re-compute when sessions change
  const sessionCount = useLiveQuery(() => db.sessions.count())
  const [streak, setStreak] = useState(0)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    computeStreak().then(setStreak)
    totalCompleted().then(setTotal)
  }, [sessionCount])

  return (
    <div className="flex items-center gap-1.5">
      <span className="chip border-orange text-orange">🔥 {streak}d</span>
      <span className="chip text-bone2">✓ {total}</span>
    </div>
  )
}
