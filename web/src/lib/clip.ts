import type { ChoirEngine } from '../audio/engine'
import { stepSeconds } from '../audio/synth'
import type { Chog } from '../data/chogs'
import { thumb } from '../data/chogs'
import { keyName, PITCHES, STEPS } from './music'
import type { Song } from './share'
import { BEATS } from '../audio/band'
import { halftone, inked } from './poster'
import { thumbLg } from '../data/chogs'

const SIZE = 1080
const RING = ['#ff6b57', '#ffb02e', '#2fcf95', '#35b6f0', '#a47bff']
const SOUND = ['ahh', 'ehh', 'eee', 'ohh', 'ooo']
const INK = '#14143a'

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>(resolve => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => resolve(i)
    i.src = src
  })

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

type Frame = { t: number }

function makeDrawer(song: Song, byId: Map<number, Chog>, faces: Map<number, HTMLImageElement>, title: string, subtitle: string) {
  const stepDur = stepSeconds(song.tempo)
  const pad = 54
  const gridX = 150, gridY = 262, gridW = SIZE - pad - gridX - 30, gridH = 660
  const cw = gridW / STEPS, ch = gridH / PITCHES

  return (g: CanvasRenderingContext2D, { t }: Frame) => {
    g.fillStyle = '#2a36d4'
    g.fillRect(0, 0, SIZE, SIZE)
    g.fillStyle = '#f5f6fd'
    round(g, pad - 20, pad - 20, SIZE - (pad - 20) * 2, SIZE - (pad - 20) * 2, 52); g.fill()

    g.fillStyle = INK
    g.textBaseline = 'alphabetic'
    g.font = '64px "Bagel Fat One", system-ui, sans-serif'
    g.fillText(title, pad + 18, pad + 66)
    g.fillStyle = '#55577f'
    g.font = '600 28px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(subtitle, pad + 18, pad + 112)

    // staff paper
    g.fillStyle = '#fff'
    round(g, gridX - 62, gridY - 18, gridW + 62 + 26, gridH + 36, 30); g.fill()
    for (let p = 0; p < PITCHES; p++) {
      const y = gridY + (PITCHES - 1 - p) * ch + ch / 2
      g.strokeStyle = 'rgba(20,20,58,.2)'
      g.lineWidth = 2
      g.beginPath(); g.moveTo(gridX, y); g.lineTo(gridX + gridW, y); g.stroke()
    }
    for (let s = 0; s < STEPS; s += 4) {
      g.strokeStyle = 'rgba(20,20,58,.16)'
      g.beginPath(); g.moveTo(gridX + s * cw, gridY); g.lineTo(gridX + s * cw, gridY + gridH); g.stroke()
    }

    const elapsed = Math.max(0, t)
    const stepIdx = Math.floor(elapsed / stepDur)
    const step = stepIdx % STEPS
    const since = elapsed - stepIdx * stepDur
    if (t >= 0) {
      g.fillStyle = 'rgba(255,210,63,.55)'
      round(g, gridX + step * cw, gridY - 8, cw, gridH + 16, 16); g.fill()
    }

    for (const n of song.notes) {
      const chog = byId.get(n.id)
      const img = faces.get(n.id)
      if (!chog || !img) continue
      const cx = gridX + n.step * cw + cw / 2
      const cy = gridY + (PITCHES - 1 - n.pitch) * ch + ch / 2
      const hit = t >= 0 && n.step === step
      const k = hit ? 1 + 0.3 * Math.max(0, 1 - since / 0.26) : 1
      const r = Math.min(cw, ch) * 0.47 * k
      g.save()
      g.shadowColor = 'rgba(20,20,58,.2)'; g.shadowOffsetY = 4; g.shadowBlur = 0
      g.fillStyle = RING[chog.spec.vowel]
      g.beginPath(); g.arc(cx, cy, r + 3.5, 0, Math.PI * 2); g.fill()
      g.restore()
      g.save()
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip()
      g.drawImage(img, cx - r, cy - r, r * 2, r * 2)
      g.restore()
      if (hit && since < 0.7) {
        const a = Math.max(0, 1 - since / 0.7)
        g.save()
        g.globalAlpha = a
        g.font = '30px "Bagel Fat One", system-ui, sans-serif'
        g.textAlign = 'center'
        g.lineWidth = 8; g.strokeStyle = '#fff'; g.lineJoin = 'round'
        g.strokeText(SOUND[chog.spec.vowel], cx, cy - r - 8 - since * 40)
        g.fillStyle = RING[chog.spec.vowel]
        g.fillText(SOUND[chog.spec.vowel], cx, cy - r - 8 - since * 40)
        g.restore()
      }
    }

    g.textAlign = 'left'
    g.fillStyle = INK
    g.font = '40px "Bagel Fat One", system-ui, sans-serif'
    g.fillText('Chog Choir', pad + 18, SIZE - pad - 6)
    g.textAlign = 'right'
    g.fillStyle = '#55577f'
    g.font = '600 26px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText('Every Chog has a voice', SIZE - pad - 18, SIZE - pad - 8)
    g.textAlign = 'left'
  }
}

