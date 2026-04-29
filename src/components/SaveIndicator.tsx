export function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null
  return (
    <span className={`chip ${status === 'saving' ? 'saving text-bone2' : 'text-orange border-orange'}`}>
      {status === 'saving' ? '◐ Guardando…' : '✓ Guardado'}
    </span>
  )
}
