import { useEffect, useRef } from 'react'

// Lightweight canvas confetti — no external dep.
export function Confetti({ trigger }: { trigger: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = window.innerWidth + 'px'
    canvas.style.height = window.innerHeight + 'px'
    ctx.scale(dpr, dpr)

    const colors = ['#FF6B2B', '#F5F0E8', '#FF8B5A', '#FACC15', '#22C55E']
    const count = 140
    const particles = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 18 - 6,
      g: 0.4,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
    }))

    let raf = 0
    const start = performance.now()
    const animate = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      let alive = false
      for (const p of particles) {
        p.vy += p.g
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life = elapsed
        if (p.y < window.innerHeight + 40) alive = true
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5)
        ctx.restore()
      }
      if (alive && elapsed < 3000) raf = requestAnimationFrame(animate)
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [trigger])

  return <canvas ref={ref} className="fixed inset-0 z-50 pointer-events-none" />
}
