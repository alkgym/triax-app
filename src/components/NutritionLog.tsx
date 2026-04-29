import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type NutritionEntry } from '../db/schema'
import { todayIso } from '../lib/dates'
import { vibrate } from '../db/hooks'

const MEALS: NutritionEntry['meal'][] = ['desayuno', 'comida', 'merienda', 'cena', 'snack']

export function NutritionLog({ date = todayIso() }: { date?: string }) {
  const profile = useLiveQuery(() => db.profile.get('me'))
  const entries = useLiveQuery(() => db.nutrition.where('date').equals(date).toArray(), [date])

  const totals = (entries ?? []).reduce((acc, e) => ({
    kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="display text-bone text-lg">Nutrición · {date === todayIso() ? 'hoy' : date}</div>
      </div>

      {profile && (
        <div className="grid grid-cols-4 gap-1.5">
          <BarMacro label="kcal" v={totals.kcal} target={profile.caloriasObj} color="#F5F0E8" />
          <BarMacro label="P g" v={totals.protein} target={profile.proteinaObj} color="#FF6B2B" />
          <BarMacro label="C g" v={totals.carbs} target={profile.carbosObj} color="#22C55E" />
          <BarMacro label="G g" v={totals.fat} target={profile.grasasObj} color="#FACC15" />
        </div>
      )}

      <NewEntry date={date} />

      <div className="space-y-1">
        {(entries ?? []).sort((a, b) => a.timestamp - b.timestamp).map(e => (
          <div key={e.id} className="flex items-center justify-between text-sm border-b border-line pb-1">
            <div className="min-w-0 flex-1">
              <div className="text-bone2 text-[10px] uppercase tracking-widest">{e.meal}</div>
              <div className="text-bone truncate">{e.description}</div>
            </div>
            <div className="text-right mono text-xs">
              <div className="text-bone">{e.kcal}<span className="text-bone2"> kcal</span></div>
              <div className="text-bone2">{e.protein}P · {e.carbs}C · {e.fat}G</div>
            </div>
            <button className="ml-2 text-bone2 px-2" onClick={() => db.nutrition.delete(e.id!)}>✕</button>
          </div>
        ))}
        {(!entries || entries.length === 0) && <div className="text-bone2 text-xs italic">Sin entradas todavía</div>}
      </div>
    </div>
  )
}

function BarMacro({ label, v, target, color }: { label: string; v: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (v / target) * 100) : 0
  return (
    <div className="bg-ink rounded p-1.5 border border-line">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-widest text-bone2">{label}</span>
        <span className="display text-xs" style={{ color }}>{Math.round(v)}/{target}</span>
      </div>
      <div className="h-1 bg-ink2 rounded-full mt-1 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function NewEntry({ date }: { date: string }) {
  const [meal, setMeal] = useState<NutritionEntry['meal']>('desayuno')
  const [desc, setDesc] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')

  async function add() {
    if (!desc) return
    await db.nutrition.add({
      date, meal, description: desc,
      kcal: Number(kcal || 0), protein: Number(p || 0), carbs: Number(c || 0), fat: Number(f || 0),
      timestamp: Date.now(),
    })
    setDesc(''); setKcal(''); setP(''); setC(''); setF('')
    vibrate(15)
  }

  return (
    <div className="bg-ink rounded p-2 space-y-2 border border-line">
      <div className="flex gap-1">
        {MEALS.map(m => (
          <button key={m} onClick={() => setMeal(m)} className={`chip ${meal === m ? 'border-orange text-orange' : ''}`}>{m}</button>
        ))}
      </div>
      <input className="input" placeholder="¿qué comiste? p.ej. Pollo + arroz + ensalada" value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="grid grid-cols-4 gap-1.5">
        <input className="input mono text-center" placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)} inputMode="numeric" />
        <input className="input mono text-center" placeholder="P" value={p} onChange={e => setP(e.target.value)} inputMode="numeric" />
        <input className="input mono text-center" placeholder="C" value={c} onChange={e => setC(e.target.value)} inputMode="numeric" />
        <input className="input mono text-center" placeholder="G" value={f} onChange={e => setF(e.target.value)} inputMode="numeric" />
      </div>
      <button className="btn btn-primary w-full" onClick={add}>+ Añadir</button>
    </div>
  )
}
