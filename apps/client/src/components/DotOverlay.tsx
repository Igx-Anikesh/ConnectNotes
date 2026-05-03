import { useRef, useEffect } from 'react'

/**
 * Renders a full-screen canvas overlay with randomly glowing/dimming dots.
 * Each dot independently pulses at its own speed, creating an organic twinkling effect.
 */

interface Particle {
  x: number
  y: number
  baseAlpha: number
  alpha: number
  speed: number     // glow speed (radians per frame)
  phase: number     // offset so dots aren't in sync
  radius: number
}

const DOT_COUNT = 120
const MIN_RADIUS = 0.8
const MAX_RADIUS = 1.6

export function DotOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const rafId = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    let width = 0
    let height = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
      // Regenerate particles on resize
      initParticles()
    }

    const initParticles = () => {
      particles.current = []
      for (let i = 0; i < DOT_COUNT; i++) {
        particles.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          baseAlpha: 0.03 + Math.random() * 0.07,  // 3-10% base
          alpha: 0,
          speed: 0.005 + Math.random() * 0.025,     // varied speeds
          phase: Math.random() * Math.PI * 2,         // random start phase
          radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
        })
      }
    }

    let frame = 0
    const animate = () => {
      frame++
      ctx.clearRect(0, 0, width, height)

      for (const p of particles.current) {
        // Sine-wave glow: oscillates between dim and bright
        const glow = Math.sin(frame * p.speed + p.phase)
        // Map from [-1,1] to [baseAlpha*0.3, baseAlpha*2.5]
        p.alpha = p.baseAlpha * (0.3 + (glow + 1) * 1.1)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`
        ctx.fill()

        // Subtle glow ring for brighter dots
        if (p.alpha > 0.1) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.15})`
          ctx.fill()
        }
      }

      // Occasionally reposition a random dot to simulate "new" twinkles
      if (frame % 120 === 0) {
        const idx = Math.floor(Math.random() * particles.current.length)
        particles.current[idx].x = Math.random() * width
        particles.current[idx].y = Math.random() * height
        particles.current[idx].phase = Math.random() * Math.PI * 2
      }

      rafId.current = requestAnimationFrame(animate)
    }

    resize()
    animate()
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(rafId.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="dot-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  )
}
