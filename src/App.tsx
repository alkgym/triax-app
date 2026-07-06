import { Component, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Today from './screens/Today'
import Rutinas from './screens/Rutinas'
import Progress from './screens/Progress'
import Lesion from './screens/Lesion'
import Edit from './screens/Edit'
import { seedIfEmpty } from './db/seed'
import { scheduleTodayReminder } from './lib/notifications'
import { maybeAutoBackup } from './lib/autobackup'
import { installSyncTracker, initSyncState, autoSync, isAutoSync, requestPersistentStorage } from './lib/sync'
import { Brand } from './components/Brand'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Brand size={44} />
          <div className="text-[15px] font-medium" style={{ color: 'var(--text-2)' }}>Algo salió mal</div>
          <div className="text-[12px] num p-3 rounded-lg max-w-sm break-all"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            {(this.state.error as Error).message}
          </div>
          <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.href = '/' }}>
            Reiniciar app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    seedIfEmpty().then(async () => {
      setReady(true)
      scheduleTodayReminder().catch(() => {})
      maybeAutoBackup().catch(() => {})
      // Orden importante: decidir subir/bajar (initSyncState) ANTES de conectar
      // el tracker, para que el sembrado de datos por defecto no cuente como
      // cambio (si no, un dispositivo nuevo pisaría los datos buenos de otro).
      await initSyncState()
      installSyncTracker()
      requestPersistentStorage().catch(() => {})
      if (isAutoSync()) autoSync().catch(() => {})
    })

    // Sincroniza al cerrar/ocultar la app y al recuperar conexión.
    const onHide = () => { if (document.visibilityState === 'hidden' && isAutoSync()) autoSync().catch(() => {}) }
    const onOnline = () => { if (isAutoSync()) autoSync().catch(() => {}) }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => { if (isAutoSync()) autoSync().catch(() => {}) }, 120_000)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [])
  if (!ready) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="shimmer-glow"><Brand size={48} /></div>
      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Cargando</div>
    </div>
  )
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="/rutinas" element={<Rutinas />} />
            <Route path="/progreso" element={<Progress />} />
            <Route path="/lesion" element={<Lesion />} />
            <Route path="/ajustes" element={<Edit />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
