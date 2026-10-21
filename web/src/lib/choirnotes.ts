import { hash, phraseFor } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { STEPS } from './music'
import type { Note } from './share'

/** How many voices already sit on each step of the loop. */
export const loadOf = (notes: Note[]): number[] => {
  const load = Array<number>(STEPS).fill(0)
  for (const n of notes) load[n.step]++
  return load
}

/** The note a Chog sings when it is simply told to sing: one from its own phrase, on the step the choir needs most. */
export function autoNote(c: Chog, load: number[]): Note {
  const phrase = phraseFor(c.id, c.spec, STEPS)
  let best = phrase[0]
  for (const p of phrase) if (load[p.step] < load[best.step]) best = p
  return { id: c.id, step: best.step, pitch: best.pitch }
}

/** One note for each Chog, spread over the loop so a whole wallet of Chogs does not pile onto one beat. */
export function autoNotes(chogs: Chog[], existing: Note[]): Note[] {
  const load = loadOf(existing)
  return chogs.map(c => {
    const n = autoNote(c, load)
    load[n.step]++
    return n
  })
}

/** Every Chog in a fixed, shuffled order, so a preview always adds the same Chogs first. */
export const previewOrder = (chogs: Chog[]): Chog[] => [...chogs].sort((a, b) => hash('preview:' + a.id) - hash('preview:' + b.id) || a.id - b.id)

/** What a round would sound like with `count` Chogs singing: the real notes plus stand-ins for Chogs that have not sung. */
export function previewVoices(order: Chog[], count: number, sung: Set<number>, existing: Note[]): Note[] {
  const extra = order.filter(c => !sung.has(c.id)).slice(0, Math.max(0, count))
  return autoNotes(extra, existing)
}

/** Split a list into runs of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
