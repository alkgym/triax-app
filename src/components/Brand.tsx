import { useId } from 'react'

// Marca de la app: espina minimalista + wordmark. El degradado usa un id único
// por instancia para poder renderizar varias a la vez sin colisiones de <defs>.

export function SpineLogo({ size = 24 }: { size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sw${id}`} x1="18" y1="10" x2="46" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFB088" />
          <stop offset="0.5" stopColor="#FF7B3A" />
          <stop offset="1" stopColor="#FF5722" />
        </linearGradient>
      </defs>
      <g fill={`url(#sw${id})`}>
        <rect x="25" y="12" width="14" height="6.2" rx="3.1" />
        <rect x="23.5" y="21.4" width="18.5" height="6.2" rx="3.1" />
        <rect x="23.2" y="30.8" width="19.2" height="6.2" rx="3.1" />
        <rect x="24.5" y="40.2" width="17.5" height="6.2" rx="3.1" />
        <rect x="26" y="49.6" width="14.5" height="6.2" rx="3.1" />
      </g>
    </svg>
  )
}

export function Brand({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <SpineLogo size={size} />
      <span className="font-semibold tracking-tight" style={{ color: 'var(--text)', fontSize: size * 0.58, letterSpacing: '-0.04em' }}>GYM</span>
    </div>
  )
}
