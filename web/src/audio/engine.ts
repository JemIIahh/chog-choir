import { midiFor, STEPS } from '../lib/music'
import type { Song } from '../lib/share'
import { createBus, playNote, scheduleStep, type Bus, type SpecOf } from './synth'
import { stepSeconds } from './timing'
import { claimPlayback, holdMedia, needsMediaHold, newAudioContext } from './unlock'
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
  private holdTimer: number | null = null
  // a phone call, Siri or a locked screen can stop the sound; coming back to the page starts it again
  private readonly onVisible = () => { if (!document.hidden && (this.ctx.state as string) !== 'running' && (this.ctx.state as string) !== 'closed') void this.ctx.resume().catch(() => undefined) }

  constructor(song: Song, specOf: SpecOf) {
    this.ctx = newAudioContext({ latencyHint: 'interactive' })
    this.bus = createBus(this.ctx)
    this.bus.output.connect(this.ctx.destination)
    this.recordTap = this.ctx.createMediaStreamDestination()
    this.bus.output.connect(this.recordTap)
    this.song = song
    this.specOf = specOf
    this.apply()
    document.addEventListener('visibilitychange', this.onVisible)
  }

  /** Run on the first touch: phones only let sound start from a tap, so this gets the permission for the rest of the visit. */
  unlock() {
    claimPlayback()
    void this.resume()
    const nudge = this.ctx.createBufferSource() // the classic: a silent one-sample sound started inside the tap
    nudge.buffer = this.ctx.createBuffer(1, 1, 22050)
    nudge.connect(this.ctx.destination)
    nudge.start(0)
  }

  private async resume() {
    if ((this.ctx.state as string) === 'running') return
    try { await this.ctx.resume() } catch { /* the caller checks the state afterwards and says so */ }
  }

  /** Keep the phone treating the page as one that plays sound. Older iOS needs a silent media element playing for that. */
  private keepPlaying(releaseAfterMs?: number) {
    claimPlayback()
    if (!needsMediaHold()) return
    holdMedia(true)
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer)
    this.holdTimer = releaseAfterMs ? window.setTimeout(() => { if (!this.playing) holdMedia(false) }, releaseAfterMs) : null
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
    this.keepPlaying() // first, still inside the tap
    await this.resume()
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
    if (needsMediaHold()) {
      if (this.holdTimer !== null) window.clearTimeout(this.holdTimer)
      this.holdTimer = window.setTimeout(() => { if (!this.playing) holdMedia(false) }, 2500)
    }
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
    this.keepPlaying(3500)
    await this.resume()
    const t = this.ctx.currentTime + 0.02
    playNote(this.ctx, this.bus, spec, midiFor(pitch, this.song.root, this.song.mode), t, 0.85, 1.8, id) // a lone Chog should be clearly audible, unlike one voice in a crowd
  }

  /** Seconds the loop takes at the current tempo. */
  get loopSeconds() {
    return stepSeconds(this.song.tempo) * STEPS
  }

  dispose() {
    this.stop()
    document.removeEventListener('visibilitychange', this.onVisible)
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer)
    holdMedia(false)
    void this.ctx.close()
  }
}
