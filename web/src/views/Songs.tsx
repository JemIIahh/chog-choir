import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BEATS } from '../audio/band'
import type { Player } from '../audio/usePlayer'
import { VOWELS } from '../audio/voice'
import { Staff } from '../components/Staff'
import { thumbLg, type Chog } from '../data/chogs'
import { keyName } from '../lib/music'
import { encodeSong } from '../lib/share'
import { songFor } from '../lib/songs'
import { useClip } from '../lib/useClip'
import { useToast } from '../lib/useToast'

const SOUND = ['ahh', 'ehh', 'eee', 'ohh', 'ooo']
const fromHash = () => {
  const m = location.hash.match(/^#c=(\d+)/)
  return m ? Number(m[1]) : null
}

export function Songs({ chogs, byId, byN, player }: { chogs: Chog[]; byId: Map<number, Chog>; byN: Map<number, Chog>; player: Player }) {
  const [n, setN] = useState<number | null>(fromHash)
  const [text, setText] = useState(() => String(fromHash() ?? ''))
  const [heard, setHeard] = useState(false)
  const { flash, node: toast } = useToast()
  const clip = useClip(player, byId, flash)
  const faceRef = useRef<HTMLDivElement>(null)

  // a first look: a Rare or better Chog so the front door has something to show
  const showcase = useMemo(() => chogs.find(c => c.traits.Tier === 'Epic' || c.traits.Tier === 'Legendary') ?? chogs[0], [chogs])
  const chog = (n !== null ? byN.get(n) : null) ?? showcase
  const { song, lines } = useMemo(() => songFor(chog), [chog])
  const missing = n !== null && !byN.get(n)

  useEffect(() => { player.bind(song) }, [song, player])

  // the face keeps time: a small pulse on every beat, a bigger one when it sings
  useEffect(() => player.onStep(({ step, delay }) => {
    window.setTimeout(() => {
      const el = faceRef.current
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const sings = song.notes.some(x => x.step === step)
      el.animate([{ transform: 'scale(1)' }, { transform: `scale(${sings ? 1.09 : 1.025})` }, { transform: 'scale(1)' }], { duration: sings ? 380 : 240, easing: 'ease-out' })
      if (sings) {
        const b = document.createElement('span')
        b.className = `bubble v${chog.spec.vowel} big`
        b.textContent = SOUND[chog.spec.vowel]
        el.appendChild(b)
        b.animate([{ transform: 'translate(-50%, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }).onfinish = () => b.remove()
      }
    }, delay)
  }), [player, song, chog])

  const open = useCallback(async (num: number) => {
    const c = byN.get(num)
    if (!c) { flash(`There is no Chog #${num}. Numbers run from 1 to ${chogs.length}.`); return }
    setN(num)
    history.replaceState(null, '', `#c=${num}`)
    setHeard(true)
    player.stop()
    // changing Chog restarts the song from the top
    const sg = songFor(c).song
    player.bind(sg)
    await player.toggle()
  }, [byN, chogs.length, flash, player])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(text.replace('#', '').trim())
    if (!Number.isInteger(num) || num < 1) { flash('Type a Chog number, like 1462.'); return }
    void open(num)
  }

  const shuffle = () => {
    const c = chogs[Math.floor(Math.random() * chogs.length)]
    setText(String(c.n))
    void open(c.n)
  }

  const toggle = async () => { setHeard(true); await player.toggle() }

  const share = async () => {
    const url = `${location.origin}${location.pathname}#c=${chog.n}`
    try { await navigator.clipboard.writeText(url); flash(`Link copied. It opens Chog #${chog.n}'s song.`) } catch { flash('Copy the address bar to share this song.') }
  }

  const style = BEATS[song.beat]
  const stage = (
    <section className="stage songs" aria-label="Chog songs">
      <div className="stage-head">
        <div>
          <h1>Hear your Chog sing</h1>
          <p className="sub">Every one of the {chogs.length.toLocaleString()} Chogs has its own song, built from its traits.</p>
        </div>
      </div>

      <form className="finder" onSubmit={submit}>
        <label className="finder-in">
          <span>Chog #</span>
          <input inputMode="numeric" pattern="[0-9#]*" placeholder="1462" value={text} onChange={e => setText(e.target.value)} aria-label="Chog number" />
        </label>
        <button className="btn solid" type="submit">Play its song</button>
        <button className="btn" type="button" onClick={shuffle}>Shuffle</button>
      </form>
      {missing && <p className="w-err">There is no Chog #{n}. Numbers run from 1 to {chogs.length}.</p>}

      <div className="hero">
        <div className={`hero-face v${chog.spec.vowel}`} ref={faceRef}>
          <img src={thumbLg(chog.n)} alt={`Chog #${chog.n}`} />
        </div>
        <div className="hero-info">
          <h2>Chog #{chog.n}</h2>
          <p className="hero-meta">{keyName(song.root, song.mode)} · {song.tempo} bpm · {style.toLowerCase()} beat</p>
          <p className="hero-vowel">sings <b className={`v${chog.spec.vowel}`}>{VOWELS[chog.spec.vowel].toLowerCase()}</b> · {chog.spec.voiceType} voice</p>
          <div className="hero-btns">
            <button className={`play wide ${player.playing ? 'on' : ''}`} onClick={toggle} aria-label={player.playing ? 'Pause' : 'Play'}>
              {player.playing ? (
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><rect x="6" y="5" width="4.5" height="14" rx="1.4" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.4" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
              )}
              <span>{player.playing ? 'Pause' : 'Play'}</span>
            </button>
            <button className="btn" onClick={() => clip.save(song, `Chog #${chog.n}`, chog)} disabled={clip.progress !== null}>{clip.progress !== null ? `Recording ${Math.round(clip.progress * 100)}%` : 'Save clip'}</button>
            <button className="btn" onClick={share}>Copy link</button>
          </div>
        </div>
      </div>

      <div className="staff-wrap">
        <Staff ref={player.staff} song={song} byId={byId} brush={null} onPlace={() => undefined} onRemove={() => undefined} readOnly />
        {!heard && !player.playing && (
          <button className="hero-play" onClick={toggle}>
            <span className="hp-icon"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg></span>
            <span className="hp-text">Hear Chog #{chog.n}</span>
          </button>
        )}
      </div>

      <div className="next">
        <button className="btn solid" onClick={() => { location.hash = `#s=${encodeSong(song)}` }}>Remix it in the Studio</button>
        <button className="btn" onClick={() => { location.hash = '#choir' }}>Put your Chog in the Choir</button>
      </div>
    </section>
  )

  return (
    <>
      <main className="layout">
        {stage}
        <aside className="side">
          <section className="voicecard">
            <h2 className="side-h">How Chog #{chog.n} sounds</h2>
            <ul className="why">
              {chog.why.map(w => (
                <li key={w.trait}>
                  <span className="why-t">{w.value}<small>{w.trait}</small></span>
                  <span className="why-e">{w.effect}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="voicecard">
            <h2 className="side-h">How its song is built</h2>
            <ul className="why">
              {lines.map(w => (
                <li key={w.trait}>
                  <span className="why-t">{w.value}<small>{w.trait}</small></span>
                  <span className="why-e">{w.effect}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
      {toast}
    </>
  )
}
