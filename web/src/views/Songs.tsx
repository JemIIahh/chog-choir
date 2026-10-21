import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BEATS } from '../audio/band'
import type { Player } from '../audio/usePlayer'
import { VOWELS } from '../audio/voice'
import { HumButton } from '../components/HumButton'
import { Staff } from '../components/Staff'
import { thumb, type Chog } from '../data/chogs'
import { stepSeconds } from '../audio/timing'
import { RecordSleeve } from '../components/RecordSleeve'
import { keyName } from '../lib/music'
import { encodeSong, type Note } from '../lib/share'
import { duetSong, songFor } from '../lib/songs'
import { hummedNotes } from '../lib/pitch'
import { makePoster } from '../lib/poster'
import { useClip } from '../lib/useClip'
import { useFacePulse } from '../lib/useFacePulse'
import { useToast } from '../lib/useToast'
import { HolderPanel } from '../components/HolderPanel'

/** #c=1462 is one Chog's song; #c=1462&d=88 is a duet with Chog #88. */
const parseHash = (): { n: number | null; d: number | null } => {
  const m = location.hash.match(/^#c=(\d+)(?:&d=(\d+))?/)
  return { n: m ? Number(m[1]) : null, d: m?.[2] ? Number(m[2]) : null }
}
const linkFor = (n: number, d: number | null) => `#c=${n}${d ? `&d=${d}` : ''}`

export function Songs({ chogs, byId, byN, player }: { chogs: Chog[]; byId: Map<number, Chog>; byN: Map<number, Chog>; player: Player }) {
  const [n, setN] = useState<number | null>(() => parseHash().n)
  const [text, setText] = useState(() => String(parseHash().n ?? ''))
  const [partnerN, setPartnerN] = useState<number | null>(() => parseHash().d)
  const [partnerText, setPartnerText] = useState(() => String(parseHash().d ?? ''))
  const [hum, setHum] = useState<Note[] | null>(null) // a tune someone hummed, sung by this Chog instead of its own hook
  const [heard, setHeard] = useState(false)
  const { flash, node: toast } = useToast()
  const clip = useClip(player, byId, flash)
  const faceRef = useRef<HTMLDivElement>(null)

  // a first look: a Rare or better Chog so the front door has something to show
  const showcase = useMemo(() => chogs.find(c => c.traits.Tier === 'Epic' || c.traits.Tier === 'Legendary') ?? chogs[0], [chogs])
  const chog = (n !== null ? byN.get(n) : null) ?? showcase
  const partner = (partnerN !== null ? byN.get(partnerN) : null) ?? null
  const { song: solo, lines } = useMemo(() => songFor(chog), [chog])
  const song = useMemo(() => {
    const base = hum ? { ...solo, notes: hum } : solo // a hummed tune replaces the Chog's own hook
    return partner && partner.id !== chog.id ? duetSong(base, partner) : base
  }, [solo, hum, partner, chog.id])
  const missing = n !== null && !byN.get(n)
  useEffect(() => { setText(String(chog.n)) }, [chog.n])
  useEffect(() => { setHum(null) }, [chog.id])
  useEffect(() => {
    const on = () => {
      const m = parseHash()
      if (m.n !== null) { setN(m.n); setPartnerN(m.d); setPartnerText(String(m.d ?? '')) }
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => { player.bind(song) }, [song, player])

  useFacePulse(player, song, chog, faceRef)

  const open = useCallback(async (num: number, withPartner: number | null = partnerN) => {
    const c = byN.get(num)
    if (!c) { flash(`There is no Chog #${num}. Numbers run from 1 to ${chogs.length}.`); return }
    const g = withPartner !== null ? byN.get(withPartner) ?? null : null
    setN(num)
    setPartnerN(g ? withPartner : null)
    history.replaceState(null, '', linkFor(num, g ? withPartner : null))
    setHeard(true)
    player.stop()
    // changing Chog restarts the song from the top
    const sg = songFor(c).song
    player.bind(g && g.id !== c.id ? duetSong(sg, g) : sg)
    await player.toggle()
  }, [byN, chogs.length, flash, player, partnerN])

  const submitDuet = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(partnerText.replace('#', '').trim())
    if (!Number.isInteger(num) || num < 1) { flash('Type the number of the Chog to sing with, like 88.'); return }
    if (!byN.get(num)) { flash(`There is no Chog #${num}. Numbers run from 1 to ${chogs.length}.`); return }
    if (num === chog.n) { flash('Pick a different Chog for a duet.'); return }
    setHum(null)
    void open(chog.n, num)
  }

  const clearDuet = () => { setPartnerText(''); void open(chog.n, null) }

  const onTune = (frames: (number | null)[]) => {
    const notes = hummedNotes(frames, song.root, song.mode, chog.spec, chog.id)
    if (notes.length < 3) { flash('I could not hear a tune. Hum “ooo” a little louder and closer to the mic.'); return }
    setHum(notes)
    flash(`Chog #${chog.n} is singing your hum.`)
    player.stop()
    window.setTimeout(() => { void player.toggle() }, 120) // after the new song has been handed to the player
  }

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
    // a hummed tune is not in any Chog's trait list, so it travels as a whole song
    const link = hum ? `#s=${encodeSong(song)}` : linkFor(chog.n, partner ? partner.n : null)
    const url = `${location.origin}${location.pathname}${link}`
    try { await navigator.clipboard.writeText(url); flash(hum ? 'Link copied. It opens your hummed tune in the Studio.' : partner ? `Link copied. It opens the duet of #${chog.n} and #${partner.n}.` : `Link copied. It opens Chog #${chog.n}'s song.`) } catch { flash('Copy the address bar to share this song.') }
  }

  const savePoster = async () => {
    flash('Printing your poster…')
    try {
      const blob = await makePoster({ song, byId, title: partner ? `Chog #${chog.n} and #${partner.n}` : `Chog #${chog.n}`, hero: chog })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `chog-${chog.n}${partner ? `-and-${partner.n}` : ''}-poster.png`
      a.click()
      flash('Poster saved.')
    } catch (e) { flash(e instanceof Error ? e.message : 'Could not make the poster.') }
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
      <form className="finder duet" onSubmit={submitDuet}>
        <label className="finder-in">
          <span>Duet with Chog #</span>
          <input inputMode="numeric" pattern="[0-9#]*" placeholder="88" value={partnerText} onChange={e => setPartnerText(e.target.value)} aria-label="Duet partner's number" />
        </label>
        <button className="btn" type="submit">Sing together</button>
        {partner && <button className="btn quiet" type="button" onClick={clearDuet}>Solo again</button>}
      </form>
      {missing && <p className="w-err">There is no Chog #{n}. Numbers run from 1 to {chogs.length}.</p>}
      <HolderPanel byId={byId} selectedN={chog.n} onPick={c => { setText(String(c.n)); void open(c.n) }} />

      <div className="hero">
        <RecordSleeve chog={chog} playing={player.playing} faceRef={faceRef} />
        <div className="hero-info">
          <h2>Chog #{chog.n}{partner && partner.id !== chog.id ? ` & #${partner.n}` : ''}</h2>
          <p className="hero-meta">{keyName(song.root, song.mode)} · {song.tempo} bpm · {style.toLowerCase()} beat</p>
          {partner && partner.id !== chog.id && (
            <p className="duet-with"><img src={thumb(partner.n)} alt="" />with Chog #{partner.n}, who sings <b className={`v${partner.spec.vowel}`}>{VOWELS[partner.spec.vowel].toLowerCase()}</b> ({partner.spec.voiceType})</p>
          )}
          {hum && <p className="hero-note">Chog #{chog.n} is singing the tune you hummed. <button className="btn quiet small" onClick={() => setHum(null)}>Back to its own song</button></p>}
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
            <button className="btn" onClick={() => clip.save(song, partner ? `Chog #${chog.n} and #${partner.n}` : `Chog #${chog.n}`, chog)} disabled={clip.progress !== null}>{clip.progress !== null ? `Recording ${Math.round(clip.progress * 100)}%` : 'Save clip'}</button>
            <button className="btn" onClick={savePoster}>Save poster</button>
            <button className="btn" onClick={share}>Copy link</button>
          </div>
          <div className="hum-row">
            <HumButton stepSeconds={stepSeconds(song.tempo)} disabled={clip.progress !== null} onTune={onTune} onProblem={flash} />
            <span className="hum-hint">Hum a short tune and Chog #{chog.n} sings it back.</span>
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
