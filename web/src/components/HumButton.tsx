import { useEffect, useRef, useState } from 'react'
import { HumError, listenForHum } from '../lib/hum'
import { STEPS } from '../lib/music'

type Props = {
  /** seconds per step of the song that will sing the tune */
  stepSeconds: number
  disabled?: boolean
  onTune(frames: (number | null)[]): void
  onProblem(message: string): void
}

type Phase = 'idle' | 'count' | 'listening'

/** Hum one loop into the microphone; the Chog sings it back. A count-in, then sixteen dots light up as your voice is heard. */
export function HumButton({ stepSeconds, disabled, onTune, onProblem }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [dots, setDots] = useState<(boolean | null)[]>(() => Array(STEPS).fill(null))
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const start = async () => {
    const ac = new AbortController()
    abort.current = ac
    setDots(Array(STEPS).fill(null))
    setPhase('count')
    for (let c = 3; c >= 1; c--) {
      setCount(c)
      await new Promise(r => window.setTimeout(r, 700))
      if (ac.signal.aborted) return
    }
    setPhase('listening')
    try {
      const frames = await listenForHum({
        steps: STEPS,
        stepSeconds,
        signal: ac.signal,
        onFrame: (step, hz) => setDots(d => d.map((x, i) => (i === step ? hz !== null : x))),
      })
      if (!ac.signal.aborted) onTune(frames)
    } catch (e) {
      onProblem(e instanceof HumError ? e.message : 'Could not listen just now. Try again.')
    } finally {
      setPhase('idle')
    }
  }

  if (phase === 'idle')
    return (
      <button className="btn solid hum-btn" onClick={start} disabled={disabled} title="Hum a short tune and this Chog sings it back">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H9.5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H13v-2.59A6 6 0 0 0 18 11.5z" /></svg>
        Hum a tune
      </button>
    )

  return (
    <div className="hum" role="status" aria-live="polite">
      <span className="hum-say">{phase === 'count' ? `Get ready… ${count}` : 'Hum now: “ooo” or “la”'}</span>
      <span className="hum-dots" aria-hidden>
        {dots.map((d, i) => <i key={i} className={d === null ? '' : d ? 'on' : 'off'} />)}
      </span>
      <button className="btn quiet small" onClick={() => abort.current?.abort()}>Cancel</button>
    </div>
  )
}
