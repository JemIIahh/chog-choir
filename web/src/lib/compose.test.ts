import { describe, expect, it } from 'vitest'
import { voiceFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { bandSong, cellKey, pickBand, withPhrase } from './compose'

const BODIES = ['Red Tuxedo', 'Black Trackset', 'Yellow Yukata', 'Wizard', 'Tank Top', 'Dragon suit', 'Stripes', 'Jersey']
const MOUTHS = ['Drooling', 'Smile', 'Bubblegum', 'wo', 'Flat', 'Sad']
const chogs: Chog[] = Array.from({ length: 300 }, (_, i) => {
  const traits = { Body: BODIES[i % BODIES.length], Mouth: MOUTHS[(i * 7) % MOUTHS.length], Eyes: 'Happy', Tier: 'Common' }
  const { spec, why } = voiceFor(traits)
  return { id: i + 1, n: i + 1, traits, spec, why }
})

describe('composing', () => {
  it('builds a band with a spread of voice types', () => {
    const band = pickBand(chogs, 7)
    expect(band.length).toBeGreaterThanOrEqual(4)
    expect(new Set(band.map(c => c.spec.voiceType)).size).toBeGreaterThanOrEqual(3)
    expect(new Set(band.map(c => c.id)).size).toBe(band.length)
  })

  it('is repeatable for a seed and varies across seeds', () => {
    expect(bandSong(chogs, 7)).toEqual(bandSong(chogs, 7))
    expect(bandSong(chogs, 7).notes).not.toEqual(bandSong(chogs, 8).notes)
  })

  it('never puts two notes in one cell', () => {
    for (let seed = 1; seed < 60; seed++) {
      const keys = bandSong(chogs, seed).notes.map(n => cellKey(n.step, n.pitch))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('adds a Chog phrase without overwriting what is already there', () => {
    const base = bandSong(chogs, 3).notes
    const newcomer = chogs.find(c => !base.some(n => n.id === c.id))!
    const more = withPhrase(base, newcomer)
    expect(more.slice(0, base.length)).toEqual(base)
    expect(more.length).toBeGreaterThan(base.length)
  })

  it('adding a phrase that is already on the staff changes nothing', () => {
    const base = bandSong(chogs, 3).notes
    const member = chogs.find(c => c.id === base[0].id)!
    expect(withPhrase(base, member)).toEqual(base)
  })
})
