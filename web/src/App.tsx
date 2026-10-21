import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChoirEngine } from './audio/engine'
import { renderSong, toWav } from './audio/render'
import { stepSeconds } from './audio/synth'
import { BandTray } from './components/BandTray'
import { Dock } from './components/Dock'
import { Shelf } from './components/Shelf'
import { Staff, type StaffHandle } from './components/Staff'
import { VoiceCard } from './components/VoiceCard'
import { loadChogs, type Chog } from './data/chogs'
import { bandSong, cellKey, withPhrase } from './lib/compose'
import { epochKey, keyName } from './lib/music'
import { decodeSong, encodeSong, MAX_NOTES, type Note, type Song } from './lib/share'

export default function App() {
  const [chogs, setChogs] = useState<Chog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadChogs().then(setChogs).catch(e => setError(String(e.message ?? e)))
  }, [])

  if (error) return <Splash text={`${error}. Reload to try again.`} />
  if (!chogs) return <Splash text="Gathering 1,969 Chogs…" />
  return <Studio chogs={chogs} />
}

function Splash({ text }: { text: string }) {
  return <div className="splash"><span className="splash-mark">Chog Choir</span><p>{text}</p></div>
}

const fromHash = (supply: number): Song | null => {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)/)
  return m ? decodeSong(m[1], supply) : null
}

