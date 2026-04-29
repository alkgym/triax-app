import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Hoy', icon: '◉' },
  { to: '/semana', label: 'Semana', icon: '▤' },
  { to: '/progreso', label: 'Progreso', icon: '▲' },
  { to: '/plan', label: 'Plan', icon: '▦' },
  { to: '/ajustes', label: 'Edit', icon: '✎' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-ink/90 backdrop-blur border-t border-line"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5 max-w-[480px] mx-auto">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-[10px] uppercase tracking-wider transition active:scale-95 ${isActive ? 'text-orange' : 'text-bone2'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="font-semibold">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
