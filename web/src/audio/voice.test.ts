import { describe, expect, it } from 'vitest'
import { MAX_VOICES_PER_STEP, notesAtStep } from './synth'
import { phraseFor, voiceFor, VOWELS } from './voice'

const drooling = { Mouth: 'Drooling', Body: 'Kings Robe', Eyes: 'fire laser', Head: 'Crown', Tier: 'Rare', Side: 'Left', Accessory: 'Fwog' }

describe('voiceFor', () => {
  it('is deterministic: the same traits always give the same voice', () => {
    expect(voiceFor(drooling).spec).toEqual(voiceFor({ ...drooling }).spec)
  })

  it('sings the vowel its mouth would make', () => {
    expect(VOWELS[voiceFor({ Mouth: 'Drooling' }).spec.vowel]).toBe('AH')
    expect(VOWELS[voiceFor({ Mouth: 'Smile' }).spec.vowel]).toBe('EE')
    expect(VOWELS[voiceFor({ Mouth: 'Bubblegum' }).spec.vowel]).toBe('OO')
    expect(VOWELS[voiceFor({ Mouth: 'wo' }).spec.vowel]).toBe('OH')
    expect(VOWELS[voiceFor({ Mouth: 'Flat' }).spec.vowel]).toBe('EH')
  })

  it('maps body to a register and keeps it in a believable range', () => {
    expect(voiceFor({ Body: 'Red Tuxedo' }).spec.voiceType).toBe('bass')
    expect(voiceFor({ Body: 'Black Trackset' }).spec.voiceType).toBe('tenor')
    expect(voiceFor({ Body: 'Yellow Yukata' }).spec.voiceType).toBe('alto')
    const bass = voiceFor({ Body: 'Red Tuxedo' }).spec
    const sop = voiceFor({ Body: 'Some body nobody mapped by hand' }).spec
    expect(bass.size).toBeLessThan(1)
    expect(bass.high).toBeLessThan(sop.high + 6)
  })

  it('makes rarer tiers richer', () => {
    expect(voiceFor({ Tier: 'Common' }).spec.unison).toBe(1)
    expect(voiceFor({ Tier: 'Rare' }).spec.unison).toBe(3)
    expect(voiceFor({ Tier: 'Legendary' }).spec.unison).toBe(4)
  })

  it('turns an accessory into an effect, and no accessory into none', () => {
    expect(voiceFor({ Accessory: 'Fwog' }).spec.fx).toBe('wobble')
    expect(voiceFor({ Accessory: 'Knife' }).spec.fx).toBe('grit')
    expect(voiceFor({}).spec.fx).toBe('none')
  })

  it('copes with a Chog that has hardly any traits', () => {
    const { spec, why } = voiceFor({})
    expect(spec.vowel).toBeGreaterThanOrEqual(0)
    expect(spec.vowel).toBeLessThan(5)
    expect(why).toEqual([])
    for (const v of [spec.bright, spec.space, spec.gain]) expect(Number.isFinite(v)).toBe(true)
  })

  it('keeps every continuous parameter inside the range the synth expects', () => {
    const eyes = ['fire laser', 'Round Crying', 'Happy', 'Angry', 'Normal Eye', 'Retro Glass']
    const skins = ['Red', 'Black', 'Pink', 'Origin', 'Metal']
    for (const e of eyes) for (const s of skins) for (const m of ['Drooling', 'Sad', 'Smile']) {
      const { spec } = voiceFor({ Eyes: e, Skin: s, Mouth: m, Aura: 'Cool Aura', Side: 'Right' })
      expect(spec.bright).toBeGreaterThanOrEqual(0)
      expect(spec.bright).toBeLessThanOrEqual(1)
      expect(spec.pan).toBeGreaterThanOrEqual(-1)
      expect(spec.pan).toBeLessThanOrEqual(1)
      expect(spec.attack).toBeGreaterThan(0)
      expect(spec.release).toBeGreaterThan(0)
    }
  })

  it('explains itself: every trait that shaped the voice gets one plain line', () => {
    const { why } = voiceFor(drooling)
    expect(why.find(w => w.trait === 'Mouth')?.effect).toContain('ah')
    expect(why.map(w => w.trait)).toEqual(expect.arrayContaining(['Mouth', 'Body', 'Eyes', 'Head', 'Accessory', 'Tier']))
  })
})

describe('phraseFor', () => {
  const spec = voiceFor({ Body: 'Red Tuxedo' }).spec

  it('is the same every time for one Chog and different between Chogs', () => {
    expect(phraseFor(42, spec)).toEqual(phraseFor(42, spec))
    expect(phraseFor(42, spec)).not.toEqual(phraseFor(43, spec))
  })

  it('stays in the Chog home range and never repeats a step', () => {
    for (let id = 1; id <= 200; id++) {
      const p = phraseFor(id, spec)
      expect(new Set(p.map(n => n.step)).size).toBe(p.length)
      for (const n of p) {
        expect(n.pitch).toBeGreaterThanOrEqual(spec.low)
        expect(n.pitch).toBeLessThanOrEqual(spec.high)
        expect(n.step).toBeGreaterThanOrEqual(0)
        expect(n.step).toBeLessThan(16)
      }
    }
  })

  it('has low voices sing sparsely and high voices busily', () => {
    const bass = voiceFor({ Body: 'Red Tuxedo' }).spec
    const sop = voiceFor({ Body: 'Whatever' }).spec
    expect(phraseFor(1, bass).length).toBeLessThan(phraseFor(1, { ...sop, voiceType: 'soprano' }).length)
  })
})

describe('notesAtStep', () => {
  it('caps a crowded step so a big choir stays a choir', () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, step: 3, pitch: i % 12 }))
    const here = notesAtStep(notes, 3)
    expect(here.length).toBe(MAX_VOICES_PER_STEP)
    expect(here).toEqual(notesAtStep(notes, 3)) // and picks the same ones every time
  })

  it('leaves quiet steps alone', () => {
    const notes = [{ id: 1, step: 0, pitch: 0 }, { id: 2, step: 5, pitch: 3 }]
    expect(notesAtStep(notes, 0)).toHaveLength(1)
    expect(notesAtStep(notes, 7)).toHaveLength(0)
  })
})
