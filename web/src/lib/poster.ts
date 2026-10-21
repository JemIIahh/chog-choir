import type { Chog } from '../data/chogs'
import { thumb, thumbLg } from '../data/chogs'
import { BEATS } from '../audio/band'
import { hash } from '../audio/voice'
import { keyName, PITCHES, STEPS } from './music'
import type { Song } from './share'
import { palette, paintBackground, type Pal } from './palette'
import type { Theme } from './theme'

// A poster for a song: its notes become paint. Every vowel has a colour, every note a bloom,
// and a thin ink line runs through them in the order they are sung. Same song, same poster, always.

const W = 1080, H = 1350
const PAINT = ['255,90,71', '255,176,32', '37,207,148', '45,180,242', '155,107,255']

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

const load = (src: string) => new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src })

/** The three strongest colours in a Chog's own artwork, as "r,g,b". Each Chog paints in its own colours. */
function palette_of(img: HTMLImageElement, fallback: string): string[] {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 28
    const x = c.getContext('2d', { willReadFrequently: true })!
    x.drawImage(img, 0, 0, 28, 28)
    const d = x.getImageData(0, 0, 28, 28).data
    const bins = Array.from({ length: 6 }, () => ({ n: 0, r: 0, g: 0, b: 0 }))
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      if (mx < 90 || (mx - mn) / (mx || 1) < 0.4) continue // skip dark and grey: they do not paint well
      let h = 0
      if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6
      else if (mx === g) h = (b - r) / (mx - mn) + 2
      else h = (r - g) / (mx - mn) + 4
      const bin = bins[Math.floor(h) % 6]
      bin.n++; bin.r += r; bin.g += g; bin.b += b
    }
    const top = bins.filter(b => b.n > 6).sort((a, b) => b.n - a.n).slice(0, 3).map(b => `${Math.round(b.r / b.n)},${Math.round(b.g / b.n)},${Math.round(b.b / b.n)}`)
    return top.length ? top : [fallback]
  } catch {
    return [fallback]
  }
}

export function halftone(g: CanvasRenderingContext2D, cx: number, cy: number, reach: number, color: string) {
  g.save()
  g.fillStyle = color
  for (let y = cy - reach; y < cy + reach; y += 22)
    for (let x = cx - reach; x < cx + reach; x += 22) {
      const d = Math.hypot(x - cx, y - cy) / reach
      if (d > 1) continue
      g.beginPath(); g.arc(x, y, (1 - d) * 7.5, 0, Math.PI * 2); g.fill()
    }
  g.restore()
}

function grain(g: CanvasRenderingContext2D, pal: Pal) {
  const n = document.createElement('canvas')
  n.width = n.height = 256
  const x = n.getContext('2d')!
  const d = x.createImageData(256, 256)
  const r = rng(7)
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
  x.putImageData(d, 0, 0)
  g.save()
  g.globalCompositeOperation = pal.grain.op
  g.globalAlpha = pal.grain.amount
  g.fillStyle = g.createPattern(n, 'repeat')!
  g.fillRect(0, 0, W, H)
  g.restore()
}

