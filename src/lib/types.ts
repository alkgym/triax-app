import type { WorkoutType } from '../db/schema'

export const TYPE_META: Record<WorkoutType, { label: string; emoji: string; color: string; bg: string }> = {
  push:        { label: 'Push',         emoji: '🟠', color: '#FF6B2B', bg: 'rgba(255,107,43,.12)' },
  pull:        { label: 'Pull',         emoji: '🔵', color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
  fullbody:    { label: 'Full Body',    emoji: '🟣', color: '#A855F7', bg: 'rgba(168,85,247,.12)' },
  swim:        { label: 'Nado',         emoji: '🩵', color: '#06B6D4', bg: 'rgba(6,182,212,.12)' },
  bike:        { label: 'Bici',         emoji: '🟢', color: '#10F4A0', bg: 'rgba(16,244,160,.12)' },
  run:         { label: 'Carrera',      emoji: '🔴', color: '#FF6B2B', bg: 'rgba(255,107,43,.12)' },
  brick:       { label: 'Brick',        emoji: '⚡', color: '#FACC15', bg: 'rgba(250,204,21,.12)' },
  rest:        { label: 'Descanso',     emoji: '⚫', color: '#525252', bg: 'rgba(82,82,82,.20)' },
  bike_indoor: { label: 'Bici Indoor',  emoji: '🚲', color: '#10B981', bg: 'rgba(16,185,129,.12)' },
  swim_pool:   { label: 'Piscina',      emoji: '🏊', color: '#0EA5E9', bg: 'rgba(14,165,233,.12)' },
  gym_free:    { label: 'Gym Libre',    emoji: '🏋️', color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  legs:        { label: 'Legs',         emoji: '🦵', color: '#10F4A0', bg: 'rgba(16,244,160,.12)' },
  torso:       { label: 'Torso',        emoji: '🧱', color: '#22D3EE', bg: 'rgba(34,211,238,.12)' },
}

export const PHASE_META = {
  base:  { label: 'Base · Adaptación',     color: '#22C55E' },
  build: { label: 'Construcción · Umbral', color: '#FF6B2B' },
  peak:  { label: 'Pico · Especificidad',  color: '#EF4444' },
  taper: { label: 'Taper · Puesta a punto',color: '#A855F7' },
} as const
