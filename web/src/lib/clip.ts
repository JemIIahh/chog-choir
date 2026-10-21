import type { ChoirEngine } from '../audio/engine'
import { stepSeconds } from '../audio/synth'
import type { Chog } from '../data/chogs'
import { thumb } from '../data/chogs'
import { keyName, PITCHES, STEPS } from './music'
import type { Song } from './share'
import { BEATS } from '../audio/band'
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

/** One Chog, big: its face keeps time, and bubbles pop when it sings. Used for single-Chog song clips. */
function makeCardDrawer(song: Song, chog: Chog, face: HTMLImageElement, title: string) {
  const stepDur = stepSeconds(song.tempo)
  const meta = `${keyName(song.root, song.mode)}, ${song.tempo} bpm, ${BEATS[song.beat].toLowerCase()} beat`
  return (g: CanvasRenderingContext2D, { t }: Frame) => {
    g.fillStyle = '#2a36d4'
    g.fillRect(0, 0, SIZE, SIZE)
    g.fillStyle = '#f5f6fd'
    round(g, 34, 34, SIZE - 68, SIZE - 68, 52); g.fill()

    g.textAlign = 'center'
    g.fillStyle = INK
    g.font = '44px "Bagel Fat One", system-ui, sans-serif'
    g.fillText('Chog Choir', SIZE / 2, 118)

    const elapsed = Math.max(0, t)
    const stepIdx = Math.floor(elapsed / stepDur)
    const step = stepIdx % STEPS
    const since = elapsed - stepIdx * stepDur
    const sings = t >= 0 && song.notes.some(n => n.step === step)
    const k = t < 0 ? 1 : 1 + (sings ? 0.07 : 0.02) * Math.max(0, 1 - since / (sings ? 0.3 : 0.18))
    const size = 470 * k
    const cx = SIZE / 2, cy = 420
    g.save()
    g.shadowColor = 'rgba(20,20,58,.22)'; g.shadowOffsetY = 14; g.shadowBlur = 0
    g.fillStyle = RING[chog.spec.vowel]
    round(g, cx - size / 2 - 12, cy - size / 2 - 12, size + 24, size + 24, 78); g.fill()
    g.restore()
    g.save()
    round(g, cx - size / 2, cy - size / 2, size, size, 66); g.clip()
    g.drawImage(face, cx - size / 2, cy - size / 2, size, size)
    g.restore()

    if (sings && since < 0.8) {
      g.save()
      g.globalAlpha = Math.max(0, 1 - since / 0.8)
      g.font = '64px "Bagel Fat One", system-ui, sans-serif'
      g.lineWidth = 12; g.strokeStyle = '#fff'; g.lineJoin = 'round'
      const y = cy - size / 2 - 22 - since * 70
      g.strokeText(SOUND[chog.spec.vowel], cx, y)
      g.fillStyle = RING[chog.spec.vowel]
      g.fillText(SOUND[chog.spec.vowel], cx, y)
      g.restore()
    }

    g.fillStyle = INK
    g.font = '86px "Bagel Fat One", system-ui, sans-serif'
    g.fillText(title, SIZE / 2, 770)
    g.fillStyle = '#55577f'
    g.font = '600 32px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(meta, SIZE / 2, 822)

    // the loop, one dot per step: the dots that sing are filled, the playhead is yellow
    const x0 = SIZE / 2 - (STEPS - 1) * 26
    for (let s = 0; s < STEPS; s++) {
      const sing = song.notes.some(n => n.step === s)
      g.beginPath()
      g.arc(x0 + s * 52, 910, s === step && t >= 0 ? 15 : 10, 0, Math.PI * 2)
      g.fillStyle = s === step && t >= 0 ? '#ffd23f' : sing ? RING[chog.spec.vowel] : 'rgba(20,20,58,.16)'
      g.fill()
    }
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
