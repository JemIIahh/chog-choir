import { detectPitch } from './pitch'

export class HumError extends Error {}

/**
 * Listen through the microphone for one loop and return a pitch (or null) for each step. Nothing is recorded or sent anywhere:
 * the microphone is read in short windows, the pitch of each window is kept, and the stream is closed when this returns.
 */
export async function listenForHum(opts: { steps: number; stepSeconds: number; onFrame?(step: number, hz: number | null): void; signal?: AbortSignal }): Promise<(number | null)[]> {
  const { steps, stepSeconds, onFrame, signal } = opts
  if (!navigator.mediaDevices?.getUserMedia) throw new HumError('This browser cannot use a microphone here. Try Chrome or Safari on https.')
  let stream: MediaStream
  try {
    // a voice, not a call: no echo cancelling or auto gain, which would mangle a held note
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  } catch {
    throw new HumError('The microphone is blocked. Allow it for this page, then try again.')
  }
  const ctx = new AudioContext()
  try {
    const an = ctx.createAnalyser()
    an.fftSize = 4096
    ctx.createMediaStreamSource(stream).connect(an)
    const buf = new Float32Array(an.fftSize)
    const frames: (number | null)[] = []
    const t0 = performance.now()
    await new Promise<void>(resolve => {
      const timer = window.setInterval(() => {
        const elapsed = (performance.now() - t0) / 1000
        // one reading in the middle of each step, from the last ~46 ms of sound
        while (frames.length < steps && elapsed >= (frames.length + 0.5) * stepSeconds) {
          an.getFloatTimeDomainData(buf)
          const hz = detectPitch(buf.subarray(buf.length - 2048), ctx.sampleRate)
          frames.push(hz)
          onFrame?.(frames.length - 1, hz)
        }
        if (frames.length >= steps || signal?.aborted) { window.clearInterval(timer); resolve() }
      }, 15)
    })
    return signal?.aborted ? [] : frames
  } finally {
    stream.getTracks().forEach(t => t.stop())
    void ctx.close()
  }
}
