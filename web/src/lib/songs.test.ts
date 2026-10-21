import { describe, expect, it } from 'vitest'
import { voiceFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { songFor } from './songs'
import { PITCHES, STEPS } from './music'

const mk = (id: number, traits: Record<string, string>): Chog => ({ id, n: id, traits, ...voiceFor(traits) })

describe('songFor', () => {
  const chog = mk(7, { Mouth: 'Drooling', Body: 'Kings Robe', Eyes: 'fire laser', Background: 'Deep Aqua', Tier: 'Rare' })

  it('gives the same song every time', () => expect(songFor(chog)).toEqual(songFor({ ...chog })))

  it('reads mood from the mouth, tempo from the eyes, band from the background', () => {
    const a = songFor(chog).song
    expect(a.mode).toBe(1) // ahh -> major pentatonic
    expect(a.tempo).toBeGreaterThanOrEqual(110)
    expect(a.beat).toBeGreaterThanOrEqual(1)
    expect(a.beat).toBeLessThanOrEqual(3)
    const sad = songFor(mk(8, { Mouth: 'Sad', Eyes: 'Round Crying' })).song
    expect(sad.tempo).toBeLessThan(80)
    expect(sad.mode).toBe(0)
  })

  it('every song is a valid, playable song', () => {
    for (let id = 1; id <= 300; id++) {
      const s = songFor(mk(id, { Mouth: ['Smile', 'wo', 'Flat', 'Sad', 'Bubblegum'][id % 5], Body: 'Body ' + (id % 40), Eyes: ['Happy', 'Dead', 'laser', 'Normal'][id % 4], Background: 'bg' + (id % 9) })).song
      expect(s.notes.length).toBeGreaterThan(2)
      expect(new Set(s.notes.map(n => `${n.step}:${n.pitch}`)).size).toBe(s.notes.length)
      for (const n of s.notes) {
        expect(n.step).toBeLessThan(STEPS)
        expect(n.pitch).toBeLessThan(PITCHES)
      }
      expect(s.tempo).toBeGreaterThanOrEqual(56)
      expect(s.tempo).toBeLessThanOrEqual(132)
      expect(s.root).toBeLessThan(12)
    }
  })

  it('explains the song in plain lines', () => {
    const { lines } = songFor(chog)
    expect(lines.map(l => l.trait)).toEqual(['Mouth', 'Body', 'Eyes', 'Background'])
    expect(lines[2].effect).toMatch(/bpm/)
  })
})
