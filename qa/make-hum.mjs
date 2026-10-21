// Writes qa/hum.wav: a "hummed tune" for the browser's fake microphone. A five-note staircase, each note held 0.45 s,
// looping, with a little vibrato and a couple of harmonics so it sounds like a voice to the pitch detector.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 48000
const seconds = 24
const notes = [196, 220, 261.63, 293.66, 329.63] // G3 A3 C4 D4 E4
const hold = 0.45
const n = SR * seconds
const pcm = new Int16Array(n)
let phase = 0
for (let i = 0; i < n; i++) {
  const t = i / SR
  const hz = notes[Math.floor(t / hold) % notes.length] * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t))
  phase += (2 * Math.PI * hz) / SR
  const gate = Math.min(1, ((t % hold) / hold) * 12, (1 - (t % hold) / hold) * 12) // short fades so each note is clean
  const v = (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase)) / 1.75
  pcm[i] = Math.round(v * gate * 0.5 * 32767)
}
const head = Buffer.alloc(44)
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.byteLength, 4); head.write('WAVEfmt ', 8)
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(SR, 24)
head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.byteLength, 40)
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hum.wav')
fs.writeFileSync(out, Buffer.concat([head, Buffer.from(pcm.buffer)]))
console.log(out)
