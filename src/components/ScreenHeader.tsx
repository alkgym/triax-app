// Cabecera de pantalla unificada: eyebrow opcional + título grande + subtítulo.
export function ScreenHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div>
      {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
      <h1 className="text-[30px] font-semibold tracking-tight leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.035em' }}>
        {title}
      </h1>
      {sub && <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}
