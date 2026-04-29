import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { RaceCountdown } from './RaceCountdown'

export function Layout() {
  return (
    <div className="min-h-[100dvh] pb-24 max-w-[480px] mx-auto w-full">
      <RaceCountdown />
      <Outlet />
      <BottomNav />
    </div>
  )
}
