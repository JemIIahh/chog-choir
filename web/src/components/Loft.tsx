import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { VoiceType } from '../audio/voice'
import type { LoftStat } from '../chain/client'
import type { Chog } from '../data/chogs'

const RING = ['#ff6b57', '#ffb02e', '#2fcf95', '#35b6f0', '#a47bff']
const ORDER: VoiceType[] = ['soprano', 'alto', 'tenor', 'bass']

type Props = {
  chogs: Chog[]
  stats: LoftStat[] | null // index 0 = token id 1
  epoch: number | null
  mine: Set<number>
  selectedId: number | null
  onPick(c: Chog): void
}

type Layout = { xs: Float32Array; ys: Float32Array; seat: number; sections: { type: VoiceType; x: number }[]; order: Chog[] }

/** Seats the whole collection in a half-ellipse, sopranos on the left to basses on the right, like a real choir loft. */
function layout(w: number, h: number, chogs: Chog[]): Layout {
  const n = chogs.length
  const cx = w / 2, cy = h - 24
  const bMax = h - 40 // vertical reach
  const aMax = w / 2 - 14 // horizontal reach
  const k0 = 0.3
  const t0 = Math.PI * 0.025, span = Math.PI * 0.95

  // one row of the loft: its seats sit evenly along an ellipse arc
  const row = (f: number, spacing: number) => {
    const A = aMax * f, B = bMax * f
    const N = 160
    const len: number[] = [0]
    let px = A * Math.cos(t0 + span), py = B * Math.sin(t0 + span)
    for (let i = 1; i <= N; i++) {
      const t = t0 + span - (span * i) / N
      const x = A * Math.cos(t), y = B * Math.sin(t)
      len.push(len[i - 1] + Math.hypot(x - px, y - py))
      px = x; py = y
    }
    const total = len[N]
    const count = Math.max(1, Math.floor(total / spacing))
    const ts: number[] = []
    for (let i = 0; i < count; i++) {
      const target = ((i + 0.5) / count) * total
      let j = 1
      while (j < N && len[j] < target) j++
      const u = (target - len[j - 1]) / Math.max(1e-9, len[j] - len[j - 1])
      ts.push(t0 + span - (span * (j - 1 + u)) / N)
    }
    return { A, B, ts }
  }
  const rowsFor = (s: number) => Math.max(2, Math.floor((1 - k0) * bMax / s) + 1)
  const build = (s: number) => {
    const rows = rowsFor(s)
    return Array.from({ length: rows }, (_, r) => row(k0 + ((1 - k0) * r) / (rows - 1), s))
  }
  let lo = 2, hi = 40
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (build(mid).reduce((a, r) => a + r.ts.length, 0) >= n) lo = mid
    else hi = mid
  }
  const rows = build(lo)
  // trim every row evenly so exactly n seats remain (drop from the ends of the outer rows first)
  let extra = rows.reduce((a, r) => a + r.ts.length, 0) - n
  for (let r = rows.length - 1; extra > 0; r = (r - 1 + rows.length) % rows.length) {
    if (rows[r].ts.length > 4) { rows[r].ts.pop(); extra-- }
  }

  const seats: { x: number; y: number; t: number }[] = []
  for (const r of rows) for (const t of r.ts) seats.push({ x: cx + r.A * Math.cos(t), y: cy - r.B * Math.sin(t), t })
  seats.sort((p, q) => q.t - p.t || p.y - q.y)
  const order = [...chogs].sort((p, q) => ORDER.indexOf(p.spec.voiceType) - ORDER.indexOf(q.spec.voiceType) || p.id - q.id)
  const xs = new Float32Array(n), ys = new Float32Array(n)
  seats.forEach((p, i) => { xs[i] = p.x; ys[i] = p.y })

  // a label under the middle of each section, placed by angle so they read left to right
  const sections: Layout['sections'] = []
  let at = 0
  for (const type of ORDER) {
    const count = order.filter(o => o.spec.voiceType === type).length
    if (count) {
      const mid = seats[Math.min(seats.length - 1, at + Math.floor(count / 2))]
      sections.push({ type, x: cx + (aMax * 0.66) * Math.cos(mid.t) })
    }
    at += count
  }
  const seat = Math.max(1.8, Math.min(6, lo * 0.4))
  return { xs, ys, seat, sections, order }
}

