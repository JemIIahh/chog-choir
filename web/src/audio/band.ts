import type { Song } from '../lib/share'
import { stepSeconds } from './timing'
import type { Bus } from './synth'

// The band behind the choir: kick, snare/clap, hats, bass and a chord pad, all synthesised.
// One step is an eighth note, so a 16-step loop is two bars of 4/4. Patterns are indexed by step % 8 (bar-relative).

export const BEATS = ['No beat', 'Lo-fi', 'Pulse', 'Halftime'] as const
export type BeatId = 0 | 1 | 2 | 3

type Pattern = {
  kick: number[]
  snare: number[]
  clap?: boolean // use a clap instead of a snare
  hat: (n: number) => number // velocity of the hat on bar-step n (0 = rest)
  openHat?: number[]
  bass: [step: number, lenSteps: number][]
  bassStyle: 'pluck' | 'sub'
}

const PATTERNS: Record<1 | 2 | 3, Pattern> = {
  // boom-bap: kick on 1 and the "and" of 2, snare on 2 and 4, lazy hats
  1: { kick: [0, 3], snare: [2, 6], hat: n => (n % 2 === 0 ? 0.55 : 0.28), openHat: [7], bass: [[0, 2.6], [3, 2], [6, 1.4]], bassStyle: 'pluck' },
  // four on the floor, clap on 2 and 4, open hats on the off-beats, bass on the off-beats
  2: { kick: [0, 2, 4, 6], snare: [2, 6], clap: true, hat: n => (n % 2 === 1 ? 0.6 : 0), openHat: [1, 3, 5, 7], bass: [[1, 0.9], [3, 0.9], [5, 0.9], [7, 0.9]], bassStyle: 'pluck' },
  // slow and heavy: the snare waits for beat 3, the bass holds
  3: { kick: [0, 5], snare: [4], hat: n => (n % 2 === 0 ? 0.4 : 0.22), bass: [[0, 5], [5.5, 2]], bassStyle: 'sub' },
}

const MINOR_MODES = new Set([0, 2, 4])

/** Two bars per loop: the second bar leans on the chord a step below the root (minor) or the fourth (major). */
const barOffset = (mode: number, bar: number) => (bar === 0 ? 0 : MINOR_MODES.has(mode) ? -2 : 5)
const bassMidi = (root: number, off: number) => {
  const m = 24 + ((((root + off) % 12) + 12) % 12)
  return m < 28 ? m + 12 : m
}
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

function noise(ctx: BaseAudioContext, bus: Bus, t: number, len: number) {
  const n = ctx.createBufferSource()
  n.buffer = bus.noise
  n.loop = true
  n.start(t, (t * 7.31) % 1.5)
  n.stop(t + len)
  return n
}

function kick(ctx: BaseAudioContext, bus: Bus, t: number, vel: number) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(165, t)
  o.frequency.exponentialRampToValueAtTime(44, t + 0.13)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.66 * vel, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
  o.connect(g)
  g.connect(bus.input)
  o.start(t)
  o.stop(t + 0.45)
}

function snare(ctx: BaseAudioContext, bus: Bus, t: number, vel: number) {
  const n = noise(ctx, bus, t, 0.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 0.7
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.34 * vel, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  n.connect(bp)
  bp.connect(g)
  g.connect(bus.input)
  const send = ctx.createGain()
  send.gain.value = 0.25
  g.connect(send)
  send.connect(bus.reverbSend)

  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(210, t)
  body.frequency.exponentialRampToValueAtTime(150, t + 0.08)
  const bg = ctx.createGain()
  bg.gain.setValueAtTime(0.22 * vel, t)
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  body.connect(bg)
  bg.connect(bus.input)
  body.start(t)
  body.stop(t + 0.14)
}

function clap(ctx: BaseAudioContext, bus: Bus, t: number, vel: number) {
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1250
  bp.Q.value = 1.1
  const g = ctx.createGain()
  const n = noise(ctx, bus, t, 0.35)
  n.connect(bp)
  bp.connect(g)
  g.connect(bus.input)
  const send = ctx.createGain()
  send.gain.value = 0.35
  g.connect(send)
  send.connect(bus.reverbSend)
  g.gain.setValueAtTime(0.0001, t)
  for (const d of [0, 0.011, 0.023]) {
    g.gain.setValueAtTime(0.3 * vel, t + d)
    g.gain.exponentialRampToValueAtTime(0.02, t + d + 0.009)
  }
  g.gain.setValueAtTime(0.3 * vel, t + 0.034)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
}

function hat(ctx: BaseAudioContext, bus: Bus, t: number, vel: number, open: boolean) {
  const n = noise(ctx, bus, t, open ? 0.3 : 0.1)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7200
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.13 * vel, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.05))
  n.connect(hp)
  hp.connect(g)
  g.connect(bus.input)
}

