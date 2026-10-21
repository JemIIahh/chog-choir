import { STEPS } from '../lib/music'
import type { Song } from '../lib/share'
import { createBus, scheduleStep, stepSeconds, type SpecOf } from './synth'

const RATE = 44100

/** Renders the song to a buffer without playing it: used for the WAV download and to measure the sound. */
export async function renderSong(song: Song, specOf: SpecOf, loops = 2): Promise<AudioBuffer> {
  const stepDur = stepSeconds(song.tempo)
  const tail = 3
  const seconds = stepDur * STEPS * loops + tail
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE)
  const bus = createBus(ctx)
  bus.output.connect(ctx.destination)
  bus.setSpace(song.space)
  bus.setTone(song.bright)
  for (let l = 0; l < loops; l++)
    for (let s = 0; s < STEPS; s++) scheduleStep(ctx, bus, song, specOf, s, 0.05 + (l * STEPS + s) * stepDur)
  return ctx.startRendering()
}

export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels
  const len = buf.length
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true)
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true)
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]))
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      o += 2
    }
  return new Blob([out], { type: 'audio/wav' })
}
