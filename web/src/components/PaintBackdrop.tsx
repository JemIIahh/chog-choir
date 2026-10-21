import { useEffect, useRef } from 'react'
import type { Player } from '../audio/usePlayer'
import type { Chog } from '../data/chogs'
import { token } from '../lib/look'

// The page paints while it plays: every note that sounds blooms in its vowel's colour. On a dark look the blooms add up
// like stage light, on a light look they multiply like wet ink. The look says which (--paint-op). One canvas, behind everything.

const PAINT = ['255,90,71', '255,176,32', '37,207,148', '45,180,242', '155,107,255'] // ahh ehh eee ohh ooo

type Bloom = { x: number; y: number; r: number; c: string; born: number; life: number; ring: boolean }

export function PaintBackdrop({ player, byId }: { player: Player; byId: Map<number, Chog> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const blooms = useRef<Bloom[]>([])
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const byIdRef = useRef(byId)
  byIdRef.current = byId
  const playerRef = useRef(player)
  playerRef.current = player

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const g = cv.getContext('2d')!
    let raf = 0
    let last = 0
    let op: GlobalCompositeOperation = 'multiply'
    const readLook = () => { op = (token('--paint-op') || 'multiply') as GlobalCompositeOperation }
    readLook()
    window.addEventListener('chogchoir:look', readLook)

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1)
      const w = window.innerWidth, h = window.innerHeight
      cv.width = Math.floor(w * dpr)
      cv.height = Math.floor(h * dpr)
      size.current = { w, h, dpr }
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden || t - last < 33) return // about 30 frames a second is plenty for light
      last = t
      const { w, h, dpr } = size.current
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = op

      const now = performance.now()
      blooms.current = blooms.current.filter(b => now - b.born < b.life)
      for (const b of blooms.current) {
        const k = (now - b.born) / b.life // 0..1
        const ease = 1 - (1 - k) * (1 - k)
        const r = b.r * (0.55 + ease * 0.9)
        const a = (1 - k) * (b.ring ? 0.55 : 0.5)
        if (b.ring) {
          g.strokeStyle = `rgba(${b.c},${a})`
          g.lineWidth = 3 + (1 - k) * 5
          g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke()
        } else {
          const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
          grad.addColorStop(0, `rgba(${b.c},${a})`)
          grad.addColorStop(0.55, `rgba(${b.c},${a * 0.45})`)
          grad.addColorStop(1, `rgba(${b.c},0)`)
          g.fillStyle = grad
          g.fillRect(b.x - r, b.y - r, r * 2, r * 2)
        }
      }
    }
    raf = requestAnimationFrame(draw)

    const off = playerRef.current.onStep(({ step, delay }) => {
      if (calm) return
      window.setTimeout(() => {
        const song = playerRef.current.current()
        const { w, h } = size.current
        const born = performance.now()
        let n = 0
        for (const note of song.notes) {
          if (note.step !== step || n++ > 9) continue
          const chog = byIdRef.current.get(note.id)
          if (!chog) continue
          const x = w * (0.06 + (step / 15) * 0.88) + (Math.random() - 0.5) * 50
          const y = h * (0.9 - (note.pitch / 11) * 0.78) + (Math.random() - 0.5) * 50
          const big = 150 + chog.spec.unison * 36 + Math.random() * 60
          blooms.current.push({ x, y, r: big, c: PAINT[chog.spec.vowel], born, life: 2600 + Math.random() * 900, ring: false })
          if (chog.spec.unison >= 3) blooms.current.push({ x, y, r: big * 0.8, c: PAINT[chog.spec.vowel], born, life: 1800, ring: true })
        }
        // the band pulses the floor: a low wide ring on every beat, like a kick drum felt through the stage
        if (song.beat > 0 && step % 2 === 0 && (song.layers ?? 3) >= 3) blooms.current.push({ x: w / 2, y: h * 1.02, r: h * 0.55, c: '255,79,163', born, life: 900, ring: true })
        if (blooms.current.length > 120) blooms.current.splice(0, blooms.current.length - 120)
      }, delay)
    })

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('chogchoir:look', readLook); off() }
  }, [])

  return <canvas ref={ref} className="backdrop" aria-hidden style={{ width: '100vw', height: '100vh' }} />
}
