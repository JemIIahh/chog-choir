import { describe, expect, it } from 'vitest'
import { detectPitch, hummedNotes, midiOfHz } from './pitch'
import { midiFor } from './music'

const SR = 44100
const tone = (hz: number, n = 2048, amp = 0.3, harmonics = [1, 0.5, 0.25]): Float32Array => {
  const out = new Float32Array(n)
  harmonics.forEach((h, k) => { for (let i = 0; i < n; i++) out[i] += (amp * h * Math.sin(2 * Math.PI * hz * (k + 1) * i / SR)) / harmonics.length })
  return out
}
const noise = (n = 2048, amp = 0.3) => { let s = 12345; return Float32Array.from({ length: n }, () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296 - 0.5) * 2 * amp }) }

describe('detectPitch', () => {
  it('finds the pitch of a voice-like tone across the human range', () => {
    for (const hz of [98, 110, 130.8, 196, 220, 261.6, 330, 440, 523.3, 659.3]) {
      const got = detectPitch(tone(hz), SR)
      expect(got, `${hz} Hz`).not.toBeNull()
      expect(Math.abs(midiOfHz(got!) - midiOfHz(hz))).toBeLessThan(0.25) // within a quarter of a semitone
    }
  })

  it('does not jump an octave when the second harmonic is the loudest', () => {
    const got = detectPitch(tone(196, 2048, 0.3, [0.6, 1, 0.3]), SR)
    expect(Math.abs(midiOfHz(got!) - midiOfHz(196))).toBeLessThan(0.3)
  })

  it('says nothing for silence and for noise', () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull()
    expect(detectPitch(noise(), SR)).toBeNull()
    expect(detectPitch(tone(220, 2048, 0.004), SR)).toBeNull() // far too quiet
  })
})

describe('hummedNotes', () => {
  const root = 9, mode = 0 // A minor pentatonic
  const range = { low: 2, high: 7 }
  const hzOfRow = (row: number, octave = 0) => 440 * 2 ** ((midiFor(row, root, mode) + octave - 69) / 12)

  it('snaps a hummed tune to the scale and keeps its shape', () => {
    // up the scale: rows 2,3,4,5,6,7 in the first six steps, silence after
    const frames = [2, 3, 4, 5, 6, 7].map(r => hzOfRow(r)).concat(Array(10).fill(null))
    const notes = hummedNotes(frames, root, mode, range, 42)
    expect(notes.map(n => n.pitch)).toEqual([2, 3, 4, 5, 6, 7])
    expect(notes.map(n => n.step)).toEqual([0, 1, 2, 3, 4, 5])
    expect(notes.every(n => n.id === 42)).toBe(true)
  })

  it('moves a tune hummed an octave away into the Chog\'s range', () => {
    const low = [2, 3, 4, 5].map(r => hzOfRow(r, -12)).concat(Array(12).fill(null))
    const high = [2, 3, 4, 5].map(r => hzOfRow(r, 12)).concat(Array(12).fill(null))
    expect(hummedNotes(low, root, mode, range, 1).map(n => n.pitch)).toEqual([2, 3, 4, 5])
    expect(hummedNotes(high, root, mode, range, 1).map(n => n.pitch)).toEqual([2, 3, 4, 5])
  })

  it('forgives a slightly flat or sharp singer', () => {
    const frames = [3, 5, 4, 6].map((r, i) => hzOfRow(r) * 2 ** (((i % 2 ? 35 : -35) / 100) / 12)).concat(Array(12).fill(null))
    expect(hummedNotes(frames, root, mode, range, 1).map(n => n.pitch)).toEqual([3, 5, 4, 6])
  })

  it('turns a held note into one note, and a repeated note after a gap into two', () => {
    const f = hzOfRow(4)
    const held = [f, f, f, f, null, null, f, f, ...Array(8).fill(null)]
    expect(hummedNotes(held, root, mode, range, 1).map(n => n.step)).toEqual([0, 6])
  })

  it('keeps every note inside the Chog\'s range and the staff', () => {
    const wild = Array.from({ length: 16 }, (_, i) => hzOfRow(i % 12) * (i % 3 === 0 ? 2 : 1))
    for (const n of hummedNotes(wild, root, mode, range, 1)) {
      expect(n.pitch).toBeGreaterThanOrEqual(range.low)
      expect(n.pitch).toBeLessThanOrEqual(range.high)
      expect(n.step).toBeLessThan(16)
    }
  })

  it('gives up cleanly when there was hardly any singing', () => {
    expect(hummedNotes(Array(16).fill(null), root, mode, range, 1)).toEqual([])
    expect(hummedNotes([hzOfRow(3), hzOfRow(4), ...Array(14).fill(null)], root, mode, range, 1)).toEqual([])
  })
})
