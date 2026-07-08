// Render a 9:16 share card to canvas → blob → Web Share API or download.
// Pure canvas API — no external deps so we keep the bundle lean.

export interface ShareData {
  title: string                 // e.g. "Sem 7 · Build"
  subtitle?: string             // e.g. "Artiem Half · Menorca"
  daysToRace?: number
  stats: { label: string; value: string; unit?: string; color?: string }[]
  streak?: number
  adherencia?: number           // 0-100
}

const W = 1080, H = 1920
const SAFE_X = 80
const C = {
  bg: '#000000',
  fg: '#F5F0E8',
  muted: '#888888',
  orange: '#FF6B2B',
  swim: '#06B6D4',
  bike: '#10F4A0',
  run:  '#FF6B2B',
  gym:  '#A855F7',
}

// Lazy: we draw with system fonts; canvas can't load Google fonts reliably from script
const fontDisplay = '900 italic "Helvetica Neue", Arial, sans-serif'
const fontHero    = '700 "Helvetica Neue", Arial, sans-serif'
const fontBody    = '500 "Helvetica Neue", Arial, sans-serif'
const fontMono    = '600 "SF Mono", Menlo, monospace'

function gradientBg(ctx: CanvasRenderingContext2D) {
  // Deep black with orange glow top-left and purple bottom-right
  const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 1.1)
  g1.addColorStop(0, 'rgba(255,107,43,0.55)')
  g1.addColorStop(0.5, 'rgba(255,107,43,0.08)')
  g1.addColorStop(1, 'rgba(255,107,43,0)')
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = g1;   ctx.fillRect(0, 0, W, H)

  const g2 = ctx.createRadialGradient(W, H, 0, W, H, W)
  g2.addColorStop(0, 'rgba(168,85,247,0.45)')
  g2.addColorStop(0.6, 'rgba(168,85,247,0.05)')
  g2.addColorStop(1, 'rgba(168,85,247,0)')
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)

  // Subtle vignette
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.7)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
}

function drawCenter(ctx: CanvasRenderingContext2D, text: string, y: number, font: string, fill: string) {
  ctx.font = font
  ctx.fillStyle = fill
  ctx.textAlign = 'center'
  ctx.fillText(text, W / 2, y)
}

function drawLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill: string) {
  ctx.font = font
  ctx.fillStyle = fill
  ctx.textAlign = 'left'
  ctx.fillText(text, x, y)
}

export async function renderShareCard(data: ShareData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  gradientBg(ctx)

  // Logo / wordmark
  ctx.save()
  ctx.shadowColor = 'rgba(255,107,43,0.6)'
  ctx.shadowBlur = 24
  drawCenter(ctx, 'TRI·AX', 220, `${fontDisplay}`, C.fg)
  ctx.restore()
  ctx.font = `40px ${fontMono}`
  ctx.fillStyle = C.muted
  ctx.textAlign = 'center'
  ctx.fillText('—— PLAN ACTIVO ——', W/2, 280)

  // Subtitle (race name)
  if (data.subtitle) {
    ctx.font = `36px ${fontBody}`
    ctx.fillStyle = C.muted
    ctx.fillText(data.subtitle.toUpperCase(), W/2, 380)
  }

  // Days to race — HERO
  if (typeof data.daysToRace === 'number') {
    ctx.save()
    const grd = ctx.createLinearGradient(0, 460, 0, 720)
    grd.addColorStop(0, '#FFB088'); grd.addColorStop(1, '#FF5A18')
    ctx.fillStyle = grd
    ctx.font = `900 360px ${fontHero}`
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(255,107,43,0.45)'
    ctx.shadowBlur = 30
    ctx.fillText(String(Math.max(0, data.daysToRace)), W/2, 760)
    ctx.restore()

    ctx.font = `48px ${fontBody}`
    ctx.fillStyle = C.muted
    ctx.textAlign = 'center'
    ctx.fillText('DÍAS HASTA CARRERA', W/2, 830)
  }

  // Title block
  ctx.font = `bold 72px ${fontHero}`
  ctx.fillStyle = C.fg
  ctx.textAlign = 'center'
  ctx.fillText(data.title, W/2, 980)

  // Stats grid 2 columns × N rows
  const startY = 1120
  const rowH = 180
  const cols = 2
  data.stats.forEach((stat, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = SAFE_X + col * ((W - SAFE_X * 2) / cols)
    const y = startY + row * rowH
    const cw = (W - SAFE_X * 2) / cols - 24

    // Card
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    roundRect(ctx, x, y, cw, rowH - 24, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2
    roundRect(ctx, x, y, cw, rowH - 24, 28)
    ctx.stroke()

    // Label
    drawLeft(ctx, stat.label.toUpperCase(), x + 32, y + 50, `bold 28px ${fontBody}`, C.muted)
    // Value
    ctx.save()
    ctx.shadowColor = (stat.color ?? C.orange) + '99'
    ctx.shadowBlur = 16
    drawLeft(ctx, stat.value, x + 32, y + 122, `900 86px ${fontHero}`, stat.color ?? C.fg)
    ctx.restore()
    if (stat.unit) {
      ctx.font = `bold 30px ${fontBody}`
      ctx.fillStyle = C.muted
      ctx.fillText(' ' + stat.unit, x + 32 + ctx.measureText(stat.value).width, y + 122)
    }
  })

  // Footer — streak + adherencia + url
  const footerY = H - 220
  ctx.font = `bold 36px ${fontBody}`
  ctx.fillStyle = C.muted
  ctx.textAlign = 'center'
  const parts: string[] = []
  if (typeof data.streak === 'number') parts.push(`🔥 ${data.streak} días racha`)
  if (typeof data.adherencia === 'number') parts.push(`✓ ${data.adherencia}% adherencia`)
  ctx.fillText(parts.join('   ·   '), W/2, footerY)

  ctx.font = `bold 28px ${fontMono}`
  ctx.fillStyle = '#555'
  ctx.fillText('triax-alex.netlify.app', W/2, H - 110)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png', 0.95)
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  // Try Web Share API first (mobile)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return { kind: 'shared' as const }
    } catch (e) {
      // user cancelled — fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { kind: 'downloaded' as const }
}