function sticker(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, r: number, ring: string, tilt: number, pal: Pal) {
  g.save()
  g.translate(x, y)
  g.rotate(tilt)
  g.shadowColor = pal.shadow; g.shadowOffsetX = 5; g.shadowOffsetY = 8; g.shadowBlur = 0
  g.fillStyle = `rgb(${ring})`
  g.beginPath(); g.arc(0, 0, r + 9, 0, Math.PI * 2); g.fill()
  g.shadowColor = 'transparent'
  g.fillStyle = pal.sticker
  g.beginPath(); g.arc(0, 0, r + 4, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip()
  g.drawImage(img, -r, -r, r * 2, r * 2)
  g.restore()
}

export function inked(g: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, pal: Pal) {
  g.font = font
  g.textAlign = 'center'
  for (const o of pal.title) { g.fillStyle = o.c; g.fillText(text, x + o.dx, y + o.dy) }
  g.fillStyle = pal.ink
  g.fillText(text, x, y)
}

export type PosterOptions = { song: Song; byId: Map<number, Chog>; title: string; subtitle?: string; hero?: Chog; mode?: Theme }

export async function makePoster({ song, byId, title, subtitle, hero, mode }: PosterOptions): Promise<Blob> {
  const pal = palette(mode)
  const ids = [...new Set(song.notes.map(n => n.id))]
  const imgs = new Map<number, HTMLImageElement>()
  await Promise.all([
    document.fonts?.load('150px "Bagel Fat One"'),
    document.fonts?.load('600 34px "Hanken Grotesk"'),
    ...ids.slice(0, 60).map(async id => { const c = byId.get(id); if (c) imgs.set(id, await load(thumb(c.n))) }),
  ])

  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')!
  const seed = hash(`poster:${title}:${song.notes.map(n => `${n.id}.${n.step}.${n.pitch}`).join(',')}`)
  const r = rng(seed)

  paintBackground(g, W, H, pal)

  // the field the song is painted on
  const fx = 70, fy = 420, fw = W - 140, fh = 700
  const pos = song.notes.map(n => ({
    n,
    x: fx + 40 + (n.step / (STEPS - 1)) * (fw - 80) + (r() - 0.5) * 36,
    y: fy + fh - 50 - (n.pitch / (PITCHES - 1)) * (fh - 100) + (r() - 0.5) * 36,
  }))

  // print character: halftone corners in the second ink
  halftone(g, 40, 40, 360, pal.dotsA)
  halftone(g, W - 30, H - 30, 380, pal.dotsB)

  // the field: clip everything painted to it
  g.save()
  g.beginPath(); g.rect(fx - 10, fy - 10, fw + 20, fh + 20); g.clip()
  g.fillStyle = pal.field // the print area
  g.fillRect(fx - 10, fy - 10, fw + 20, fh + 20)

  // a giant ghosted vowel behind the painting: the poster says what the voice sings
  const lead = hero ?? byId.get(song.notes[0]?.id ?? -1)
  if (lead) {
    g.save()
    g.globalCompositeOperation = pal.paint
    g.font = '430px "Bagel Fat One", system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillStyle = `rgba(${PAINT[lead.spec.vowel]},${pal.ghost})`
    g.fillText(['ahh', 'ehh', 'eee', 'ohh', 'ooo'][lead.spec.vowel], fx + fw / 2, fy + fh / 2 + 150)
    g.restore()
  }

  // record grooves around the heart of the poster
  g.save()
  g.strokeStyle = pal.grooves; g.lineWidth = 2
  for (let rr = 190; rr < 640; rr += 15) { g.beginPath(); g.arc(fx + fw / 2, fy + fh / 2 - 10, rr, 0, Math.PI * 2); g.stroke() }
  g.restore()

  g.save()
  g.globalCompositeOperation = pal.paint
  const swatches = new Map<number, string[]>()
  for (const p of pos) {
    const chog = byId.get(p.n.id)
    const img = imgs.get(p.n.id)
    if (!chog || !img) continue
    if (!swatches.has(chog.id)) swatches.set(chog.id, palette_of(img, PAINT[chog.spec.vowel]))
    const own = swatches.get(chog.id)!
    const col = own[Math.floor(r() * own.length)]
    const rad = 130 + chog.spec.unison * 36 + r() * 80
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
    grad.addColorStop(0, `rgba(${col},${0.8 * pal.bloom})`); grad.addColorStop(0.5, `rgba(${col},${0.34 * pal.bloom})`); grad.addColorStop(1, `rgba(${col},0)`)
    g.fillStyle = grad
    g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2)
    // three rings out from every note, in the colour of its vowel: the voice leaving the mouth
    const vc = PAINT[chog.spec.vowel]
    for (let k = 1; k <= 3; k++) { g.strokeStyle = `rgba(${vc},${0.62 - k * 0.15})`; g.lineWidth = 6 - k; g.beginPath(); g.arc(p.x, p.y, 46 + k * 38, 0, Math.PI * 2); g.stroke() }
  }
  g.restore()

  // the tune as a line: each note joined to the next in time, like a Kandinsky stroke
  const line = [...pos].sort((a, b) => a.n.step - b.n.step || a.n.pitch - b.n.pitch)
  if (line.length > 1) {
    g.save()
    g.strokeStyle = pal.tune; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(line[0].x, line[0].y)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i]
      g.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 50 - r() * 40, b.x, b.y)
    }
    g.stroke()
    g.restore()
  }

  g.restore() // end of the field clip

  // faces as stickers on top (a hero Chog is drawn big)
  const dedupe = new Set<number>()
  for (const p of pos) {
    const img = imgs.get(p.n.id), chog = byId.get(p.n.id)
    if (!img || !chog || dedupe.size > 40) continue
    const key = p.n.id * 100 + p.n.step
    if (dedupe.has(key)) continue
    dedupe.add(key)
    sticker(g, img, p.x, p.y, 34 + chog.spec.unison * 3, PAINT[chog.spec.vowel], ((hash(String(key)) % 9) - 4) * 0.025, pal)
  }
  if (hero) {
    const big = await load(thumbLg(hero.n))
    const hs = 300
    g.save()
    g.translate(W / 2, fy + fh / 2 - 10)
    g.rotate(-0.045)
    g.shadowColor = pal.shadow; g.shadowOffsetX = 10; g.shadowOffsetY = 14
    g.fillStyle = `rgb(${PAINT[hero.spec.vowel]})`
    g.beginPath(); g.roundRect(-hs / 2 - 14, -hs / 2 - 14, hs + 28, hs + 28, 46); g.fill()
    g.shadowColor = 'transparent'
    g.fillStyle = pal.sticker
    g.beginPath(); g.roundRect(-hs / 2 - 6, -hs / 2 - 6, hs + 12, hs + 12, 40); g.fill()
    g.beginPath(); g.roundRect(-hs / 2, -hs / 2, hs, hs, 34); g.clip()
    g.drawImage(big, -hs / 2, -hs / 2, hs, hs)
    g.restore()
  }

  // frame, like a printed edge
  g.strokeStyle = pal.frame; g.lineWidth = 5
  g.strokeRect(fx - 10, fy - 10, fw + 20, fh + 20)

  // type
  g.textBaseline = 'alphabetic'
  g.fillStyle = pal.soft
  g.font = '600 30px "Hanken Grotesk", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('CHOG CHOIR PRESENTS', W / 2, 108)
  inked(g, title, W / 2, 270, '150px "Bagel Fat One", system-ui, sans-serif', pal)
  g.fillStyle = pal.ink
  g.font = '700 38px "Hanken Grotesk", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText(subtitle ?? `${keyName(song.root, song.mode)}, ${song.tempo} bpm, ${BEATS[song.beat].toLowerCase()} beat`, W / 2, 352)

  // the five vowel colours, as a colour bar and the credits line
  const bw = (W - 140) / 5
  PAINT.forEach((c, i) => { g.fillStyle = `rgb(${c})`; g.fillRect(70 + i * bw, 1166, bw, 18) })
  g.fillStyle = pal.ink
  g.font = '40px "Bagel Fat One", system-ui, sans-serif'
  g.textAlign = 'left'
  g.fillText('Chog Choir', 70, 1262)
  g.font = '600 28px "Hanken Grotesk", system-ui, sans-serif'
  g.textAlign = 'right'
  g.fillText(`${ids.length} ${ids.length === 1 ? 'voice' : 'voices'}. Every Chog has a voice.`, W - 70, 1262)

  grain(g, pal)
  return new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Could not make the poster.'))), 'image/png'))
}
