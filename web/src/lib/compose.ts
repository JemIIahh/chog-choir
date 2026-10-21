import { phraseFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { PITCHES, STEPS } from './music'
import { MAX_NOTES, type Note, type Song } from './share'

export const DEFAULT_SONG: Omit<Song, 'notes'> = { tempo: 88, root: 9, mode: 0, space: 46, bright: 52, beat: 1 }

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

export const cellKey = (step: number, pitch: number) => step * PITCHES + pitch

/** Add a Chog's signature phrase, skipping cells that are already taken. */
export function withPhrase(notes: Note[], chog: Chog): Note[] {
  const taken = new Set(notes.map(n => cellKey(n.step, n.pitch)))
  const next = [...notes]
  for (const p of phraseFor(chog.id, chog.spec, STEPS)) {
    if (next.length >= MAX_NOTES) break
    if (taken.has(cellKey(p.step, p.pitch))) continue
    taken.add(cellKey(p.step, p.pitch))
    next.push({ id: chog.id, step: p.step, pitch: p.pitch })
  }
  return next
}

/** A band with every voice type and vowel represented, so any seed sounds like a choir. */
export function pickBand(chogs: Chog[], seed: number, size = 5): Chog[] {
  const r = rng(seed)
  const want: Chog['spec']['voiceType'][] = ['bass', 'tenor', 'alto', 'soprano', 'tenor', 'alto']
  const band: Chog[] = []
  const vowels = new Set<number>()
  for (const type of want.slice(0, size)) {
    let pick: Chog | null = null
    for (let tries = 0; tries < 400 && !pick; tries++) {
      const c = chogs[Math.floor(r() * chogs.length)]
      if (c.spec.voiceType !== type || band.includes(c)) continue
      if (vowels.has(c.spec.vowel) && tries < 300) continue
      pick = c
    }
    if (pick) { band.push(pick); vowels.add(pick.spec.vowel) }
  }
  return band
}

export function bandSong(chogs: Chog[], seed: number, base: Omit<Song, 'notes'> = DEFAULT_SONG): Song {
  let notes: Note[] = []
  for (const c of pickBand(chogs, seed)) notes = withPhrase(notes, c)
  return { ...base, notes }
}
