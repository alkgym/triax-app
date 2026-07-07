import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { db, type BpLog } from '../db/schema'
import { todayIso } from '../lib/dates'
import { vibrate } from '../db/hooks'
import { bpCategory, bluetoothAvailable, readBloodPressure, type BpProgress } from '../lib/bp'

export function BloodPressurePanel() {
  // Orden cronológico REAL (por fecha del registro, no por cuándo se tecleó):
  // así una lectura antigua añadida hoy no descuadra la gráfica ni la "última".
  const logs = useLiveQuery(async () => {
    const all = await db.bpLogs.toArray()
    return all.sort((a, b) => a.date === b.date ? a.timestamp - b.timestamp : a.date.localeCompare(b.date))
  })
  const latest = logs?.[logs.length - 1]

  const chartData = (logs ?? []).slice(-30).map(l => ({
    date: l.date.slice(5), sys: l.sys, dia: l.dia,
  }))

  return (
    <div className="space-y-3">
      {/* Última lectura */}
      {latest && (() => {
        const cat = bpCategory(latest.sys, latest.dia)
        return (
          <div className="card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Última tensión</div>
              <div className="text-[12px] mt-1 font-semibold" style={{ color: cat.color }}>{cat.label}</div>
              <div className="text-[11px] num mt-0.5" style={{ color: 'var(--text-3)' }}>
                {latest.date}{latest.pulse ? ` · ${latest.pulse} lpm` : ''}{latest.source !== 'manual' ? ' · 📡' : ''}
              </div>
            </div>
            <div className="num font-bold text-right" style={{ fontSize: 34, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)' }}>
              {latest.sys}<span style={{ color: 'var(--text-3)', fontSize: 18 }}>/</span>{latest.dia}
              <div className="text-[10px] font-normal mt-1" style={{ color: 'var(--text-3)', letterSpacing: 0 }}>mmHg</div>
            </div>
          </div>
        )
      })()}

      <BpCapture />

      {chartData.length >= 2 && (
        <div className="card p-3 h-56">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#A9A39A" fontSize={10} />
              <YAxis stroke="#A9A39A" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
              <ReferenceLine y={140} stroke="#F59E0B" strokeDasharray="4 4" />
              <ReferenceLine y={90} stroke="#F59E0B" strokeDasharray="4 4" />
              <Line name="Sistólica" type="monotone" dataKey="sys" stroke="#FF6B2B" strokeWidth={2} dot={{ fill: '#FF6B2B', r: 3 }} />
              <Line name="Diastólica" type="monotone" dataKey="dia" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(logs ?? []).length > 0 && (
        <div className="card p-3 space-y-1">
          {(logs ?? []).slice().reverse().slice(0, 15).map(l => <BpRow key={l.id} log={l} />)}
        </div>
      )}
    </div>
  )
}

function BpCapture() {
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function saveManual() {
    const s = Number(sys), d = Number(dia)
    if (!s || !d) return
    await db.bpLogs.add({
      date, timestamp: Date.now(), sys: s, dia: d,
      pulse: pulse ? Number(pulse) : undefined, source: 'manual',
    })
    setSys(''); setDia(''); setPulse('')
    vibrate(20)
  }

  const [failedOnce, setFailedOnce] = useState(false)
  const [log, setLog] = useState<string[]>([])

  async function readBle(anyDevice = false) {
    setBusy(true); setStatus(''); setLog([])
    try {
      const r = await readBloodPressure((p: BpProgress) => setStatus(p.message), {
        anyDevice,
        onLog: line => setLog(l => [...l, line].slice(-60)),
      })
      await db.bpLogs.add({
        date: todayIso(), timestamp: Date.now(),
        sys: r.sys, dia: r.dia, pulse: r.pulse, source: r.source,
      })
      setStatus(`✓ ${r.sys}/${r.dia}${r.pulse ? ` · ${r.pulse} lpm` : ''} guardado`)
      setFailedOnce(false)
      vibrate([40, 20, 80])
    } catch (e) {
      setStatus(`✕ ${e instanceof Error ? e.message : 'Error de conexión'}`)
      setFailedOnce(true)
    } finally {
      setBusy(false)
      setTimeout(() => setStatus(s => s.startsWith('✓') ? '' : s), 4000)
    }
  }

  async function copyLog() {
    try { await navigator.clipboard.writeText(log.join('\n')); vibrate(20) } catch { /* sin permiso */ }
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Registrar tensión</div>
      <div className="flex gap-2">
        <input type="date" className="input shrink-0" style={{ width: 130 }} value={date} onChange={e => setDate(e.target.value)} />
        <input className="input num" inputMode="numeric" placeholder="SYS" value={sys} onChange={e => setSys(e.target.value)} />
        <input className="input num" inputMode="numeric" placeholder="DIA" value={dia} onChange={e => setDia(e.target.value)} />
        <input className="input num" inputMode="numeric" placeholder="♥" value={pulse} onChange={e => setPulse(e.target.value)} />
        <button className="btn btn-primary shrink-0" onClick={saveManual}>+</button>
      </div>
      {bluetoothAvailable() ? (
        <>
          <button className="btn w-full" onClick={() => readBle(false)} disabled={busy}>
            {busy ? 'Conectado — mide en el aparato…' : '📡 Leer del tensiómetro (Checkme / BLE)'}
          </button>
          {failedOnce && !busy && (
            <>
              <button className="btn w-full" onClick={() => readBle(true)}>
                🔍 ¿No aparece? Buscar TODOS los dispositivos
              </button>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                Si el tensiómetro no sale en la lista: cierra del todo la app ViHealth/Checkme
                (solo admite una conexión a la vez) y asegúrate de que la pantalla del aparato está encendida.
              </div>
            </>
          )}
        </>
      ) : (
        <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Lectura directa del Checkme disponible en Chrome (Android/escritorio). En iPhone, registra a mano.
        </div>
      )}
      {log.length > 0 && (
        <div className="rounded-lg p-2 space-y-1" style={{ background: '#0a0a0a', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>Diagnóstico BLE</span>
            <button onClick={copyLog} className="text-[11px] px-2 py-0.5 rounded" style={{ color: 'var(--accent)', border: '1px solid var(--border-strong)' }}>Copiar</button>
          </div>
          <pre className="num text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap" style={{ color: 'var(--text-2)', maxHeight: 180 }}>
{log.join('\n')}
          </pre>
        </div>
      )}
      {status && (
        <div className="text-[12px] p-2 rounded" style={{
          color: status.startsWith('✓') ? 'var(--green)' : status.startsWith('✕') ? 'var(--red)' : 'var(--text-2)',
          background: 'var(--surface-2)',
        }}>{status}</div>
      )}
    </div>
  )
}

function BpRow({ log: l }: { log: BpLog }) {
  const [confirm, setConfirm] = useState(false)
  const cat = bpCategory(l.sys, l.dia)
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span style={{ color: 'var(--text-3)' }}>{l.date}{l.source !== 'manual' ? ' 📡' : ''}</span>
      <div className="flex items-center gap-2">
        <span className="num" style={{ color: cat.color }}>{l.sys}/{l.dia}</span>
        {l.pulse != null && <span className="num text-[11px]" style={{ color: 'var(--text-3)' }}>{l.pulse} lpm</span>}
        {confirm ? (
          <div className="flex gap-1">
            <button onClick={() => setConfirm(false)} className="text-[11px] px-1.5" style={{ color: 'var(--text-3)' }}>No</button>
            <button onClick={async () => { await db.bpLogs.delete(l.id!); setConfirm(false) }} className="text-[11px] px-1.5" style={{ color: '#EF4444' }}>Borrar</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="px-1" style={{ color: 'var(--text-3)' }}>✕</button>
        )}
      </div>
    </div>
  )
}
