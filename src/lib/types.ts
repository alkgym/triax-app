import type { WorkoutType } from '../db/schema'

export const TYPE_META: Record<WorkoutType, { label: string; emoji: string; color: string; bg: string }> = {
  push:     { label: 'Push',     emoji: '🟠', color: '#FF6B2B', bg: 'rgba(255,107,43,.12)' },
  pull:     { label: 'Pull',     emoji: '🔵', color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
  fullbody: { label: 'Full Body',emoji: '🟣', color: '#A855F7', bg: 'rgba(168,85,247,.12)' },
  swim:     { label: 'Nado',     emoji: '🩵', color: '#06B6D4', bg: 'rgba(6,182,212,.12)' },
  bike:     { label: 'Bici',     emoji: '🟢', color: '#22C55E', bg: 'rgba(34,197,94,.12)' },
  run:      { label: 'Carrera',  emoji: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
  brick:    { label: 'Brick',    emoji: '⚡', color: '#FACC15', bg: 'rgba(250,204,21,.12)' },
  rest:     { label: 'Descanso', emoji: '⚫', color: '#525252', bg: 'rgba(82,82,82,.20)' },
}

export const PHASE_META = {
  base:  { label: 'Base · Adaptación',     color: '#22C55E' },
  build: { label: 'Construcción · Umbral', color: '#FF6B2B' },
  peak:  { label: 'Pico · Especificidad',  color: '#EF4444' },
  taper: { label: 'Taper · Puesta a punto',color: '#A855F7' },
} as const