/** One Chog as a record: the sleeve pulses on the beat, the disc spins out behind it, bubbles pop when it sings. */
function makeCardDrawer(song: Song, chog: Chog, face: HTMLImageElement, title: string) {
  const stepDur = stepSeconds(song.tempo)
  const meta = `${keyName(song.root, song.mode)}, ${song.tempo} bpm, ${BEATS[song.beat].toLowerCase()} beat`
  const vc = RING[chog.spec.vowel]
  return (g: CanvasRenderingContext2D, { t }: Frame) => {
    const bg = g.createRadialGradient(SIZE / 2, -60, 40, SIZE / 2, 300, 1250)
    bg.addColorStop(0, '#3a47e6'); bg.addColorStop(0.55, '#232fc4'); bg.addColorStop(1, '#141a86')
    g.fillStyle = bg
    g.fillRect(0, 0, SIZE, SIZE)
    halftone(g, 30, 30, 330, 'rgba(255,79,163,.5)')
    halftone(g, SIZE - 20, SIZE - 20, 330, 'rgba(45,180,242,.45)')

    g.textAlign = 'center'
    g.fillStyle = 'rgba(255,255,255,.85)'
    g.font = '600 28px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText('CHOG CHOIR PRESENTS', SIZE / 2, 86)

    const elapsed = Math.max(0, t)
    const stepIdx = Math.floor(elapsed / stepDur)
    const step = stepIdx % STEPS
    const since = elapsed - stepIdx * stepDur
    const sings = t >= 0 && song.notes.some(n => n.step === step)

    // a bloom of the vowel's colour on every note, behind the record
    if (sings) {
      const a = Math.max(0, 1 - since / 0.9)
      const rad = 420 + (1 - a) * 160
      g.save()
      g.globalCompositeOperation = 'screen'
      const gr = g.createRadialGradient(SIZE / 2, 440, 0, SIZE / 2, 440, rad)
      gr.addColorStop(0, `${vc}${Math.round(a * 150).toString(16).padStart(2, '0')}`)
      gr.addColorStop(1, `${vc}00`)
      g.fillStyle = gr
      g.fillRect(0, 0, SIZE, SIZE)
      g.restore()
    }

    // the disc: grooves, a rim in the vowel's colour, a label that turns with it
    const cx = SIZE / 2 + 150, cy = 440, R = 250
    const spin = elapsed * 1.6
    g.save()
    g.shadowColor = 'rgba(8,10,84,.5)'; g.shadowOffsetX = 10; g.shadowOffsetY = 12
    g.fillStyle = '#12122b'
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
    g.restore()
    g.save()
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip()
    g.strokeStyle = 'rgba(120,120,200,.16)'; g.lineWidth = 2
    for (let rr = R * 0.4; rr < R * 0.93; rr += 7) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke() }
    g.strokeStyle = vc; g.lineWidth = 9
    g.beginPath(); g.arc(cx, cy, R * 0.88, 0, Math.PI * 2); g.stroke()
    g.translate(cx, cy); g.rotate(spin)
    for (const a0 of [0.25, 3.4]) {
      const sh = g.createLinearGradient(0, 0, Math.cos(a0) * R, Math.sin(a0) * R)
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.16)')
      g.fillStyle = sh
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + 0.5); g.closePath(); g.fill()
    }
    g.save()
    g.beginPath(); g.arc(0, 0, R * 0.38, 0, Math.PI * 2); g.clip()
    g.drawImage(face, -R * 0.38, -R * 0.38, R * 0.76, R * 0.76)
    g.restore()
    g.strokeStyle = vc; g.lineWidth = 6
    g.beginPath(); g.arc(0, 0, R * 0.38, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#f5f6fd'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill()
    g.restore()
    g.strokeStyle = INK; g.lineWidth = 5
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke()

    // the sleeve, on top, keeping time
    const k = t < 0 ? 1 : 1 + (sings ? 0.06 : 0.015) * Math.max(0, 1 - since / (sings ? 0.3 : 0.18))
    const sz = 400 * k
    const sx = SIZE / 2 - 190, sy = 440
    g.save()
    g.translate(sx, sy); g.rotate(-0.04)
    g.shadowColor = 'rgba(8,10,84,.55)'; g.shadowOffsetX = 12; g.shadowOffsetY = 14
    g.fillStyle = INK
    g.beginPath(); g.roundRect(-sz / 2 - 6, -sz / 2 - 6, sz + 12, sz + 12, 20); g.fill()
    g.shadowColor = 'transparent'
    g.beginPath(); g.roundRect(-sz / 2, -sz / 2, sz, sz, 14); g.clip()
    g.drawImage(face, -sz / 2, -sz / 2, sz, sz)
    g.restore()

    if (sings && since < 0.8) {
      g.save()
      g.globalAlpha = Math.max(0, 1 - since / 0.8)
      g.font = '70px "Bagel Fat One", system-ui, sans-serif'
      g.lineWidth = 14; g.strokeStyle = '#fff'; g.lineJoin = 'round'
      const y = sy - 220 - since * 70
      g.strokeText(SOUND[chog.spec.vowel], sx + 40, y)
      g.fillStyle = vc
      g.fillText(SOUND[chog.spec.vowel], sx + 40, y)
      g.restore()
    }

    inked(g, title, SIZE / 2, 850, '120px "Bagel Fat One", system-ui, sans-serif')
    g.fillStyle = '#fff'
    g.font = '700 32px "Hanken Grotesk", system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(meta, SIZE / 2, 906)

    // the loop, one dot per step: the ones that sing are in the vowel's colour, the playhead is yellow
    const x0 = SIZE / 2 - (STEPS - 1) * 26
    for (let s = 0; s < STEPS; s++) {
      const sing = song.notes.some(n => n.step === s)
      g.beginPath()
      g.arc(x0 + s * 52, 990, s === step && t >= 0 ? 15 : 10, 0, Math.PI * 2)
      g.fillStyle = s === step && t >= 0 ? '#ffd23f' : sing ? vc : 'rgba(255,255,255,.28)'
      g.fill()
    }
    g.fillStyle = '#fff'
    g.font = '36px "Bagel Fat One", system-ui, sans-serif'
    g.fillText('Chog Choir', SIZE / 2, 1052)
    g.textAlign = 'left'
  }
}

