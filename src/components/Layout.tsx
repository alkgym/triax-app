import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './BottomNav'
import { InjuryStatusBar } from './InjuryStatusBar'
import { QuickAddFab } from './QuickAddFab'

export function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-[100dvh] pb-32 max-w-[480px] mx-auto w-full">
      <InjuryStatusBar />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <QuickAddFab />
      <BottomNav />
    </div>
  )
}
