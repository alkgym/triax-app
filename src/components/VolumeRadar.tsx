import { useLiveQuery } from 'dexie-react-hooks'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { db, type MuscleGroup } from '../db/schema'
import { todayIso, addDays } from '../lib/dates'

const GROUPS: MuscleGroup[] = ['pecho','espalda','hombro','biceps','triceps','cuadriceps','isquios','gluteo','gemelo','core']
const LABEL: Record<MuscleGroup,string> = {
  pecho:'Pecho', espalda:'Espalda', hombro:'Hombro', biceps:'Bíceps', triceps:'Tríceps',
  cuadriceps:'Cuádr.', isquios:'Isquios', gluteo:'Glúteo', gemelo:'Gemelo', core:'Core',
}

export function VolumeRadar() {
  const data = useLiveQuery(async () => {
    const today = todayIso()
    const weekAgo = addDays(today, -7)
    const sessions = await db.sessions.where('date').between(weekAgo, today, true, true).toArray()
    const sessIds = sessions.map(s => s.id!).filter(Boolean)
    if (sessIds.length === 0) return GROUPS.map(g => ({ group: LABEL[g], series: 0 }))
    const sets = await db.sets.where('sessionId').anyOf(sessIds).and(s => s.completed).toArray()
    const tpls = await db.exerciseTemplates.toArray()
    const tplByName = new Map(tpls.map(t => [t.name, t]))
    const counts: Record<MuscleGroup, number> = { pecho:0,espalda:0,hombro:0,biceps:0,triceps:0,cuadriceps:0,isquios:0,gluteo:0,gemelo:0,core:0 }
    for (const s of sets) {
      const tpl = tplByName.get(s.exercise)
      if (!tpl?.muscleGroups) continue
      for (const g of tpl.muscleGroups) counts[g] = (counts[g] ?? 0) + 1
    }
    return GROUPS.map(g => ({ group: LABEL[g], series: counts[g] }))
  })

  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-widest text-bone2 mb-2">Volumen 7 días · series por grupo muscular</div>
      <div className="h-72">
        <ResponsiveContainer>
          <RadarChart data={data ?? []}>
            <PolarGrid stroke="#262626" />
            <PolarAngleAxis dataKey="group" tick={{ fill: '#A9A39A', fontSize: 10 }} />
            <Radar dataKey="series" stroke="#FF6B2B" fill="#FF6B2B" fillOpacity={0.3} />
            <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #262626' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
