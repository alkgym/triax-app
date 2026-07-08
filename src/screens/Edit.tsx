import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ExerciseTemplate, type WorkoutType, type MuscleGroup } from '../db/schema'
import { useAutosave } from '../db/hooks'
import { SaveIndicator } from '../components/SaveIndicator'
import { requestNotifPermission, scheduleTodayReminder } from '../lib/notifications'
import { GearPanel } from '../components/GearPanel'
import { todayIso } from '../lib/dates'
import { reinstallTemplates, hasCanonicalRoutine } from '../db/plans/pplt'
import { ScreenHeader } from '../components/ScreenHeader'

const GYM_TYPES: WorkoutType[] = ['push', 'pull', 'legs', 'torso', 'fullbody']

const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'pecho', label: 'Pecho' }, { id: 'espalda', label: 'Espalda' }, { id: 'hombro', label: 'Hombro' },
  { id: 'biceps', label: 'Bíceps' }, { id: 'triceps', label: 'Tríceps' }, { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquios', label: 'Isquios' }, { id: 'gluteo', label: 'Glúteo' }, { id: 'gemelo', label: 'Gemelo' },
  { id: 'core', label: 'Core' },
]

type Tab = 'perfil' | 'plantillas' | 'material' | 'datos'

export default function Edit() {
  const [tab, setTab] = useState<Tab>('plantillas')
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <ScreenHeader title="Ajustes" />

      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        {(['perfil','plantillas','material','datos'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="py-2 text-[12px] font-medium rounded-lg capitalize transition-colors"
            style={tab === t
              ? { background: 'var(--surface-3)', color: 'var(--text)' }
              : { color: 'var(--text-3)' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'perfil' && <ProfilePanel />}
      {tab === 'plantillas' && <TemplatesPanel />}
      {tab === 'material' && <GearPanel />}
      {tab === 'datos' && <DataPanel />}
    </div>
  )
}

function ProfilePanel() {
  const profile = useLiveQuery(() => db.profile.get('me'))
  const [draft, setDraft] = useState(profile)
  useEffect(() => { if (profile) setDraft(profile) }, [profile?.id])
  const status = useAutosave(draft, async (v) => { if (v) await db.profile.put(v as any) })
  if (!draft) return null
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>Perfil</div>
        <SaveIndicator status={status} />
      </div>
      <Row label="Nombre"><input className="input" value={draft.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} /></Row>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Edad"><input className="input num" inputMode="numeric" value={draft.edad} onChange={e => setDraft({ ...draft, edad: Number(e.target.value || 0) })} /></Row>
        <Row label="Altura cm"><input className="input num" inputMode="numeric" value={draft.altura} onChange={e => setDraft({ ...draft, altura: Number(e.target.value || 0) })} /></Row>
        <Row label="Peso kg"><input className="input num" inputMode="decimal" value={draft.pesoInicial} onChange={e => setDraft({ ...draft, pesoInicial: Number(e.target.value || 0) })} /></Row>
      </div>
      <Row label="Objetivo"><input className="input" value={draft.objetivo} onChange={e => setDraft({ ...draft, objetivo: e.target.value })} /></Row>
      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>Macros objetivo</div>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Calorías"><input className="input num" value={draft.caloriasObj} onChange={e => setDraft({ ...draft, caloriasObj: Number(e.target.value || 0) })} /></Row>
          <Row label="Proteína g"><input className="input num" value={draft.proteinaObj} onChange={e => setDraft({ ...draft, proteinaObj: Number(e.target.value || 0) })} /></Row>
          <Row label="Grasas g"><input className="input num" value={draft.grasasObj} onChange={e => setDraft({ ...draft, grasasObj: Number(e.target.value || 0) })} /></Row>
          <Row label="Carbos g"><input className="input num" value={draft.carbosObj} onChange={e => setDraft({ ...draft, carbosObj: Number(e.target.value || 0) })} /></Row>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function TemplatesPanel() {
  const [type, setType] = useState<WorkoutType>('push')
  const templates = useLiveQuery(() => db.exerciseTemplates.where('type').equals(type).toArray(), [type])
  const activeCount = (templates ?? []).filter(t => t.active).length

  async function addExercise() {
    const order = (templates?.length ?? 0) + 1
    await db.exerciseTemplates.add({ type, order, name: 'Nuevo ejercicio', series: 3, reps: '10', pesoUnidad: 'kg', active: true })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1 p-1 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        {GYM_TYPES.map(t => (
          <button key={t} onClick={() => setType(t)}
            className="py-2 text-[11px] font-medium rounded-lg capitalize transition-colors"
            style={type === t
              ? { background: 'var(--surface-3)', color: 'var(--text)' }
              : { color: 'var(--text-3)' }}>
            {t === 'fullbody' ? 'Full' : t}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{activeCount} ejercicios activos</span>
        {hasCanonicalRoutine(type) && <ReinstallButton type={type} />}
      </div>

      <div className="space-y-2">
        {(templates ?? []).sort((a, b) => a.order - b.order).map(t => <TemplateRow key={t.id} t={t} />)}
      </div>
      <button className="btn w-full" onClick={addExercise}>+ Añadir ejercicio</button>
    </div>
  )
}

function ReinstallButton({ type }: { type: WorkoutType }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function go() {
    setBusy(true); setMsg('')
    try {
      const n = await reinstallTemplates(type)
      setMsg(`✓ ${n} ejercicios cargados`)
      setConfirm(false)
    } catch {
      setMsg('✕ Error')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 3500)
    }
  }

  if (msg) {
    return <span className="text-[12px]" style={{ color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>
  }
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
        Reinstalar plantilla
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setConfirm(false)} className="text-[12px]" style={{ color: 'var(--text-3)' }}>No</button>
      <button onClick={go} disabled={busy} className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
        {busy ? '…' : 'Sustituir'}
      </button>
    </div>
  )
}

function TemplateRow({ t }: { t: ExerciseTemplate }) {
  const [draft, setDraft] = useState(t)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setDraft(t), [t.id])
  const status = useAutosave(draft, async v => { if (v.id) await db.exerciseTemplates.update(v.id, v as any) })

  async function remove() {
    await db.exerciseTemplates.update(t.id!, { active: false })
    setConfirmDelete(false)
  }
  async function move(delta: -1 | 1) {
    const all = await db.exerciseTemplates.where('type').equals(t.type).and(x => x.active).sortBy('order')
    const idx = all.findIndex(x => x.id === t.id)
    const swap = all[idx + delta]
    if (!swap) return
    await db.exerciseTemplates.update(t.id!, { order: swap.order })
    await db.exerciseTemplates.update(swap.id!, { order: t.order })
  }

  if (!t.active) return null
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={() => move(-1)} className="text-[14px] px-1.5 py-1" style={{ color: 'var(--text-3)' }}>↑</button>
        <button onClick={() => move(1)} className="text-[14px] px-1.5 py-1" style={{ color: 'var(--text-3)' }}>↓</button>
        <input className="input flex-1" style={{ fontWeight: 500 }} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <SaveIndicator status={status} />
        <button onClick={() => setExpanded(e => !e)} className="text-[12px] px-1.5" style={{ color: 'var(--text-3)' }}>
          {expanded ? '−' : '+'}
        </button>
        <button onClick={() => setConfirmDelete(true)} className="text-[18px] px-1" style={{ color: 'var(--text-3)' }}>×</button>
      </div>

      <div className="flex items-center gap-3 text-[12px] px-1" style={{ color: 'var(--text-2)' }}>
        <span><span className="num" style={{ color: 'var(--text)' }}>{draft.series}</span>×{draft.reps}</span>
        {draft.rir && <span>RIR {draft.rir}</span>}
        {draft.pesoSugerido != null && <span><span className="num" style={{ color: 'var(--text)' }}>{draft.pesoSugerido}</span>kg</span>}
        {draft.pesoUnidad === 'bw' && <span>BW</span>}
      </div>

      {confirmDelete && (
        <div className="flex items-center gap-2 rounded-lg p-2.5"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span className="text-[12px] flex-1" style={{ color: 'var(--text-2)' }}>¿Eliminar "{t.name}"?</span>
          <button onClick={remove} className="text-[12px] font-medium" style={{ color: 'var(--red)' }}>Eliminar</button>
          <button onClick={() => setConfirmDelete(false)} className="text-[12px]" style={{ color: 'var(--text-3)' }}>Cancelar</button>
        </div>
      )}

      {expanded && (
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Series"><input className="input num" inputMode="numeric" value={draft.series} onChange={e => setDraft({ ...draft, series: Number(e.target.value || 0) })} /></Row>
            <Row label="Reps"><input className="input num" value={draft.reps} onChange={e => setDraft({ ...draft, reps: e.target.value })} /></Row>
            <Row label="RIR"><input className="input num" value={draft.rir ?? ''} onChange={e => setDraft({ ...draft, rir: e.target.value })} /></Row>
            <Row label="Peso kg"><input className="input num" inputMode="decimal" value={draft.pesoSugerido ?? ''} onChange={e => setDraft({ ...draft, pesoSugerido: e.target.value === '' ? undefined : Number(e.target.value) })} /></Row>
          </div>
          <Row label="Notas"><input className="input" value={draft.notas ?? ''} onChange={e => setDraft({ ...draft, notas: e.target.value })} /></Row>
          <div>
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Grupo muscular</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {MUSCLE_GROUPS.map(mg => {
                const on = (draft.muscleGroups ?? []).includes(mg.id)
                return (
                  <button key={mg.id} type="button"
                    onClick={() => {
                      const cur = draft.muscleGroups ?? []
                      setDraft({ ...draft, muscleGroups: on ? cur.filter(x => x !== mg.id) : [...cur, mg.id] })
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                    style={on
                      ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                      : { color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                    {mg.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DataPanel() {
  const [notif, setNotif] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  async function enableNotif() {
    const result = await requestNotifPermission()
    setNotif(result)
    if (result === 'granted') scheduleTodayReminder().catch(() => {})
  }

  async function wipeAll() {
    await db.delete()
    location.reload()
  }

  async function exportData() {
    const dump = {
      exportedAt: todayIso(),
      profile: await db.profile.toArray(),
      planDays: await db.planDays.toArray(),
      exerciseTemplates: await db.exerciseTemplates.toArray(),
      sessions: await db.sessions.toArray(),
      sets: await db.sets.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      prs: await db.prs.toArray(),
      nutrition: await db.nutrition.toArray(),
      gear: await db.gear.toArray(),
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `triax-backup-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const dump = JSON.parse(text)
      if (dump.sessions?.length) {
        await db.sessions.clear()
        await db.sessions.bulkAdd(dump.sessions.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.sets?.length) {
        await db.sets.clear()
        await db.sets.bulkAdd(dump.sets.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.bodyMetrics?.length) {
        await db.bodyMetrics.clear()
        await db.bodyMetrics.bulkAdd(dump.bodyMetrics.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.prs?.length) {
        await db.prs.clear()
        await db.prs.bulkAdd(dump.prs.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.nutrition?.length) {
        await db.nutrition.clear()
        await db.nutrition.bulkAdd(dump.nutrition.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.gear?.length) {
        await db.gear.clear()
        await db.gear.bulkAdd(dump.gear.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.exerciseTemplates?.length) {
        await db.exerciseTemplates.clear()
        await db.exerciseTemplates.bulkAdd(dump.exerciseTemplates.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.painLogs?.length) {
        await db.painLogs.clear()
        await db.painLogs.bulkAdd(dump.painLogs.map((s: any) => { const { id: _id, ...rest } = s; return rest }))
      }
      if (dump.profile?.length) {
        await db.profile.bulkPut(dump.profile)
      }
      setImportMsg(`✓ Backup restaurado — ${dump.exportedAt ?? 'fecha desconocida'}`)
    } catch {
      setImportMsg('✕ Error leyendo el archivo')
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 space-y-2">
        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Notificaciones</div>
        <button
          className="btn w-full"
          onClick={enableNotif}
          style={notif === 'granted' ? { borderColor: 'var(--green)', color: 'var(--green)' } : {}}
        >
          {notif === 'granted'
            ? 'Recordatorio activo · 16:45'
            : notif === 'denied'
            ? 'Bloqueadas — actívalas en el navegador'
            : 'Activar recordatorio diario 16:45'}
        </button>
      </div>

      <div className="card p-4 space-y-2">
        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Backup</div>
        <button className="btn w-full" onClick={exportData}>Exportar backup JSON</button>
        <button className="btn w-full" onClick={() => importRef.current?.click()}>Importar backup</button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importData} />
        {importMsg && (
          <div className="text-[12px] p-2 rounded"
            style={{
              color: importMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
              background: 'var(--surface-2)',
            }}>
            {importMsg}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-2">
        <div className="text-[12px]" style={{ color: 'var(--red)' }}>Zona peligrosa</div>
        {!confirmWipe ? (
          <button className="btn w-full" style={{ color: 'var(--red)' }} onClick={() => setConfirmWipe(true)}>
            Borrar todos los datos
          </button>
        ) : (
          <div className="space-y-2 rounded-lg p-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
            <p className="text-[12px]" style={{ color: 'var(--red)' }}>Esto borrará sesiones, sets, métricas y plan. No hay vuelta atrás.</p>
            <div className="flex gap-2">
              <button onClick={wipeAll} className="btn flex-1" style={{ background: 'var(--red)', color: '#0a0a0a', border: 'none' }}>Borrar todo</button>
              <button onClick={() => setConfirmWipe(false)} className="btn btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
