import { encodeAbiParameters, keccak256 } from 'viem'

export const STEPS = 16
export const PITCHES = 12

export const MODES = [
  { name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'Hirajoshi', intervals: [0, 2, 3, 7, 8] },
] as const

export const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const

/** MIDI note for a staff row (0 = bottom) in the given key. Roots above F♯ drop an octave so the range stays singable. */
export function midiFor(pitch: number, root: number, mode: number): number {
  const iv = MODES[mode].intervals
  const octave = Math.floor(pitch / iv.length)
  const base = 48 + (root > 6 ? root - 12 : root)
  return base + octave * 12 + iv[pitch % iv.length]
}

export const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/**
 * Key of an epoch. Mirrors ChogChoir.epochKey: keccak256(abi.encode(epoch, "chog-choir")),
 * root = h % 12, mode = (h >> 8) % 5.
 */
export function epochKey(epoch: bigint | number): { root: number; mode: number } {
  const h = BigInt(
    keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'string' }], [BigInt(epoch), 'chog-choir'])),
  )
  return { root: Number(h % 12n), mode: Number((h >> 8n) % BigInt(MODES.length)) }
}

export const keyName = (root: number, mode: number) => `${ROOTS[root]} ${MODES[mode].name.toLowerCase()}`
