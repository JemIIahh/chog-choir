import { useCallback, useEffect, useMemo, useState } from 'react'
import { renderSong, toWav } from '../audio/render'
import { stepSeconds } from '../audio/synth'
import type { Player } from '../audio/usePlayer'
import { BandTray } from '../components/BandTray'
import { Dock } from '../components/Dock'
import { Shelf } from '../components/Shelf'
import { Staff } from '../components/Staff'
import { VoiceCard } from '../components/VoiceCard'
import type { Chog } from '../data/chogs'
import { bandSong, cellKey, withPhrase } from '../lib/compose'
import { epochKey, keyName } from '../lib/music'
import { decodeSong, encodeSong, MAX_NOTES, type Note, type Song } from '../lib/share'
import { makePoster } from '../lib/poster'
import { useClip } from '../lib/useClip'
import { useToast } from '../lib/useToast'

const fromHash = (supply: number): Song | null => {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)/)
  return m ? decodeSong(m[1], supply) : null
}

export function Studio({ chogs, byId, player }: { chogs: Chog[]; byId: Map<number, Chog>; player: Player }) {
  const [song, setSong] = useState<Song>(() => fromHash(chogs.length) ?? bandSong(chogs, 7))
  const [brushId, setBrushId] = useState<number | null>(() => song.notes[0]?.id ?? null)
  const [heard, setHeard] = useState(false)
  const { flash, node: toast } = useToast()
  const clip = useClip(player, byId, flash)
  useEffect(() => { player.bind(song) }, [song, player])

  // the link always describes what is on screen
  useEffect(() => {
    const t = window.setTimeout(() => history.replaceState(null, '', `#s=${encodeSong(song)}`), 250)
    return () => window.clearTimeout(t)
  }, [song])

  const brush = brushId ? byId.get(brushId) ?? null : null

  const band = useMemo(() => {
    const counts = new Map<number, number>()
    for (const n of song.notes) counts.set(n.id, (counts.get(n.id) ?? 0) + 1)
    return [...counts].map(([id, count]) => ({ chog: byId.get(id)!, count }))
  }, [song.notes, byId])

  const toggle = useCallback(async () => {
    await player.toggle()
    setHeard(true)
  }, [player])

  const homePitch = (c: Chog) => Math.round((c.spec.low + c.spec.high) / 2)
  const hear = useCallback((c: Chog, pitch = homePitch(c)) => player.hear(c, pitch), [player])
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
    setSong(s => bandSong(chogs, seed, { tempo: s.tempo, root: k.root, mode: k.mode, space: s.space, bright: s.bright, beat: s.beat || 1 }))
    setBrushId(null)
    setHeard(true)
    if (!player.playing) void player.toggle()
  }, [chogs, player])

  const share = useCallback(async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeSong(song)}`
    try { await navigator.clipboard.writeText(url); flash('Link copied. It holds this exact band.') } catch { flash('Copy the address bar: it holds this exact band.') }
  }, [song, flash])

  const saveWav = useCallback(async () => {
    flash('Rendering…')
    const buf = await renderSong(song, player.specOf, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(toWav(buf))
    a.download = `chog-choir-${keyName(song.root, song.mode).replace(/\s+/g, '-')}.wav`
    a.click()
    flash('Saved.')
  }, [song, player.specOf, flash])

  const savePoster = useCallback(async () => {
    if (song.notes.length === 0) { flash('Nothing to print yet. Put a Chog on the staff.'); return }
    flash('Printing your poster…')
    try {
      const blob = await makePoster({ song, byId, title: keyName(song.root, song.mode).replace(/^./, c => c.toUpperCase()) })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'chog-choir-poster.png'
      a.click()
      flash('Poster saved.')
    } catch (e) { flash(e instanceof Error ? e.message : 'Could not make the poster.') }
  }, [song, byId, flash])

  const clear = useCallback(() => setSong(s => ({ ...s, notes: [] })), [])

  const brushNotes = brush ? song.notes.filter(n => n.id === brush.id).length : 0
  const loopSec = (stepSeconds(song.tempo) * 16).toFixed(1)

  return (
    <>
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
            <Staff ref={player.staff} song={song} byId={byId} brush={brush} onPlace={place} onRemove={remove} />
            {!heard && !player.playing && (
              <button className="hero-play" onClick={toggle}>
                <span className="hp-icon"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg></span>
                <span className="hp-text">Hear {band.length || 'the'} Chogs sing</span>
              </button>
            )}
          </div>

          <BandTray band={band} brushId={brushId} onPick={select} />

          <Dock song={song} playing={player.playing} onToggle={toggle} onChange={patch}>
            <button className="btn dark" onClick={share}>Copy link</button>
            <button className="btn dark" onClick={() => clip.save(song)} disabled={clip.progress !== null}>{clip.progress !== null ? `Recording ${Math.round(clip.progress * 100)}%` : 'Save clip'}</button>
            <button className="btn dark" onClick={savePoster}>Poster</button>
            <button className="btn dark" onClick={saveWav}>.wav</button>
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
      {toast}
    </>
  )
}
