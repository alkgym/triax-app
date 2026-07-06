import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink } from 'react-router-dom'
import { db } from '../db/schema'
import { suggestedPhase, morningWindow } from '../lib/rehab'
import { painColor } from '../lib/ui'
import { SpineLogo } from './Brand'

// Cabecera compacta: marca a la izquierda + pill de estado de la lesión a la
// derecha (dolor actual + fase). Hairline inferior proporcional al dolor.
export function InjuryStatusBar() {
  const logs = useLiveQuery(() => db.painLogs.orderBy('date').toArray())
  const sorted = (logs ?? []).slice().sort((a, b) => (a.date + a.timestamp).localeCompare(b.date + b.timestamp))
  const latest = sorted[sorted.length - 1]
  const hasData = !!latest
  const level = latest?.level ?? 0
  const phase = suggestedPhase(level)
  const mw = morningWindow()
  const c = hasData ? painColor(level) : '#585855'

  return (
    <div className="sticky top-0 z-20"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: 'color-mix(in srgb, var(--bg) 86%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
      <div className="flex items-center justify-between px-4" style={{ height: 54 }}>
        <div className="flex items-center gap-2">
          <SpineLogo size={24} />
          <span className="font-semibold tracking-tight text-[16px]" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>GYM</span>
        </div>
        <div className="flex items-center gap-2">
          {mw.active && (
            <span className="text-[10px] font-medium px-2 py-1 rounded-full"
              style={{ color: '#EF4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)' }}>
              🌅 {mw.minsLeft}′
            </span>
          )}
          <NavLink to="/lesion"
            className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full active:opacity-60 transition-opacity"
            style={{
              border: `1px solid ${hasData ? c + '55' : 'var(--border-strong)'}`,
              background: hasData ? `${c}14` : 'var(--surface-1)',
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: hasData ? `0 0 6px ${c}` : 'none' }} />
            {hasData ? (
              <span className="text-[11.5px] font-semibold num" style={{ color: c }}>
                dolor {level}<span style={{ opacity: 0.6 }}>/10</span> · F{phase}
              </span>
            ) : (
              <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-2)' }}>Registrar dolor</span>
            )}
          </NavLink>
        </div>
      </div>
      {/* hairline de nivel de dolor */}
      <div className="h-[2px]" style={{ background: 'var(--border)' }}>
        <div className="h-full transition-all duration-500"
          style={{ width: hasData ? `${(level / 10) * 100}%` : '0%', background: c, boxShadow: `0 0 8px ${c}` }} />
      </div>
    </div>
  )
}
