import { describe, expect, it } from 'vitest'
import { voiceFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { duetSong, songFor } from './songs'
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

describe('duetSong', () => {
  const a = mk(11, { Mouth: 'Smile', Body: 'Kings Robe', Eyes: 'Happy', Background: 'Deep Aqua', Tier: 'Rare' })
  const b = mk(12, { Mouth: 'Sad', Body: 'Hoodie', Eyes: 'Dead', Background: 'Gold', Tier: 'Common' })

  it('keeps the first Chog\'s key, tempo and band and adds the second Chog\'s voice', () => {
    const host = songFor(a).song
    const duet = duetSong(host, b)
    expect([duet.root, duet.mode, duet.tempo, duet.beat]).toEqual([host.root, host.mode, host.tempo, host.beat])
    expect(duet.notes.filter(n => n.id === 11)).toEqual(host.notes)
    expect(duet.notes.filter(n => n.id === 12).length).toBeGreaterThan(0)
  })

  it('never puts two notes in the same cell and stays within the staff', () => {
    const duet = duetSong(songFor(a).song, b)
    expect(new Set(duet.notes.map(n => `${n.step}:${n.pitch}`)).size).toBe(duet.notes.length)
    for (const n of duet.notes) { expect(n.step).toBeLessThan(STEPS); expect(n.pitch).toBeLessThan(PITCHES) }
  })

  it('is the same every time, and a Chog duetting with itself adds nothing new', () => {
    expect(duetSong(songFor(a).song, b)).toEqual(duetSong(songFor(a).song, b))
    expect(duetSong(songFor(a).song, a).notes).toHaveLength(songFor(a).song.notes.length)
  })
})