function Studio({ chogs }: { chogs: Chog[] }) {
  const byId = useMemo(() => new Map(chogs.map(c => [c.id, c])), [chogs])
  const [song, setSong] = useState<Song>(() => fromHash(chogs.length) ?? bandSong(chogs, 7))
  const [brushId, setBrushId] = useState<number | null>(() => song.notes[0]?.id ?? null)
  const [playing, setPlaying] = useState(false)
  const [heard, setHeard] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const engine = useRef<ChoirEngine | null>(null)
  const staff = useRef<StaffHandle>(null)
  const songRef = useRef(song)
  songRef.current = song

  const specOf = useCallback((id: number) => byId.get(id)!.spec, [byId])

  const getEngine = useCallback(() => {
    if (!engine.current) {
      const e = new ChoirEngine(songRef.current, specOf)
      e.onStep = ({ step, delay }) => staff.current?.hit(step, delay)
      engine.current = e
    }
    return engine.current
  }, [specOf])

  useEffect(() => { engine.current?.setSong(song) }, [song])

  // lets tests render and measure the sound without a speaker
  useEffect(() => {
    ;(window as unknown as { __choir: unknown }).__choir = {
      chogs,
      song: () => songRef.current,
      render: async (s: Song, loops = 1) => {
        const buf = await renderSong(s, specOf, loops)
        return { rate: buf.sampleRate, left: Array.from(buf.getChannelData(0)), right: Array.from(buf.getChannelData(1)) }
      },
    }
  }, [chogs, specOf])
  useEffect(() => () => engine.current?.dispose(), [])

  // the link always describes what is on screen
  useEffect(() => {
    const t = window.setTimeout(() => history.replaceState(null, '', `#s=${encodeSong(song)}`), 250)
    return () => window.clearTimeout(t)
  }, [song])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2200)
  }, [])

  const brush = brushId ? byId.get(brushId) ?? null : null

  const band = useMemo(() => {
    const counts = new Map<number, number>()
    for (const n of song.notes) counts.set(n.id, (counts.get(n.id) ?? 0) + 1)
    return [...counts].map(([id, count]) => ({ chog: byId.get(id)!, count }))
  }, [song.notes, byId])

  const toggle = useCallback(async () => {
    const e = getEngine()
    if (e.playing) {
      e.stop()
      staff.current?.rest()
      setPlaying(false)
    } else {
      await e.start()
      setHeard(true)
      setPlaying(true)
    }
  }, [getEngine])

  const homePitch = (c: Chog) => Math.round((c.spec.low + c.spec.high) / 2)

  const hear = useCallback((c: Chog, pitch = homePitch(c)) => { void getEngine().audition(c.spec, pitch, c.id) }, [getEngine])

  const select = useCallback((c: Chog) => { setBrushId(c.id); hear(c) }, [hear])

  const place = useCallback((step: number, pitch: number) => {
    if (!brush) { flash('Pick a Chog first, then tap the staff.'); return }
    setSong(s => {
      if (s.notes.length >= MAX_NOTES) return s
      const notes = s.notes.filter(n => cellKey(n.step, n.pitch) !== cellKey(step, pitch))
      return { ...s, notes: [...notes, { id: brush.id, step, pitch }] }
    })
    hear(brush, pitch)
  }, [brush, flash, hear])

  const remove = useCallback((note: Note) => {
    setSong(s => ({ ...s, notes: s.notes.filter(n => !(n.id === note.id && n.step === note.step && n.pitch === note.pitch)) }))
  }, [])

  const patch = useCallback((p: Partial<Song>) => setSong(s => ({ ...s, ...p })), [])

  const surprise = useCallback(() => {
    const seed = (Math.random() * 1e9) | 0
    const k = epochKey(seed)
    setSong(s => bandSong(chogs, seed, { tempo: s.tempo, root: k.root, mode: k.mode, space: s.space, bright: s.bright }))
    setBrushId(null)
    if (!engine.current?.playing) void toggle()
  }, [chogs, toggle])

  const share = useCallback(async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeSong(song)}`
    try { await navigator.clipboard.writeText(url); flash('Link copied. It holds this exact band.') } catch { flash('Copy the address bar: it holds this exact band.') }
  }, [song, flash])

  const saveWav = useCallback(async () => {
    flash('Rendering…')
    const buf = await renderSong(song, specOf, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(toWav(buf))
    a.download = `chog-choir-${keyName(song.root, song.mode).replace(/\s+/g, '-')}.wav`
    a.click()
    flash('Saved.')
  }, [song, specOf, flash])

  const clear = useCallback(() => setSong(s => ({ ...s, notes: [] })), [])

  const brushNotes = brush ? song.notes.filter(n => n.id === brush.id).length : 0
  const loopSec = (stepSeconds(song.tempo) * 16).toFixed(1)

  return (
    <div className="app">
      <header className="top">
        <a className="mark" href="#" onClick={e => e.preventDefault()}>Chog Choir</a>
        <p className="tag">Every Chog has a voice. Its traits decide how it sounds.</p>
      </header>

      <main className="layout">
        <section className="stage" aria-label="Studio">
          <div className="stage-head">
            <div>
              <h1>{keyName(song.root, song.mode)}</h1>
              <p className="sub">{band.length} {band.length === 1 ? 'Chog' : 'Chogs'} · {song.notes.length} notes · {loopSec}s loop</p>
            </div>
            <div className="stage-btns">
              <button className="btn" onClick={surprise}>Surprise me</button>
              <button className="btn quiet" onClick={clear} disabled={song.notes.length === 0}>Clear</button>
            </div>
          </div>

          <div className="staff-wrap">
            <Staff ref={staff} song={song} byId={byId} brush={brush} onPlace={place} onRemove={remove} />
            {!heard && (
              <button className="hero-play" onClick={toggle}>
                <span className="hp-icon"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg></span>
                <span className="hp-text">Hear {band.length || 'the'} Chogs sing</span>
              </button>
            )}
          </div>

          <BandTray band={band} brushId={brushId} onPick={select} />

          <Dock song={song} playing={playing} onToggle={toggle} onChange={patch}>
            <button className="btn dark" onClick={share}>Copy link</button>
            <button className="btn dark" onClick={saveWav}>Save .wav</button>
          </Dock>
        </section>

        <aside className="side">
          <VoiceCard
            chog={brush}
            noteCount={brushNotes}
            onHear={() => brush && hear(brush)}
            onAddPhrase={() => brush && setSong(s => ({ ...s, notes: withPhrase(s.notes, brush) }))}
            onRemoveAll={() => brush && setSong(s => ({ ...s, notes: s.notes.filter(n => n.id !== brush.id) }))}
          />
          <Shelf chogs={chogs} selectedId={brushId} onSelect={select} />
        </aside>
      </main>

      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  )
}

