import { hzOf, midiFor } from '../lib/music'
import type { Note, Song } from '../lib/share'
import { hash, type VoiceSpec } from './voice'

// Adult-ish formant frequencies (Hz) for AH EH EE OH OO, and how loud/wide each band is.
const FORMANTS = [
  [730, 1090, 2440],
  [530, 1840, 2480],
  [270, 2290, 3010],
  [570, 840, 2410],
  [300, 870, 2240],
]
const FORMANT_GAIN = [1, 1.35, 0.6]
const FORMANT_BW = [90, 110, 160]

export type Bus = {
  input: GainNode
  reverbSend: GainNode
  echoSend: GainNode
  noise: AudioBuffer
  gritCurve: Float32Array<ArrayBuffer>
  output: AudioNode // the end of the chain; connect to a destination
  setSpace(v: number): void // 0..100
  setTone(v: number): void // 0..100
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const r = seeded(1234 + c * 77)
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / len
      lp += (r() * 2 - 1 - lp) * (0.55 - 0.4 * t) // room gets darker as it decays
      d[i] = lp * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.012 ? 0 : 1)
    }
  }
  return buf
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const r = seeded(99)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
  return buf
}

export function createBus(ctx: BaseAudioContext): Bus {
  const input = ctx.createGain()
  const reverbSend = ctx.createGain()
  const echoSend = ctx.createGain()
  const master = ctx.createGain()
  master.gain.value = 0.9

  input.connect(master)

  const conv = ctx.createConvolver()
  conv.buffer = makeImpulse(ctx, 2.8, 2.6)
  const wet = ctx.createGain()
  wet.gain.value = 0.5
  reverbSend.connect(conv)
  conv.connect(wet)
  wet.connect(master)

  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.34
  const fb = ctx.createGain()
  fb.gain.value = 0.38
  const dlp = ctx.createBiquadFilter()
  dlp.type = 'lowpass'
  dlp.frequency.value = 2400
  echoSend.connect(delay)
  delay.connect(dlp)
  dlp.connect(fb)
  fb.connect(delay)
  dlp.connect(master)

  const tone = ctx.createBiquadFilter()
  tone.type = 'highshelf'
  tone.frequency.value = 2400
  tone.gain.value = 0
  master.connect(tone)

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.knee.value = 18
  comp.ratio.value = 5
  comp.attack.value = 0.008
  comp.release.value = 0.25
  tone.connect(comp)

  const out = ctx.createGain()
  out.gain.value = 0.9
  comp.connect(out)

  const gritCurve = new Float32Array(new ArrayBuffer(1024 * 4))
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1
    gritCurve[i] = Math.tanh(x * 4.5) * 0.8
  }

  return {
    input,
    reverbSend,
    echoSend,
    noise: makeNoise(ctx),
    gritCurve,
    output: out,
    setSpace: v => { wet.gain.value = 0.08 + (v / 100) * 0.95 },
    setTone: v => { tone.gain.value = (v / 100 - 0.5) * 18 },
  }
}