function pickMime(): { mime: string; ext: string } {
  const options = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ]
  for (const [mime, ext] of options) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  throw new Error('This browser cannot record video. Try Chrome, Edge or Safari.')
}

export type ClipOptions = {
  song: Song
  byId: Map<number, Chog>
  engine: ChoirEngine
  title?: string
  subtitle?: string
  /** 'card' shows one Chog large; the default shows the whole staff */
  card?: Chog
  loops?: number
  onProgress?(fraction: number): void
}

/** Plays the song once through, and records what you hear and see into a short video. */
export async function recordClip({ song, byId, engine, title, subtitle, card, loops = 2, onProgress }: ClipOptions): Promise<{ blob: Blob; ext: string }> {
  const { mime, ext } = pickMime()
  const ids = [...new Set(song.notes.map(n => n.id))]
  const faces = new Map<number, HTMLImageElement>()
  await Promise.all([
    document.fonts?.load('64px "Bagel Fat One"'),
    document.fonts?.load('600 28px "Hanken Grotesk"'),
    ...ids.map(async id => { const c = byId.get(id); if (c) faces.set(id, await loadImg(thumb(c.n))) }),
  ])

  const cardFace = card ? await loadImg(thumbLg(card.n)) : null
  const draw = card && cardFace
    ? makeCardDrawer(song, card, cardFace, title ?? `Chog #${card.n}`)
    : makeDrawer(song, byId, faces, title ?? keyName(song.root, song.mode), subtitle ?? `${ids.length} ${ids.length === 1 ? 'Chog' : 'Chogs'} · ${song.notes.length} notes`)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const g = canvas.getContext('2d')!
  draw(g, { t: -1 })

  const stream = canvas.captureStream(30)
  engine.recordTap.stream.getAudioTracks().forEach(t => stream.addTrack(t))
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<void>(res => { rec.onstop = () => res() })

  engine.stop()
  engine.setSong(song)
  rec.start(250)
  await engine.start(true)

  const loopSec = stepSeconds(song.tempo) * STEPS
  const total = loops * loopSec + 1.6 // let the last notes ring out
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = engine.ctx.currentTime - engine.t0 - (engine.ctx.outputLatency || 0)
      draw(g, { t })
      onProgress?.(Math.min(1, Math.max(0, t / total)))
      if (t >= total) return resolve()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  engine.stop()
  rec.stop()
  await done
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext }
}
