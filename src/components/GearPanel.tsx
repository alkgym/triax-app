import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type GearItem } from '../db/schema'
import { useAutosave } from '../db/hooks'
import { SaveIndicator } from './SaveIndicator'

const CATS: { key: GearItem['category']; label: string; icon: string }[] = [
  { key: 'bici', label: 'Bici', icon: '🚴' },
  { key: 'zapatillas', label: 'Zapatillas', icon: '👟' },
  { key: 'natacion', label: 'Natación', icon: '🥽' },
  { key: 'wearables', label: 'Wearables', icon: '⌚' },
  { key: 'otro', label: 'Otro', icon: '📦' },
]

export function GearPanel() {
  const items = useLiveQuery(() => db.gear.toArray().then(all => all.filter(i => i.active)))
  const [cat, setCat] = useState<GearItem['category']>('bici')

  async function add() {
    await db.gear.add({ category: cat, name: 'Nuevo material', notes: '', active: true } as any)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`btn flex-1 ${cat === c.key ? 'btn-primary' : ''} text-xs px-2`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {(items ?? []).filter(i => i.category === cat).map(i => <GearRow key={i.id} item={i} />)}
        {(items ?? []).filter(i => i.category === cat).length === 0 && (
          <div className="text-bone2 text-xs italic text-center py-4">Sin material en {cat}</div>
        )}
      </div>
      <button className="btn w-full" onClick={add}>+ Añadir material</button>
    </div>
  )
}

function GearRow({ item }: { item: GearItem }) {
  const [draft, setDraft] = useState(item)
  useEffect(() => setDraft(item), [item.id])
  const status = useAutosave(draft, async v => { if (v.id) await db.gear.update(v.id, v as any) })
  async function remove() {
    if (confirm(`Eliminar ${item.name}?`)) await db.gear.update(item.id!, { active: false } as any)
  }
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input className="input flex-1 display" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <SaveIndicator status={status} />
        <button className="btn btn-ghost text-bone2 px-2" onClick={remove}>✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-bone2">Compra</span>
          <input type="date" className="input mt-1" value={draft.bought ?? ''} onChange={e => setDraft({ ...draft, bought: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-bone2">Km recorridos</span>
          <input className="input mt-1 mono" inputMode="decimal" value={draft.km ?? ''} onChange={e => setDraft({ ...draft, km: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </label>
      </div>
      <textarea rows={2} className="input resize-none" placeholder="Notas (medida, talla, ajustes...)" value={draft.notes ?? ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
    </div>
  )
}
