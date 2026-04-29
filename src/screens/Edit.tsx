import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ExerciseTemplate, type WorkoutType } from '../db/schema'
import { useAutosave } from '../db/hooks'
import { SaveIndicator } from '../components/SaveIndicator'
import { buildPlanDays } from '../db/seed'
import { requestNotifPermission, scheduleTodayReminder } from '../lib/notifications'
import { GearPanel } from '../components/GearPanel'

const GYM_TYPES: WorkoutType[] = ['push', 'pull', 'fullbody']

export default function Edit() {
  const [tab, setTab] = useState<'perfil' | 'plantillas' | 'material' | 'datos'>('plantillas')
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <h1 className="display text-bone text-3xl">Editar</h1>
      <div className="grid grid-cols-4 gap-1 p-1 bg-ink2 border border-line rounded-lg">
        {(['perfil','plantillas','material','datos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2 text-[10px] uppercase tracking-widest font-bold rounded ${tab === t ? 'bg-orange text-ink' : 'text-bone2'}`}>
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
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="display text-bone text-lg">Perfil</div>
        <SaveIndicator status={status} />
      </div>
      <Row label="Nombre"><input className="input" value={draft.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} /></Row>
      <Row label="Edad"><input className="input mono" inputMode="numeric" value={draft.edad} onChange={e => setDraft({ ...draft, edad: Number(e.target.value || 0) })} /></Row>
      <Row label="Altura cm"><input className="input mono" inputMode="numeric" value={draft.altura} onChange={e => setDraft({ ...draft, altura: Number(e.target.value || 0) })} /></Row>
      <Row label="Peso inicial kg"><input className="input mono" inputMode="decimal" value={draft.pesoInicial} onChange={e => setDraft({ ...draft, pesoInicial: Number(e.target.value || 0) })} /></Row>
      <Row label="Inicio plan"><input type="date" className="input" value={draft.inicioPlan} onChange={e => setDraft({ ...draft, inicioPlan: e.target.value })} /></Row>
      <Row label="Día carrera"><input type="date" className="input" value={draft.raceDate} onChange={e => setDraft({ ...draft, raceDate: e.target.value })} /></Row>
      <Row label="Objetivo"><input className="input" value={draft.objetivo} onChange={e => setDraft({ ...draft, objetivo: e.target.value })} /></Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Calorías"><input className="input mono" value={draft.caloriasObj} onChange={e => setDraft({ ...draft, caloriasObj: Number(e.target.value || 0) })} /></Row>
        <Row label="Proteína g"><input className="input mono" value={draft.proteinaObj} onChange={e => setDraft({ ...draft, proteinaObj: Number(e.target.value || 0) })} /></Row>
        <Row label="Grasas g"><input className="input mono" value={draft.grasasObj} onChange={e => setDraft({ ...draft, grasasObj: Number(e.target.value || 0) })} /></Row>
        <Row label="Carbos g"><input className="input mono" value={draft.carbosObj} onChange={e => setDraft({ ...draft, carbosObj: Number(e.target.value || 0) })} /></Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-widest text-bone2">{label}</span><div className="mt-1">{children}</div></label>
}

function TemplatesPanel() {
  const [type, setType] = useState<WorkoutType>('push')
  const templates = useLiveQuery(() => db.exerciseTemplates.where('type').equals(type).toArray(), [type])

  async function addExercise() {
    const order = (templates?.length ?? 0) + 1
    await db.exerciseTemplates.add({ type, order, name: 'Nuevo ejercicio', series: 3, reps: '10', pesoUnidad: 'kg', active: true })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {GYM_TYPES.map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`btn flex-1 ${type === t ? 'btn-primary' : ''}`}>{t.toUpperCase()}</button>
        ))}
      </div>
      <div className="space-y-2">
        {(templates ?? []).sort((a, b) => a.order - b.order).map(t => <TemplateRow key={t.id} t={t} />)}
      </div>
      <button className="btn w-full" onClick={addExercise}>+ Añadir ejercicio</button>
    </div>
  )
}

function TemplateRow({ t }: { t: ExerciseTemplate }) {
  const [draft, setDraft] = useState(t)
  useEffect(() => setDraft(t), [t.id])
  const status = useAutosave(draft, async v => { if (v.id) await db.exerciseTemplates.update(v.id, v as any) })
  async function remove() {
    if (confirm(`Eliminar ${t.name}?`)) await db.exerciseTemplates.update(t.id!, { active: false })
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
      <div className="flex items-center justify-between gap-2">
        <input className="input flex-1 display text-bone" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <SaveIndicator status={status} />
        <button className="btn btn-ghost text-bone2 px-2" onClick={() => move(-1)} title="Subir">↑</button>
        <button className="btn btn-ghost text-bone2 px-2" onClick={() => move(1)} title="Bajar">↓</button>
        <button className="btn btn-ghost text-bone2 px-2" onClick={remove}>✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Series"><input className="input mono" inputMode="numeric" value={draft.series} onChange={e => setDraft({ ...draft, series: Number(e.target.value || 0) })} /></Row>
        <Row label="Reps"><input className="input mono" value={draft.reps} onChange={e => setDraft({ ...draft, reps: e.target.value })} /></Row>
        <Row label="RIR"><input className="input mono" value={draft.rir ?? ''} onChange={e => setDraft({ ...draft, rir: e.target.value })} /></Row>
        <Row label="Peso kg"><input className="input mono" inputMode="decimal" value={draft.pesoSugerido ?? ''} onChange={e => setDraft({ ...draft, pesoSugerido: e.target.value === '' ? undefined : Number(e.target.value) })} /></Row>
      </div>
      <Row label="Notas"><input className="input" value={draft.notas ?? ''} onChange={e => setDraft({ ...draft, notas: e.target.value })} /></Row>
    </div>
  )
}

function DataPanel() {
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  async function enableNotif() {
    const result = await requestNotifPermission()
    setNotif(result)
    if (result === 'granted') { await scheduleTodayReminder(); alert('Recordatorio activado para las 16:45 ✓') }
  }
  async function regenPlan() {
    if (!confirm('Regenerar el plan completo? Los días personalizados se sobrescribirán.')) return
    await db.planDays.clear()
    await db.planDays.bulkAdd(buildPlanDays())
    alert('Plan regenerado.')
  }
  async function wipeAll() {
    if (!confirm('⚠ BORRAR TODO (sesiones, sets, métricas, plan)? No se puede deshacer.')) return
    await db.delete()
    location.reload()
  }
  async function exportData() {
    const dump = {
      profile: await db.profile.toArray(),
      planDays: await db.planDays.toArray(),
      exerciseTemplates: await db.exerciseTemplates.toArray(),
      sessions: await db.sessions.toArray(),
      sets: await db.sets.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      prs: await db.prs.toArray(),
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `triax-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card p-3 space-y-2">
      <button className={`btn w-full ${notif === 'granted' ? 'btn-primary' : ''}`} onClick={enableNotif}>
        {notif === 'granted' ? '🔔 Recordatorios activos · 16:45' : notif === 'denied' ? '🔕 Notificaciones bloqueadas (revisa ajustes del navegador)' : '🔔 Activar recordatorio diario 16:45'}
      </button>
      <button className="btn w-full" onClick={exportData}>↓ Exportar backup JSON</button>
      <button className="btn w-full" onClick={regenPlan}>↺ Regenerar plan 21 semanas</button>
      <button className="btn w-full text-red-400 border-red-900" onClick={wipeAll}>✕ Borrar TODOS los datos</button>
    </div>
  )
}
