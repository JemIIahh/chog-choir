import { midiFor, STEPS } from '../lib/music'
import type { Song } from '../lib/share'
import { createBus, playNote, scheduleStep, stepSeconds, type Bus, type SpecOf } from './synth'
import type { VoiceSpec } from './voice'

const LOOKAHEAD = 0.18 // seconds of audio scheduled ahead of the clock
const TICK_MS = 25

export type StepEvent = { step: number; delay: number } // delay in ms until the step is heard

/** Live transport: a lookahead scheduler that loops the staff and tells the UI when each step lands. */
export class ChoirEngine {
  readonly ctx: AudioContext
  readonly bus: Bus
  readonly recordTap: MediaStreamAudioDestinationNode
  private song: Song
  private specOf: SpecOf
  private timer: number | null = null
  private nextStep = 0
  private nextTime = 0
  playing = false
  /** audio-clock time at which step 0 of the current run sounds */
  t0 = 0
  onStep: ((e: StepEvent) => void) | null = null

  constructor(song: Song, specOf: SpecOf) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.bus = createBus(this.ctx)
    this.bus.output.connect(this.ctx.destination)
    this.recordTap = this.ctx.createMediaStreamDestination()
    this.bus.output.connect(this.recordTap)
    this.song = song
    this.specOf = specOf
    this.apply()
  }

  /** Everything the engine reads live comes from here, so sliders move the sound as they move. */
  setSong(song: Song) {
    this.song = song
    this.apply()
  }

  private apply() {
    this.bus.setSpace(this.song.space)
    this.bus.setTone(this.song.bright)
  }

  async start(fromStart = true) {
    if (this.ctx.state !== 'running') await this.ctx.resume()
    if (this.playing) return
    this.playing = true
    if (fromStart) this.nextStep = 0
    this.nextTime = this.ctx.currentTime + 0.06
    if (fromStart) this.t0 = this.nextTime
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  stop() {
    this.playing = false
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      scheduleStep(this.ctx, this.bus, this.song, this.specOf, this.nextStep, this.nextTime)
      const delay = Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000)
      this.onStep?.({ step: this.nextStep, delay })
      this.nextTime += stepSeconds(this.song.tempo)
      this.nextStep = (this.nextStep + 1) % STEPS
    }
  }

  /** Hear a single Chog right now, without touching the song. */
  async audition(spec: VoiceSpec, pitch: number, id: number) {
    if (this.ctx.state !== 'running') await this.ctx.resume()
    const t = this.ctx.currentTime + 0.02
    playNote(this.ctx, this.bus, spec, midiFor(pitch, this.song.root, this.song.mode), t, 0.85, 1.8, id) // a lone Chog should be clearly audible, unlike one voice in a crowd
  }

  /** Seconds the loop takes at the current tempo. */
  get loopSeconds() {
    return stepSeconds(this.song.tempo) * STEPS
  }

  dispose() {
    this.stop()
    void this.ctx.close()
  }
}
