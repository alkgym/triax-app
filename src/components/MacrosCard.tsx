import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

export function MacrosCard({ workoutType }: { workoutType: string }) {
  const profile = useLiveQuery(() => db.profile.get('me'))
  if (!profile) return null

  // High vs Low day adjustment per Gemini hybrid-tax doc:
  // Heavy gym/brick → push carbs to upper bound; pure cardio low → maintain.
  const isHigh = workoutType === 'push' || workoutType === 'pull' || workoutType === 'fullbody' || workoutType === 'brick'
  const carBoost = isHigh ? Math.round(profile.carbosObj * 1.05) : profile.carbosObj
  const calBoost = isHigh ? Math.round(profile.caloriasObj * 1.04) : profile.caloriasObj

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Macros objetivo · {isHigh ? 'día alto' : 'día base'}</div>
        <div className="display text-bone text-sm">{calBoost} kcal</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Macro label="Proteína" g={profile.proteinaObj} color="#FF6B2B" />
        <Macro label="Carbos" g={carBoost} color="#22C55E" />
        <Macro label="Grasas" g={profile.grasasObj} color="#FACC15" />
      </div>
    </div>
  )
}

function Macro({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-widest text-bone2">{label}</div>
      <div className="display text-2xl leading-none mt-0.5" style={{ color }}>{g}<span className="text-bone2 text-xs ml-1">g</span></div>
    </div>
  )
}
