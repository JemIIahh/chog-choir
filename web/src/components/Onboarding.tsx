import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/usePlayer'
import { TYPE_SHAPE, VOWELS, type VoiceType } from '../audio/voice'
import type { Chog } from '../data/chogs'
import { RecordSleeve } from './RecordSleeve'
import { songFor } from '../lib/songs'
import { useFacePulse } from '../lib/useFacePulse'
import { HolderPanel } from './HolderPanel'
import { Loft } from './Loft'

type Props = {
  chogs: Chog[]
  byId: Map<number, Chog>
  byN: Map<number, Chog>
  player: Player
  /** `to` is where to land: a hash like "#choir" or "#c=1462"; nothing means stay on Songs */
  onClose(to?: string): void
}

const STEPS = 4
const SOUND = ['ahh', 'ehh', 'eee', 'ohh', 'ooo']
const TYPES: VoiceType[] = ['bass', 'tenor', 'alto', 'soprano']
const mid = (c: Chog) => Math.round((c.spec.low + c.spec.high) / 2)

function PlayIcon({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><rect x="6" y="5" width="4.5" height="14" rx="1.4" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.4" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
  )
}

export function Onboarding({ chogs, byId, byN, player, onClose }: Props) {
  const [step, setStep] = useState(0)
  const showcase = useMemo(() => {
    const rare = chogs.filter(c => ['Rare', 'Epic', 'Legendary'].includes(c.traits.Tier))
    const pool = rare.length ? rare : chogs
    return pool[Math.floor(Math.random() * pool.length)]
  }, [chogs])
  const [chog, setChog] = useState<Chog>(showcase)
  const [vowel, setVowel] = useState<number | null>(null)
  const [type, setType] = useState<VoiceType | null>(null)
  const [text, setText] = useState('')
  const [miss, setMiss] = useState<string | null>(null)
  // an illustration of a busy round: about one Chog in five has sung, one in eleven is singing right now
  const demo = useMemo(() => chogs.map(c => { const h = ((c.id * 2654435761) >>> 0) / 2 ** 32; return { total: h < 0.2 ? 3 : 0, last: h < 0.09 ? 1 : 0, streak: 1, best: 1 } }), [chogs])
  const card = useRef<HTMLDivElement>(null)
  const faceRef = useRef<HTMLDivElement>(null)

  const { song } = useMemo(() => songFor(chog), [chog])
  useEffect(() => { player.bind(song) }, [song, player])
  useFacePulse(player, song, chog, faceRef)

  // every step starts quiet; the person decides when to hear something
  const stopRef = useRef(player.stop)
  stopRef.current = player.stop
  useEffect(() => { stopRef.current() }, [step])
  useEffect(() => () => stopRef.current(), [])
  useEffect(() => { card.current?.focus() }, [])

  const close = useCallback((to?: string) => { player.stop(); onClose(to) }, [player, onClose])
  const next = useCallback(() => (step === STEPS - 1 ? close() : setStep(s => s + 1)), [step, close])
  const back = useCallback(() => setStep(s => Math.max(0, s - 1)), [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) next()
      else if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) back()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [close, next, back])

  const wiggle = () => faceRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' })

  const playSong = async (c: Chog = chog) => {
    player.stop()
    player.bind(songFor(c).song)
    await player.toggle()
  }

  const pickChog = (c: Chog) => {
    setChog(c)
    setText(String(c.n))
    setMiss(null)
    void playSong(c)
  }

  const find = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(text.replace('#', '').trim())
    const c = Number.isInteger(num) ? byN.get(num) : undefined
    if (!c) { setMiss(`There is no Chog #${text.trim() || '…'}. Numbers run from 1 to ${chogs.length}.`); return }
    pickChog(c)
  }

  const shuffle = () => pickChog(chogs[Math.floor(Math.random() * chogs.length)])

  const tryVowel = (v: number) => {
    setVowel(v)
    wiggle()
    player.stop()
    player.hear({ ...chog, spec: { ...chog.spec, vowel: v as 0 | 1 | 2 | 3 | 4 } }, mid(chog))
  }

  const tryType = (t: VoiceType) => {
    setType(t)
    wiggle()
    player.stop()
    const sh = TYPE_SHAPE[t]
    const spec = { ...chog.spec, voiceType: t, size: sh.size, low: sh.low, high: sh.high }
    player.hear({ ...chog, spec }, Math.round((sh.low + sh.high) / 2))
  }

  const face = (
    <div className="onb-face">
      <RecordSleeve chog={chog} playing={player.playing} faceRef={faceRef} size={190} />
      <p className="onb-cap">Chog #{chog.n}, sings <b className={`v${chog.spec.vowel}`}>{VOWELS[chog.spec.vowel].toLowerCase()}</b>, {chog.spec.voiceType} voice</p>
    </div>
  )

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label="Welcome to Chog Choir">
      <div className="onb-card" ref={card} tabIndex={-1}>
        <button className="onb-skip" onClick={() => close()}>Skip</button>

        <div className="onb-body" key={step}>
          {step === 0 && (
            <>
              {face}
              <div className="onb-text">
                <h1>Every Chog has a voice.</h1>
                <p>Its real traits decide how it sounds. Press play and hear one.</p>
                <button className={`play wide ${player.playing ? 'on' : ''}`} onClick={() => playSong()} aria-label={player.playing ? 'Pause' : 'Hear a Chog sing'}>
                  <PlayIcon on={player.playing} />
                  <span>{player.playing ? 'Pause' : 'Hear a Chog sing'}</span>
                </button>
                <p className="onb-fine">Sound on. 1,969 Chogs, each with its own song.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {face}
              <div className="onb-text">
                <h1>The mouth picks the vowel.</h1>
                <p>Tap one. This Chog sings it in its own voice.</p>
                <div className="vowels" role="group" aria-label="Vowels">
                  {SOUND.map((s, i) => (
                    <button key={s} className={`vbtn v${i} ${vowel === i ? 'on' : ''}`} onClick={() => tryVowel(i)}>
                      {s}
                      {chog.spec.vowel === i && <small>its own</small>}
                    </button>
                  ))}
                </div>
                <h2>The body picks the register.</h2>
                <div className="chips" role="group" aria-label="Voice type">
                  {TYPES.map(t => (
                    <button key={t} className={`chip ${type === t ? 'on' : ''}`} aria-pressed={type === t} onClick={() => tryType(t)}>{t}{chog.spec.voiceType === t ? ' (its own)' : ''}</button>
                  ))}
                </div>
                <p className="onb-fine">Eyes, hat, accessory and rarity shape the rest. Every Chog&apos;s card explains its voice in plain words.</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {face}
              <div className="onb-text">
                <h1>Now find yours.</h1>
                <p>Type your Chog&apos;s number, the one in its name.</p>
                <form className="finder" onSubmit={find}>
                  <label className="finder-in">
                    <span>Chog #</span>
                    <input inputMode="numeric" pattern="[0-9#]*" placeholder="1462" value={text} onChange={e => setText(e.target.value)} aria-label="Chog number" />
                  </label>
                  <button className="btn solid" type="submit">Hear its song</button>
                  <button className="btn" type="button" onClick={shuffle}>Shuffle</button>
                </form>
                {miss && <p className="w-err" role="alert">{miss}</p>}
                <HolderPanel inline byId={byId} selectedN={chog.n} onPick={pickChog} />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="onb-wide">
              <h1>Then sing together.</h1>
              <p>Every Chog has a seat in the choir. One Chog, one note, once a round, and only its owner can place it. The more Chogs have sung, the fuller the band: first a pad, then bass, then drums.</p>
              <Loft chogs={chogs} stats={demo} epoch={0} mine={new Set()} selectedId={null} onPick={c => { player.stop(); player.hear(c, mid(c)) }} />
              <p className="onb-fine">An example of a busy round: bright seats are Chogs that have sung. Tap any seat to hear that Chog. Try the Choir free on testnet, or sing with a real Chog on Monad.</p>
              <div className="onb-cta">
                <button className="btn solid big" onClick={() => close('#choir')}>Open the Choir</button>
                <button className="btn big" onClick={() => close(`#c=${chog.n}`)}>Keep exploring songs</button>
              </div>
            </div>
          )}
        </div>

        <div className="onb-foot">
          <div className="dots" role="tablist" aria-label="Steps">
            {Array.from({ length: STEPS }, (_, i) => (
              <button key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} aria-label={`Step ${i + 1} of ${STEPS}`} aria-current={i === step ? 'step' : undefined} />
            ))}
          </div>
          <div className="onb-nav">
            {step > 0 && <button className="btn quiet" onClick={back}>Back</button>}
            <button className="btn solid" onClick={next}>{step === STEPS - 1 ? 'Start exploring' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
