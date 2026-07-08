// Sistema de diseño compartido — colores y metadatos comunes de la UI.

export function painColor(l: number): string {
  if (l <= 2) return '#22C55E'
  if (l <= 4) return '#84CC16'
  if (l <= 6) return '#F59E0B'
  if (l <= 8) return '#F97316'
  return '#EF4444'
}

export const ROUTINE_META: Record<string, { label: string; color: string }> = {
  push:     { label: 'Push',      color: '#FF6B2B' },
  pull:     { label: 'Pull',      color: '#3B82F6' },
  legs:     { label: 'Legs',      color: '#10F4A0' },
  torso:    { label: 'Torso',     color: '#22D3EE' },
  fullbody: { label: 'Full Body', color: '#A855F7' },
  rest:     { label: 'Descanso',  color: '#3a3a3e' },
}
