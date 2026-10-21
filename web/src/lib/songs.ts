import { BEATS } from '../audio/band'
import { hash, VOWELS, phraseFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { keyName, MODES, PITCHES } from './music'
import { MAX_NOTES, type Note, type Song } from './share'

// Every Chog has a song: its own key, scale, tempo, band and hook, all read from its real traits.

// the vowel a Chog sings sets the mood: open "ahh" is bright, round "ooo" is dreamy
const MODE_OF_VOWEL = [1, 3, 2, 0, 4] // AH major pent, EH mixolydian, EE dorian, OH minor pent, OO hirajoshi
const MOOD = ['bright and open', 'warm and bluesy', 'cool and sleek', 'moody and low', 'dreamy and strange']

// Each Background colour plays one band style. Assigned once, balanced so the three styles are about equally common.
const BEAT_OF_BACKGROUND: Record<string, number> = {
  "Afternoon Orange": 1,
  "Aqua": 3,
  "Aqua Blue": 3,
  "Aqua Mint": 1,
  "Blood Red": 1,
  "Bright Yellow": 3,
  "Coral Pink": 2,
  "Deep Aqua": 3,
  "Deep Blue": 2,
  "Deep Purple": 1,
  "Fresh Green": 2,
  "Gold": 1,
  "Lemon": 2,
  "Lemon Yellow": 1,
  "Light Magenta": 2,
  "Light Purple": 1,
  "Lime Green": 1,
  "Magenta": 1,
  "Mint": 1,
  "Mon": 3,
  "Noble Blue": 3,
  "Peach Pink": 3,
  "Radioactive": 3,
  "Red Sky": 1,
  "Rose Pink": 1,
  "Rosie": 3,
  "Rosy Pink": 2,
  "Royal Blue": 1,
  "Sky Blue": 3,
  "Soft Lavender": 1,
  "Sunlight": 2,
  "Supreme Purple": 3,
}

const has = (v: string, ...w: string[]) => w.some(x => v.toLowerCase().includes(x))

function tempoOf(eyes: string): { bpm: number; feel: string } {
  const u = (hash('tempo:' + eyes) % 1000) / 1000
  if (has(eyes, 'laser', 'visor', 'glass', 'vr', 'plasma', 'viper')) return { bpm: Math.round(110 + u * 18), feel: 'fast and electric' }
  if (has(eyes, 'cry', 'tear', 'sad', 'tired', 'dead', 'worried')) return { bpm: Math.round(66 + u * 12), feel: 'slow and heavy' }
  if (has(eyes, 'happy', 'heart', 'smirk', 'xd', 'frog')) return { bpm: Math.round(98 + u * 12), feel: 'bouncy' }
  if (has(eyes, 'angry', 'thug', 'mog', 'retard', 'side')) return { bpm: Math.round(100 + u * 12), feel: 'driving' }
  return { bpm: Math.round(82 + u * 20), feel: 'easy' }
}

export type SongInfo = { song: Song; lines: { trait: string; value: string; effect: string }[] }

export function songFor(c: Chog): SongInfo {
  const t = c.traits
  const mode = MODE_OF_VOWEL[c.spec.vowel]
  const root = hash('root:' + (t.Body ?? c.id)) % 12
  const { bpm, feel } = tempoOf(t.Eyes ?? '')
  const beat = BEAT_OF_BACKGROUND[t.Background ?? ''] ?? 1 + (hash('beat:' + (t.Background ?? c.id)) % 3)

  // the hook: the Chog's own phrase, plus the same voice a third above on the strong beats
  const hook = phraseFor(c.id, c.spec)
  const taken = new Set(hook.map(n => n.step * PITCHES + n.pitch))
  const notes: Note[] = hook.map(n => ({ id: c.id, ...n }))
  for (const n of hook) {
    if (n.step % 4 !== 0) continue
    const up = Math.min(PITCHES - 1, n.pitch + 2)
    if (up !== n.pitch && !taken.has(n.step * PITCHES + up)) { taken.add(n.step * PITCHES + up); notes.push({ id: c.id, step: n.step, pitch: up }) }
  }

  const song: Song = { tempo: bpm, root, mode, space: Math.round(c.spec.space * 100) + 15, bright: Math.round(c.spec.bright * 100), beat, notes }
  const lines = [
    t.Mouth && { trait: 'Mouth', value: t.Mouth, effect: `${VOWELS[c.spec.vowel].toLowerCase()}, so ${MOOD[c.spec.vowel]}` },
    t.Body && { trait: 'Body', value: t.Body, effect: `key of ${keyName(root, mode).split(' ')[0]}` },
    t.Eyes && { trait: 'Eyes', value: t.Eyes, effect: `${feel}, ${bpm} bpm` },
    t.Background && { trait: 'Background', value: t.Background, effect: `${BEATS[beat].toLowerCase()} beat` },
  ].filter(Boolean) as SongInfo['lines']
  return { song, lines }
}

export const modeName = (m: number) => MODES[m].name.toLowerCase()

/**
 * Two Chogs sing together: the first Chog's song, plus the second one's hook. Both live on the first Chog's key and scale,
 * so the two phrases always fit, whatever the pair.
 */
export function duetSong(host: Song, guest: Chog): Song {
  const taken = new Set(host.notes.map(n => n.step * PITCHES + n.pitch))
  const theirs = songFor(guest).song.notes.filter(n => !taken.has(n.step * PITCHES + n.pitch))
  return { ...host, notes: [...host.notes, ...theirs].slice(0, MAX_NOTES) }
}
