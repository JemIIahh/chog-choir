import { describe, expect, it } from 'vitest'
import { voiceFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { autoNotes, chunk, loadOf, previewOrder, previewVoices } from './choirnotes'
import { PITCHES, STEPS } from './music'

const mk = (id: number): Chog => {
  const traits = { Mouth: ['Smile', 'wo', 'Flat', 'Sad', 'Bubblegum'][id % 5], Body: 'Body ' + (id % 40), Eyes: ['Happy', 'Dead', 'laser', 'Normal'][id % 4], Background: 'bg' + (id % 9) }
  return { id, n: id, traits, ...voiceFor(traits) }
}
const many = (n: number) => Array.from({ length: n }, (_, i) => mk(i + 1))

describe('autoNotes', () => {
  it('gives each Chog one valid note from its own range', () => {
    const chogs = many(40)
    const notes = autoNotes(chogs, [])
    expect(notes).toHaveLength(40)
    notes.forEach((n, i) => {
      expect(n.id).toBe(chogs[i].id)
      expect(n.step).toBeGreaterThanOrEqual(0)
      expect(n.step).toBeLessThan(STEPS)
      expect(n.pitch).toBeGreaterThanOrEqual(chogs[i].spec.low)
      expect(n.pitch).toBeLessThanOrEqual(chogs[i].spec.high)
      expect(n.pitch).toBeLessThan(PITCHES)
    })
  })

  it('is deterministic', () => expect(autoNotes(many(20), [])).toEqual(autoNotes(many(20), [])))

  it('spreads a big wallet over the loop instead of piling onto one beat', () => {
    const load = loadOf(autoNotes(many(64), []))
    expect(Math.max(...load)).toBeLessThanOrEqual(10)
    expect(load.filter(n => n > 0).length).toBeGreaterThanOrEqual(12)
  })

  it('avoids steps the round already has plenty of', () => {
    const crowded = Array.from({ length: 30 }, () => ({ id: 999, step: 0, pitch: 0 }))
    const notes = autoNotes(many(30), crowded)
    expect(notes.filter(n => n.step === 0).length).toBeLessThan(notes.length / 3)
  })
})

describe('previewVoices', () => {
  const order = previewOrder(many(300))

  it('adds exactly the number asked for, without Chogs that already sang', () => {
    const sung = new Set([1, 2, 3, 4, 5])
    const v = previewVoices(order, 100, sung, [])
    expect(v).toHaveLength(100)
    expect(new Set(v.map(n => n.id)).size).toBe(100)
    expect(v.some(n => sung.has(n.id))).toBe(false)
  })

  it('a bigger preview keeps the Chogs a smaller one had', () => {
    const a = new Set(previewVoices(order, 25, new Set(), []).map(n => n.id))
    const b = new Set(previewVoices(order, 100, new Set(), []).map(n => n.id))
    for (const id of a) expect(b.has(id)).toBe(true)
  })

  it('asking for nothing, or for more than exist, is safe', () => {
    expect(previewVoices(order, 0, new Set(), [])).toEqual([])
    expect(previewVoices(order, -5, new Set(), [])).toEqual([])
    expect(previewVoices(order, 10_000, new Set(), []).length).toBe(300)
  })
})

describe('chunk', () => {
  it('splits into runs and keeps order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk(Array.from({ length: 73 }, (_, i) => i), 25).map(c => c.length)).toEqual([25, 25, 23])
  })
})
