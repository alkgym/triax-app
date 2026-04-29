import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { WorkoutType } from '../db/schema'

// HRmax estimated via Tanaka (208 - 0.7×age) — more accurate than 220-age for young trained.
function hrZones(age: number) {
  const max = Math.round(208 - 0.7 * age)
  return {
    max,
    z2: [Math.round(max * 0.65), Math.round(max * 0.75)],
    z3: [Math.round(max * 0.75), Math.round(max * 0.85)],
    z4: [Math.round(max * 0.85), Math.round(max * 0.92)],
    z5: [Math.round(max * 0.92), max],
  }
}

export function ZonesCard({ type }: { type: WorkoutType }) {
  const profile = useLiveQuery(() => db.profile.get('me'))
  if (!profile) return null
  const z = hrZones(profile.edad)

  if (type === 'run') {
    return (
      <div className="card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Ritmos referencia carrera (Alex · base 25km @6:15)</div>
        <Row k="Z2 conversacional" v="6:00 – 6:30 /km" />
        <Row k="Z3 tempo" v="5:15 – 5:35 /km" />
        <Row k="Z4 umbral · series 1km" v="4:45 – 5:00 /km" />
        <Row k="Objetivo carrera 9km" v="5:30 /km" />
        <hr className="border-line" />
        <Row k="HR Z2" v={`${z.z2[0]} – ${z.z2[1]} bpm`} />
        <Row k="HR Z3-4" v={`${z.z3[0]} – ${z.z4[1]} bpm`} />
      </div>
    )
  }
  if (type === 'bike') {
    return (
      <div className="card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Bici · zonas FC + cadencia</div>
        <Row k="Z2 base aeróbico" v={`${z.z2[0]} – ${z.z2[1]} bpm`} />
        <Row k="Z3 sweet spot" v={`${z.z3[0]} – ${z.z3[1]} bpm`} />
        <Row k="Z4 umbral" v={`${z.z4[0]} – ${z.z4[1]} bpm`} />
        <Row k="Cadencia objetivo" v="85 – 95 RPM" />
        <Row k="Aero / acoples" v="Tronco a 30-40°" />
      </div>
    )
  }
  if (type === 'swim') {
    return (
      <div className="card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Nado · cues técnicos</div>
        <Row k="Caderas" v="↑ presiona esternón" />
        <Row k="Mirada" v="Suelo, no al frente" />
        <Row k="Rotación" v="Costado a costado (6-1-6)" />
        <Row k="Brazada" v="DPS · catch alto" />
        <Row k="Mar · sighting" v="Cada 3-5 brazadas" />
      </div>
    )
  }
  if (type === 'brick') {
    return (
      <div className="card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-bone2">Brick · transición T2</div>
        <Row k="T2 objetivo" v="< 90 s" />
        <Row k="Primeros 1.5 km" v="Cadencia alta · zancada corta" />
        <Row k="Sensación normal" v="Piernas pesadas 5-8'" />
        <Row k="Ritmo carrera tras bici" v="5:30 /km estable" />
      </div>
    )
  }
  return null
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-bone2">{k}</span>
      <span className="text-bone mono">{v}</span>
    </div>
  )
}
