import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type GearItem } from '../db/schema'
import { useAutosave } from '../db/hooks'
import { SaveIndicator } from './SaveIndicator'

const CATS: { key: GearItem['category']; label: string }[] = [
  { key: 'bici', label: 'Bici' },
  { key: 'zapatillas', label: 'Zapas' },
  { key: 'natacion', label: 'Nado' },
  { key: 'wearables', label: 'Wear' },
  { key: 'otro', label: 'Otro' },
]

export function GearPanel() {
  const items = useLiveQuery(() => db.gear.toArray().then(all => all.filter(i => i.active)))
  const [cat, setCat] = useState<GearItem['category']>('bici')

  async function add() {
    await db.gear.add({ category: cat, name: 'Nuevo material', notes: '', active: true } as any)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1 p-1 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        {CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className="py-2 text-[12px] font-medium rounded-lg transition-colors"
            style={cat === c.key
              ? { background: 'var(--surface-3)', color: 'var(--text)' }
              : { color: 'var(--text-3)' }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {(items ?? []).filter(i => i.category === cat).map(i => <GearRow key={i.id} item={i} />)}
        {(items ?? []).filter(i => i.category === cat).length === 0 && (
          <div className="text-[13px] text-center py-6" style={{ color: 'var(--text-3)' }}>Sin material en {cat}</div>
        )}
      </div>
      <button className="btn w-full" onClick={add}>+ Añadir material</button>
    </div>
  )
}

function GearRow({ item }: { item: GearItem }) {
  const [draft, setDraft] = useState(item)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => setDraft(item), [item.id])
  const status = useAutosave(draft, async v => { if (v.id) await db.gear.update(v.id, v as any) })
  async function remove() {
    await db.gear.update(item.id!, { active: false } as any)
    setConfirmDel(false)
  }
  return (
    <div className="card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <input className="input flex-1" style={{ fontWeight: 500 }} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <SaveIndicator status={status} />
        <button className="text-[18px] px-2" style={{ color: 'var(--text-3)' }} onClick={() => setConfirmDel(true)}>×</button>
      </div>
      {confirmDel && (
        <div className="flex gap-2 items-center rounded-lg p-2.5"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span className="text-[12px] flex-1" style={{ color: 'var(--text-2)' }}>¿Eliminar "{item.name}"?</span>
          <button onClick={remove} className="text-[12px] font-medium" style={{ color: 'var(--red)' }}>Eliminar</button>
          <button onClick={() => setConfirmDel(false)} className="text-[12px]" style={{ color: 'var(--text-3)' }}>Cancelar</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Compra</span>
          <input type="date" className="input mt-1" value={draft.bought ?? ''} onChange={e => setDraft({ ...draft, bought: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Km</span>
          <input className="input mt-1 num" inputMode="decimal" value={draft.km ?? ''} onChange={e => setDraft({ ...draft, km: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </label>
      </div>
      <textarea rows={2} className="input resize-none" placeholder="Notas (medida, talla, ajustes…)" value={draft.notes ?? ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
    </div>
  )
}
