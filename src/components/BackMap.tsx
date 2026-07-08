import type { PainLocation } from '../db/schema'

// Mapa lumbar — vista sagital (lateral) tipo resonancia. Posterior = izquierda
// (donde está el abombamiento). Tocas el disco L2-L3 / L3-L4 / L4-L5 y se marca
// con el bulto posterior en rojo. Pierna (radicular) y General como pastillas.

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'S1']
// disco situado DEBAJO de la vértebra i → id
const TARGETS: Record<number, PainLocation> = { 1: 'L2-L3', 2: 'L3-L4', 3: 'L4-L5' }

const X = 86           // centro horizontal de la columna
const Y_TOP = 18
const BODY_W = 50
const BODY_H = 24
const DISC_H = 12
const STEP = BODY_H + DISC_H

function lord(i: number) {
  // lordosis lumbar: las vértebras centrales se desplazan ligeramente hacia anterior (derecha)
  return Math.sin((i / (LEVELS.length - 1)) * Math.PI) * 9
}
function bodyCx(i: number) { return X + lord(i) }
function bodyY(i: number) { return Y_TOP + i * STEP }

export function BackMap({ selected, onToggle }: { selected: PainLocation[]; onToggle: (l: PainLocation) => void }) {
  const has = (l: PainLocation) => selected.includes(l)
  const totalH = Y_TOP + LEVELS.length * STEP + 10

  return (
    <div>
      <div className="rounded-2xl p-3 flex justify-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <svg width="190" height={totalH} viewBox={`0 0 190 ${totalH}`} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="bone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3a3a40" />
              <stop offset="45%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#34343a" />
            </linearGradient>
            <linearGradient id="boneActive" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5a5a64" />
              <stop offset="100%" stopColor="#43434b" />
            </linearGradient>
            <radialGradient id="discGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="discSel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>

          {/* contorno suave de la espalda (contexto) */}
          <path
            d={`M ${X - 40} ${Y_TOP - 6}
                C ${X - 52} ${totalH * 0.3}, ${X - 50} ${totalH * 0.7}, ${X - 30} ${totalH - 4}`}
            fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

          {/* canal medular (línea posterior) */}
          <path
            d={LEVELS.map((_, i) => `${i === 0 ? 'M' : 'L'} ${bodyCx(i) - BODY_W / 2 - 4} ${bodyY(i) + BODY_H / 2}`).join(' ')}
            fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.6" />

          {/* discos no objetivo (L1-L2, L5-S1) */}
          {[0, 4].map(i => {
            const cx = (bodyCx(i) + bodyCx(i + 1)) / 2
            const y = bodyY(i) + BODY_H + DISC_H / 2
            return <ellipse key={`d${i}`} cx={cx} cy={y} rx={BODY_W / 2 - 3} ry={DISC_H / 2 - 1} fill="#2c2c32" />
          })}

          {/* vértebras */}
          {LEVELS.map((lv, i) => {
            const cx = bodyCx(i)
            const y = bodyY(i)
            const adjacent = Object.entries(TARGETS).some(([di, id]) => has(id) && (Number(di) === i || Number(di) === i - 1))
            const isSacrum = lv === 'S1'
            return (
              <g key={lv}>
                {/* cuerpo vertebral */}
                <rect x={cx - BODY_W / 2} y={y} width={BODY_W} height={BODY_H} rx={8}
                  fill={adjacent ? 'url(#boneActive)' : 'url(#bone)'}
                  stroke={adjacent ? '#71717a' : '#26262b'} strokeWidth="1" />
                {/* apófisis espinosa (posterior, izquierda) */}
                {!isSacrum && (
                  <path d={`M ${cx - BODY_W / 2} ${y + 5} q -12 ${BODY_H / 2 - 5} 0 ${BODY_H - 10}`}
                    fill="none" stroke="url(#bone)" strokeWidth="5" strokeLinecap="round" />
                )}
                {/* etiqueta del nivel */}
                <text x={cx + BODY_W / 2 + 24} y={y + BODY_H / 2 + 3} fontSize="9"
                  fill="var(--text-3)" fontFamily="ui-monospace, monospace" textAnchor="end">{lv}</text>
              </g>
            )
          })}

          {/* discos objetivo (tappables) */}
          {Object.entries(TARGETS).map(([di, id]) => {
            const i = Number(di)
            const cx = (bodyCx(i) + bodyCx(i + 1)) / 2
            const y = bodyY(i) + BODY_H + DISC_H / 2
            const sel = has(id)
            const rx = BODY_W / 2 - 2
            const ry = DISC_H / 2
            return (
              <g key={id} onClick={() => onToggle(id)} style={{ cursor: 'pointer' }}>
                {/* glow + pulso al seleccionar */}
                {sel && (
                  <circle cx={cx - rx + 2} cy={y} r="22" fill="url(#discGlow)">
                    <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* área de toque amplia */}
                <rect x={cx - rx - 10} y={y - DISC_H} width={rx * 2 + 20} height={DISC_H * 2} fill="transparent" />
                {/* disco */}
                <ellipse cx={cx} cy={y} rx={rx} ry={ry}
                  fill={sel ? 'url(#discSel)' : '#46464d'} stroke={sel ? '#EF4444' : '#55555c'} strokeWidth="1" />
                {/* abombamiento posterior (izquierda) cuando hay dolor */}
                {sel && (
                  <path d={`M ${cx - rx + 3} ${y - ry + 1} q -9 ${ry} 0 ${ry * 2 - 2}`}
                    fill="url(#discSel)" stroke="#EF4444" strokeWidth="0.5" />
                )}
                {/* etiqueta con guía */}
                <line x1={cx + rx} y1={y} x2={cx + BODY_W / 2 + 16} y2={y} stroke={sel ? '#EF4444' : 'var(--border-strong)'} strokeWidth="1" />
                <text x={cx + BODY_W / 2 + 20} y={y + 3} fontSize="9.5" fontWeight="600"
                  fill={sel ? '#EF4444' : 'var(--text-2)'} fontFamily="ui-monospace, monospace">{id.replace('-', '·')}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* radicular + general */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {(['radicular', 'general'] as PainLocation[]).map(l => (
          <button key={l} type="button" onClick={() => onToggle(l)}
            className="px-2 py-2 rounded-lg text-[12px] font-medium transition-colors"
            style={has(l)
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
              : { color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            {l === 'radicular' ? '⚡ Pierna (radicular)' : 'General'}
          </button>
        ))}
      </div>
    </div>
  )
}