function bass(ctx: BaseAudioContext, bus: Bus, t: number, midi: number, dur: number, vel: number, style: 'pluck' | 'sub') {
  const f = midiHz(midi)
  const a = ctx.createOscillator()
  a.type = style === 'sub' ? 'sine' : 'triangle'
  a.frequency.value = f
  const b = ctx.createOscillator()
  b.type = 'sine'
  b.frequency.value = f / 2
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(style === 'sub' ? 380 : 900, t)
  lp.frequency.exponentialRampToValueAtTime(style === 'sub' ? 260 : 340, t + 0.18)
  const g = ctx.createGain()
  const end = t + dur
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.01)
  g.gain.setTargetAtTime(0.23 * vel, t + 0.02, 0.12)
  g.gain.setValueAtTime(0.23 * vel, end)
  g.gain.setTargetAtTime(0, end, 0.05)
  a.connect(lp)
  b.connect(lp)
  lp.connect(g)
  g.connect(bus.input)
  a.start(t); b.start(t)
  a.stop(end + 0.4); b.stop(end + 0.4)
}

/** Soft chord under the voices; one chord per bar. */
function pad(ctx: BaseAudioContext, bus: Bus, t: number, rootMidi: number, minor: boolean, hirajoshi: boolean, dur: number) {
  const notes = hirajoshi ? [0, 7, 12] : [0, minor ? 3 : 4, 7]
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.linearRampToValueAtTime(0.5, t + 0.22)
  out.gain.setValueAtTime(0.5, t + dur)
  out.gain.setTargetAtTime(0, t + dur, 0.18)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 620
  lp.Q.value = 0.5
  lp.connect(out)
  out.connect(bus.input)
  const send = ctx.createGain()
  send.gain.value = 0.5
  out.connect(send)
  send.connect(bus.reverbSend)
  for (const n of notes)
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = midiHz(rootMidi + n)
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.value = 0.028
      o.connect(g)
      g.connect(lp)
      o.start(t)
      o.stop(t + dur + 1.2)
    }
}

export function scheduleBand(ctx: BaseAudioContext, bus: Bus, song: Song, step: number, time: number) {
  const id = song.beat as BeatId
  if (id === 0) return
  const layers = song.layers ?? 3 // 1 pad, 2 + bass, 3 + drums
  const p = PATTERNS[id]
  const dur = stepSeconds(song.tempo)
  const bar = step < 8 ? 0 : 1
  const n = step % 8
  const off = barOffset(song.mode, bar)

  if (layers >= 3) {
    if (p.kick.includes(n)) kick(ctx, bus, time, n === 0 ? 1 : 0.85)
    if (p.snare.includes(n)) (p.clap ? clap : snare)(ctx, bus, time, 0.95)
    const hv = p.hat(n)
    const open = p.openHat?.includes(n) ?? false
    if (hv > 0 || open) hat(ctx, bus, time, open ? 0.7 : hv, open)
  }

  for (const [bs, len] of layers >= 2 ? p.bass : []) {
    if (Math.floor(bs) !== n) continue
    const t = time + (bs - n) * dur
    bass(ctx, bus, t, bassMidi(song.root, off), len * dur * 0.92, 1, p.bassStyle)
  }

  if (n === 0 && layers >= 1) {
    const root = 48 + ((((song.root + off) % 12) + 12) % 12)
    pad(ctx, bus, time, root, MINOR_MODES.has(song.mode), song.mode === 4, dur * 8)
  }
}
