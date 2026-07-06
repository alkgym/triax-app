// Paleta canónica por tipo de sesión — única fuente de verdad para chips,
// calendario y gráficas (los extras push/pull usan variantes locales a propósito).
export const TYPE_COLORS: Record<string, string> = {
  push: '#FF6B2B', pull: '#3B82F6', fullbody: '#A855F7', legs: '#10F4A0', torso: '#22D3EE',
  run: '#FF5722', bike: '#34D399', bike_indoor: '#10B981', swim: '#22D3EE', swim_pool: '#0EA5E9',
  futbol: '#F97316', gym_free: '#F59E0B',
}

export function typeColor(t: string): string {
  return TYPE_COLORS[t] ?? 'var(--text-3)'
}
