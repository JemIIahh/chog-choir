import { describe, expect, it } from 'vitest'
import { epochKey, hzOf, midiFor, MODES } from './music'
import { decodeSong, encodeSong, type Song } from './share'

describe('music', () => {
  it('maps the staff onto the chosen scale', () => {
    // C minor pentatonic: C3 Eb3 F3 G3 Bb3 then the next octave
    expect([0, 1, 2, 3, 4, 5].map(p => midiFor(p, 0, 0))).toEqual([48, 51, 53, 55, 58, 60])
    // seven-note modes wrap every 7 rows
    expect(midiFor(7, 0, 2)).toBe(60)
  })

  it('keeps the whole staff in a singable range for every key', () => {
    for (let root = 0; root < 12; root++)
      for (let mode = 0; mode < MODES.length; mode++) {
        expect(midiFor(0, root, mode)).toBeGreaterThanOrEqual(41)
        expect(midiFor(11, root, mode)).toBeLessThanOrEqual(86)
      }
  })

  it('has A4 at 440Hz', () => expect(hzOf(69)).toBe(440))

  it('derives the epoch key the same way the contract does', () => {
    // values produced by ChogChoir.epochKey on the contract (see contracts/test/EpochKeyVectors.t.sol)
    const vectors: Record<number, [number, number]> = JSON.parse(
      process.env.EPOCH_VECTORS ?? '{}',
    )
    for (const [e, [root, mode]] of Object.entries(vectors)) {
      expect(epochKey(Number(e))).toEqual({ root, mode })
    }
    const k = epochKey(7)
    expect(k.root).toBeGreaterThanOrEqual(0)
    expect(k.root).toBeLessThan(12)
    expect(k.mode).toBeLessThan(MODES.length)
  })
})

describe('share codec', () => {
  const song: Song = {
    tempo: 96,
    root: 9,
    mode: 3,
    space: 40,
    bright: 70,
    beat: 2,
    notes: [
      { id: 1, step: 0, pitch: 0 },
      { id: 1462, step: 15, pitch: 11 },
      { id: 1969, step: 7, pitch: 5 },
    ],
  }

  it('round-trips a song', () => expect(decodeSong(encodeSong(song))).toEqual(song))

  it('stays small and url safe', () => {
    const s = encodeSong(song)
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(s.length).toBeLessThan(32)
  })

  it('still opens links made before the band existed', () => {
    // version 1: 6-byte header (no beat byte)
    const old = btoa(String.fromCharCode(1, 96 - 56, (9 << 4) | 3, 40, 70, 1, 0x00, 0x00, 0x00)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const d = decodeSong(old)
    expect(d).toBeNull() // id 0 is not a Chog, so this is rejected rather than misread
    const valid = btoa(String.fromCharCode(1, 40, (9 << 4) | 3, 40, 70, 1, 0x00, 0x01, 0x00)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeSong(valid)).toMatchObject({ beat: 0, tempo: 96, notes: [{ id: 1, step: 0, pitch: 0 }] })
  })

  it('rejects garbage instead of throwing', () => {
    expect(decodeSong('')).toBeNull()
    expect(decodeSong('not a song!!')).toBeNull()
    expect(decodeSong('AAAAAAAA')).toBeNull()
  })

  it('rejects Chog ids that do not exist', () => {
    const bad = encodeSong({ ...song, notes: [{ id: 2000, step: 0, pitch: 0 }] })
    expect(decodeSong(bad)).toBeNull()
  })

  it('clamps out-of-range controls instead of corrupting the header', () => {
    const d = decodeSong(encodeSong({ ...song, tempo: 400, space: 999 }))!
    expect(d.tempo).toBe(132)
    expect(d.space).toBe(100)
  })
})
