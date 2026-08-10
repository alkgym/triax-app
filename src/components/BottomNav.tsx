import { NavLink } from 'react-router-dom'

const STROKE = 1.6

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10v9.5a.5.5 0 00.5.5h4v-6h5v6h4a.5.5 0 00.5-.5V10" />
    </svg>
  )
}

function IconRoutines({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
      <path d="M6.5 6.5v11M9.5 8.5v7M14.5 8.5v7M17.5 6.5v11" />
      <path d="M9.5 12h5" />
      <path d="M4 9.5v5M20 9.5v5" />
    </svg>
  )
}

function IconStats({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
      <path d="M4 19h16" />
      <path d="M7 19v-7" />
      <path d="M12 19v-11" />
      <path d="M17 19v-5" />
    </svg>
  )
}

function IconInjury({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
      <path d="M12 3v18" />
      <path d="M9 6h6M8.5 9.5h7M8 13h8M9 16.5h6" />
    </svg>
  )
}

function IconSettings({ active }: { active: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.05a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.05a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.05a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87 1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.05a1.7 1.7 0 00-1.55 1z" />
    </svg>
  )
}

const tabs = [
  { to: '/',         label: 'Hoy',     Icon: IconHome     },
  { to: '/rutinas',  label: 'Rutinas', Icon: IconRoutines },
  { to: '/progreso', label: 'Stats',   Icon: IconStats    },
  { to: '/lesion',   label: 'Lesión',  Icon: IconInjury   },
  { to: '/ajustes',  label: 'Ajustes', Icon: IconSettings },
]

// Dock flotante glass — centrado, redondeado, con blur y pill de activo.
export function BottomNav() {
  return (
    <nav className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div className="pointer-events-auto flex items-center gap-0.5 px-1.5 py-1.5 rounded-[22px] w-full max-w-[400px] justify-between"
        style={{
          background: 'rgba(15,15,19,0.85)',
          border: '1px solid var(--border-strong)',
          backdropFilter: 'blur(22px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
          boxShadow: '0 16px 44px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset',
        }}>
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-colors active:scale-95"
            style={({ isActive }) => (isActive
              ? { background: 'color-mix(in srgb, var(--accent) 13%, transparent)' }
              : {})}
          >
            {({ isActive }) => (
              <>
                <t.Icon active={isActive} />
                <span className="text-[9.5px] font-medium tracking-tight"
                  style={{ color: isActive ? 'var(--text)' : 'var(--text-3)' }}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
