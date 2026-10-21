import { MODES, PITCHES, STEPS } from './music'

export type Note = { id: number; step: number; pitch: number }

export type Song = {
  tempo: number
  root: number
  mode: number
  space: number // 0..100
  bright: number // 0..100
  notes: Note[]
}

export const MAX_NOTES = 160
export const TEMPO_MIN = 56
export const TEMPO_MAX = 132

const VERSION = 1

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

/**
 * A song is 6 bytes of header and 3 bytes per note (11 bits Chog id, 4 bits step, 4 bits row),
 * base64url encoded, so a whole band fits in a link with no server.
 */
export function encodeSong(s: Song): string {
  const notes = s.notes.slice(0, MAX_NOTES)
  const out = new Uint8Array(6 + notes.length * 3)
  out[0] = VERSION
  out[1] = clamp(s.tempo, TEMPO_MIN, TEMPO_MAX) - TEMPO_MIN
  out[2] = ((clamp(s.root, 0, 11) & 15) << 4) | (clamp(s.mode, 0, MODES.length - 1) & 15)
  out[3] = clamp(s.space, 0, 100)
  out[4] = clamp(s.bright, 0, 100)
  out[5] = notes.length
  notes.forEach((n, i) => {
    const bits = ((n.id & 0x7ff) << 8) | ((n.step & 15) << 4) | (n.pitch & 15)
    const o = 6 + i * 3
    out[o] = (bits >> 16) & 255
    out[o + 1] = (bits >> 8) & 255
    out[o + 2] = bits & 255
  })
  let bin = ''
  out.forEach(b => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSong(str: string, supply = 1969): Song | null {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    if (bytes.length < 6 || bytes[0] !== VERSION) return null
    const count = bytes[5]
    if (count > MAX_NOTES || bytes.length < 6 + count * 3) return null
    const root = bytes[2] >> 4
    const mode = bytes[2] & 15
    if (root > 11 || mode >= MODES.length) return null
    const notes: Note[] = []
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 3
      const bits = (bytes[o] << 16) | (bytes[o + 1] << 8) | bytes[o + 2]
      const note = { id: (bits >> 8) & 0x7ff, step: (bits >> 4) & 15, pitch: bits & 15 }
      if (note.id < 1 || note.id > supply || note.step >= STEPS || note.pitch >= PITCHES) return null
      notes.push(note)
    }
    return {
      tempo: bytes[1] + TEMPO_MIN,
      root,
      mode,
      space: Math.min(100, bytes[3]),
      bright: Math.min(100, bytes[4]),
      notes,
    }
  } catch {
    return null
  }
}