/** Sings one note. Everything is scheduled on the audio clock, nothing here touches the main thread timers. */
export function playNote(ctx: BaseAudioContext, bus: Bus, spec: VoiceSpec, midi: number, t0: number, dur: number, vel = 1, seed = 1) {
  const f0 = hzOf(midi)
  const end = t0 + dur
  const stopAt = end + spec.release + 0.15
  const jitter = seeded(seed)

  // ── source: detuned unison, vibrato that arrives late, a small scoop up into the pitch
  const src = ctx.createGain()
  src.gain.value = 1 / Math.sqrt(spec.unison)

  const vib = ctx.createOscillator()
  vib.frequency.value = spec.vibRate * (0.94 + jitter() * 0.12)
  const vibDepth = ctx.createGain()
  vibDepth.gain.setValueAtTime(0, t0)
  vibDepth.gain.linearRampToValueAtTime(spec.vibDepth, t0 + 0.3 + spec.attack)
  vib.connect(vibDepth)
  vib.start(t0)
  vib.stop(stopAt)

  const oscs: OscillatorNode[] = []
  for (let i = 0; i < spec.unison; i++) {
    const o = ctx.createOscillator()
    o.type = spec.hollow ? 'square' : 'sawtooth'
    o.frequency.value = f0
    const off = (i - (spec.unison - 1) / 2) * spec.detune + (jitter() - 0.5) * 3
    o.detune.setValueAtTime(off - 38, t0)
    o.detune.linearRampToValueAtTime(off, t0 + 0.08)
    vibDepth.connect(o.detune)
    o.connect(src)
    o.start(t0)
    o.stop(stopAt)
    oscs.push(o)
  }

  let drive: AudioNode = src
  if (spec.fx === 'grit') {
    const ws = ctx.createWaveShaper()
    ws.curve = bus.gritCurve
    ws.oversample = '2x'
    src.connect(ws)
    drive = ws
  }

  // ── vowel: three parallel band-pass filters, plus the fundamental so low notes still read as pitch
  const sum = ctx.createGain()
  sum.gain.value = 2.4
  const formants = FORMANTS[spec.vowel]
  formants.forEach((f, i) => {
    const hz = f * spec.size
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = hz
    bp.Q.value = hz / FORMANT_BW[i]
    const g = ctx.createGain()
    g.gain.value = FORMANT_GAIN[i] * (i === 0 ? 1 : 0.6 + spec.bright * 0.9)
    drive.connect(bp)
    bp.connect(g)
    g.connect(sum)
  })
  const body = ctx.createBiquadFilter()
  body.type = 'lowpass'
  body.frequency.value = 520
  const bodyGain = ctx.createGain()
  bodyGain.gain.value = 0.22
  src.connect(body)
  body.connect(bodyGain)
  bodyGain.connect(sum)

  if (spec.fx === 'sub') {
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = f0 / 2
    const sg = ctx.createGain()
    sg.gain.value = 0.28
    sub.connect(sg)
    sg.connect(sum)
    sub.start(t0)
    sub.stop(stopAt)
  }
  if (spec.fx === 'shimmer') {
    const sh = ctx.createOscillator()
    sh.type = 'sine'
    sh.frequency.value = f0 * 2.0
    sh.detune.value = 6
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0, t0)
    sg.gain.linearRampToValueAtTime(0.16, t0 + 0.04)
    sg.gain.setTargetAtTime(0.05, t0 + 0.05, 0.4)
    sh.connect(sg)
    sg.connect(sum)
    sh.start(t0)
    sh.stop(stopAt)
  }

  // ── breath: noise through the vowel's second formant, loudest at the onset
  if (spec.breath > 0.02) {
    const n = ctx.createBufferSource()
    n.buffer = bus.noise
    n.loop = true
    const nb = ctx.createBiquadFilter()
    nb.type = 'bandpass'
    nb.frequency.value = formants[1] * spec.size
    nb.Q.value = 1.4
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(spec.breath * 0.9, t0)
    ng.gain.setTargetAtTime(spec.breath * 0.35, t0 + 0.02, 0.09)
    n.connect(nb)
    nb.connect(ng)
    ng.connect(sum)
    n.start(t0, jitter() * 1.5)
    n.stop(stopAt)
  }

  // ── brightness and envelope
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800 + spec.bright * 7000
  lp.Q.value = 0.4
  sum.connect(lp)

  const env = ctx.createGain()
  const peak = 0.34 * vel * spec.gain
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(peak, t0 + spec.attack)
  env.gain.setValueAtTime(peak, Math.max(t0 + spec.attack, end))
  env.gain.setTargetAtTime(0, end, spec.release / 3.2)
  lp.connect(env)

  let tail: AudioNode = env
  if (spec.fx === 'wobble') {
    const trem = ctx.createGain()
    trem.gain.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 7.2
    const lg = ctx.createGain()
    lg.gain.value = 0.3
    lfo.connect(lg)
    lg.connect(trem.gain)
    lfo.start(t0)
    lfo.stop(stopAt)
    env.connect(trem)
    tail = trem
  }

  const pan = ctx.createStereoPanner()
  pan.pan.value = spec.pan
  tail.connect(pan)
  pan.connect(bus.input)

  const send = ctx.createGain()
  send.gain.value = spec.space * 0.9
  pan.connect(send)
  send.connect(bus.reverbSend)

  if (spec.fx === 'echo' || spec.fx === 'shimmer') {
    const es = ctx.createGain()
    es.gain.value = spec.fx === 'echo' ? 0.5 : 0.22
    pan.connect(es)
    es.connect(bus.echoSend)
  }

  oscs[0].onended = () => {
    try { pan.disconnect(); send.disconnect() } catch { /* already gone */ }
  }
}

export const MAX_VOICES_PER_STEP = 14

/** Notes sounding on a step, capped so a crowded choir stays a choir and not noise. */
export function notesAtStep(notes: Note[], step: number): Note[] {
  const here = notes.filter(n => n.step === step)
  if (here.length <= MAX_VOICES_PER_STEP) return here
  return here
    .map(n => ({ n, k: hash(`${n.id}:${step}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, MAX_VOICES_PER_STEP)
    .map(x => x.n)
}

export type SpecOf = (id: number) => VoiceSpec

export const stepSeconds = (tempo: number) => 60 / tempo / 2
const NOTE_STEPS = 1.9

export function scheduleStep(ctx: BaseAudioContext, bus: Bus, song: Song, specOf: SpecOf, step: number, time: number) {
  const dur = stepSeconds(song.tempo) * NOTE_STEPS
  const here = notesAtStep(song.notes, step)
  const vel = Math.max(0.28, Math.min(1, 1 / Math.sqrt(Math.max(1, here.length / 3.5))))
  for (const n of here) {
    const h = hash(`${n.id}:${step}:${n.pitch}`)
    const human = ((h % 1000) / 1000 - 0.5) * 0.016 // ±8 ms
    playNote(ctx, bus, specOf(n.id), midiFor(n.pitch, song.root, song.mode), time + Math.max(0, human), dur, vel, h)
  }
}
