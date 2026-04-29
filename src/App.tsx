import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Today from './screens/Today'
import Week from './screens/Week'
import Progress from './screens/Progress'
import Plan, { PlanDayDetail } from './screens/Plan'
import Edit from './screens/Edit'
import { seedIfEmpty } from './db/seed'
import { scheduleTodayReminder } from './lib/notifications'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    seedIfEmpty().then(() => {
      setReady(true)
      scheduleTodayReminder().catch(() => {})
    })
  }, [])
  if (!ready) return <div className="min-h-screen flex items-center justify-center"><div className="display text-orange text-3xl">TRI·AX</div></div>
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="/entrena/:date" element={<Today />} />
          <Route path="/semana" element={<Week />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/:date" element={<PlanDayDetail />} />
          <Route path="/ajustes" element={<Edit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