export const Loft = memo(function Loft({ chogs, stats, epoch, mine, selectedId, onPick }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 760, h: 270 })
  const [tip, setTip] = useState<{ x: number; y: number; c: Chog } | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(320, Math.floor(e.contentRect.width))
      setSize({ w, h: Math.round(Math.min(330, Math.max(210, w * 0.34))) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const lay = useMemo(() => layout(size.w, size.h, chogs), [size, chogs])

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = size.w * dpr
    cv.height = size.h * dpr
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, size.w, size.h)
    const r = lay.seat
    lay.order.forEach((c, i) => {
      const st = stats?.[c.id - 1]
      const sungNow = !!st && epoch !== null && st.last === epoch + 1
      const ever = !!st && st.total > 0
      const x = lay.xs[i], y = lay.ys[i]
      if (ever) {
        // a soft halo, like a stage light coming up on a singer
        const halo = g.createRadialGradient(x, y, 0, x, y, r * (sungNow ? 4.2 : 2.6))
        halo.addColorStop(0, RING[c.spec.vowel] + (sungNow ? '88' : '40'))
        halo.addColorStop(1, RING[c.spec.vowel] + '00')
        g.fillStyle = halo
        g.fillRect(x - r * 4.2, y - r * 4.2, r * 8.4, r * 8.4)
      }
      g.beginPath()
      g.arc(x, y, ever ? r : r * 0.78, 0, Math.PI * 2)
      if (sungNow) { g.fillStyle = RING[c.spec.vowel]; g.fill() }
      else if (ever) { g.fillStyle = RING[c.spec.vowel] + '99'; g.fill() }
      else { g.fillStyle = 'rgba(28,30,43,0.13)'; g.fill() }
      if (mine.has(c.id)) { g.lineWidth = 2; g.strokeStyle = '#1c1e2b'; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.stroke() }
      if (selectedId === c.id) { g.lineWidth = 3; g.strokeStyle = '#ffb800'; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.stroke() }
    })
    g.font = '700 12px "Hanken Grotesk", system-ui, sans-serif'
    g.fillStyle = '#64635a'
    g.textAlign = 'center'
    g.fillText('seated by voice, left to right: soprano, alto, tenor, bass', size.w / 2, size.h - 4)
  }, [lay, stats, epoch, mine, selectedId, size])

  const find = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    let best = -1, bd = (lay.seat * 1.8) ** 2
    for (let i = 0; i < lay.order.length; i++) {
      const d = (lay.xs[i] - px) ** 2 + (lay.ys[i] - py) ** 2
      if (d < bd) { bd = d; best = i }
    }
    return best < 0 ? null : { c: lay.order[best], x: lay.xs[best], y: lay.ys[best] }
  }

  const tipStat = tip && stats ? stats[tip.c.id - 1] : null
  return (
    <div className="loft" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        role="img"
        aria-label="All 1,969 Chogs seated by voice type. Bright seats have sung."
        onPointerMove={e => setTip(find(e))}
        onPointerLeave={() => setTip(null)}
        onClick={e => { const f = find(e); if (f) onPick(f.c) }}
      />
      {tip && (
        <div className="loft-tip" style={{ left: Math.min(size.w - 150, Math.max(4, tip.x - 70)), top: Math.max(0, tip.y - 54) }}>
          <b>Chog #{tip.c.n}</b>
          <span>{tipStat && tipStat.total > 0 ? `sung ${tipStat.total}×${tipStat.streak > 1 ? ` · ${tipStat.streak} in a row` : ''}` : 'has not sung yet'}</span>
        </div>
      )}
    </div>
  )
})
