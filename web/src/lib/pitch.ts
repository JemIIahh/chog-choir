import { midiFor, PITCHES, STEPS } from './music'
import type { Note } from './share'

/**
 * Pitch of one short window of a voice, in Hz, or null when the window is silent or has no clear pitch.
 * Normalised autocorrelation (the McLeod "first strong peak" rule), so a breathy hum or a low rumble is not mistaken for a note.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 85, maxHz = 800): number | null {
  const n = buf.length
  let energy = 0
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i]
  if (Math.sqrt(energy / n) < 0.012) return null // too quiet to be a voice

  const minLag = Math.floor(sampleRate / maxHz)
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / minHz))
  const nsdf = new Float32Array(maxLag + 2)
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let acf = 0
    let norm = 0
    for (let i = 0; i + lag < n; i++) {
      acf += buf[i] * buf[i + lag]
      norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag]
    }
    nsdf[lag] = norm > 0 ? (2 * acf) / norm : 0
  }

  // peaks of the curve between zero crossings; take the first one that is nearly as tall as the tallest
  const peaks: number[] = []
  let lag = minLag
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag] > 0) lag++ // skip the lobe we start in (lag 0 is always perfect)
    while (lag <= maxLag && nsdf[lag] <= 0) lag++
    let best = -1
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (best < 0 || nsdf[lag] > nsdf[best]) best = lag
      lag++
    }
    if (best >= 0) peaks.push(best)
  }
  // a window that starts inside a positive lobe at minLag still has real peaks later; also consider the very first lobe
  if (nsdf[minLag] > 0) {
    let b = minLag
    for (let l = minLag; l <= maxLag && nsdf[l] > 0; l++) if (nsdf[l] > nsdf[b]) b = l
    if (b > minLag && b < maxLag && nsdf[b] >= nsdf[b - 1] && nsdf[b] >= nsdf[b + 1]) peaks.unshift(b)
  }
  if (peaks.length === 0) return null
  const top = Math.max(...peaks.map(p => nsdf[p]))
  if (top < 0.55) return null // noise, not a held pitch
  const pick = peaks.find(p => nsdf[p] >= 0.9 * top)!
  // parabolic interpolation around the peak for a fraction of a sample
  const a = nsdf[pick - 1], b = nsdf[pick], c = nsdf[pick + 1]
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0
  return sampleRate / (pick + shift)
}

export const midiOfHz = (hz: number) => 69 + 12 * Math.log2(hz / 440)

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Turn what someone hummed (one pitch per step of the loop, null where they were silent) into notes for a Chog:
 * the tune is moved by whole octaves into the Chog's range, then each step snaps to the nearest row of the song's scale.
 * A held note becomes one note, not sixteen. Returns [] when there was not enough singing to make a tune of.
 */
export function hummedNotes(frames: (number | null)[], root: number, mode: number, range: { low: number; high: number }, id: number): Note[] {
  const voiced = frames.map((hz, step) => ({ step, midi: hz ? midiOfHz(hz) : null })).filter((f): f is { step: number; midi: number } => f.midi !== null)
  if (voiced.length < 3) return []

  // whole octaves only, so the tune keeps its shape
  const mid = Math.round((range.low + range.high) / 2)
  const octave = Math.round((midiFor(mid, root, mode) - median(voiced.map(v => v.midi))) / 12) * 12
  const rows = Array.from({ length: PITCHES }, (_, r) => midiFor(r, root, mode))
  const nearest = (midi: number) => {
    let best = 0
    for (let r = 1; r < PITCHES; r++) if (Math.abs(rows[r] - midi) < Math.abs(rows[best] - midi)) best = r
    return Math.min(range.high, Math.max(range.low, best))
  }

  const notes: Note[] = []
  let prev: { step: number; row: number } | null = null
  for (const v of voiced) {
    const row = nearest(v.midi + octave)
    const continues = prev && prev.step === v.step - 1 && prev.row === row
    if (!continues && v.step < STEPS) notes.push({ id, step: v.step, pitch: row })
    prev = { step: v.step, row }
  }
  return notes
}
