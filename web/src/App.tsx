import { useEffect, useMemo, useState } from 'react'
import { renderSong } from './audio/render'
import { songFor } from './lib/songs'
import { usePlayer } from './audio/usePlayer'
import type { Song } from './lib/share'
import { loadChogs, type Chog } from './data/chogs'
import { defaultNet, rememberNet, resolveTargets, type Net } from './chain/config'
import { Onboarding } from './components/Onboarding'
import { ThemeToggle } from './components/ThemeToggle'
import { WalletButton } from './components/WalletButton'
import { WalletProvider } from './chain/WalletContext'
import { PaintBackdrop } from './components/PaintBackdrop'
import { Choir } from './views/Choir'
import { Records } from './views/Records'
import { Songs } from './views/Songs'
import { Studio } from './views/Studio'

type View = 'songs' | 'studio' | 'choir' | 'records'
const SEEN = 'chogchoir:welcome-seen'
const seen = () => { try { return localStorage.getItem(SEEN) === '1' } catch { return false } }
const markSeen = () => { try { localStorage.setItem(SEEN, '1') } catch { /* private mode: it will just show again */ } }

const viewFromHash = (): View => {
  const h = location.hash
  if (h.startsWith('#choir')) return 'choir'
  if (h.startsWith('#records')) return 'records'
  if (h.startsWith('#s=') || h.startsWith('#studio')) return 'studio'
  return 'songs'
}

export default function App() {
  const [chogs, setChogs] = useState<Chog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadChogs().then(setChogs).catch(e => setError(String(e.message ?? e)))
  }, [])

  if (error) return <Splash text={`${error}. Reload to try again.`} />
  if (!chogs) return <Splash text="Gathering 1,969 Chogs…" />
  return <WalletProvider><Shell chogs={chogs} /></WalletProvider>
}

function Splash({ text }: { text: string }) {
  return <div className="splash"><span className="splash-mark">Chog Choir</span><p>{text}</p></div>
}

function Shell({ chogs }: { chogs: Chog[] }) {
  const byId = useMemo(() => new Map(chogs.map(c => [c.id, c])), [chogs])
  const byN = useMemo(() => new Map(chogs.map(c => [c.n, c])), [chogs])
  const player = usePlayer(byId)
  const [view, setView] = useState<View>(viewFromHash)
  const targets = useMemo(resolveTargets, [])
  // first visit to the front door gets the welcome; links to a song, the studio or the choir go straight there
  const [welcome, setWelcome] = useState(() => !seen() && location.hash === '')
  const closeWelcome = (to?: string) => {
    markSeen()
    setWelcome(false)
    if (to) { location.hash = to }
  }
  const [net, setNetState] = useState<Net>(() => defaultNet(targets))
  const setNet = (n: Net) => { rememberNet(n); setNetState(n) }

  // lets tests render and measure the sound without a speaker
  useEffect(() => {
    ;(window as unknown as { __choir: unknown }).__choir = {
      chogs,
      song: player.current,
      songFor,
      // the audio the page is playing, as a stream, so a film can record exactly what the app sounds like
      tap: () => player.getEngine().recordTap.stream,
      render: async (s: Song, loops = 1) => {
        const buf = await renderSong(s, player.specOf, loops)
        return { rate: buf.sampleRate, left: Array.from(buf.getChannelData(0)), right: Array.from(buf.getChannelData(1)) }
      },
    }
  }, [chogs, player])

  useEffect(() => {
    const on = () => { player.stop(); setView(viewFromHash()) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [player])

  const go = (v: View) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (v === view) return
    player.stop()
    history.pushState(null, '', v === 'songs' ? location.pathname : `#${v}`)
    setView(v)
  }

  return (
    <>
    <PaintBackdrop player={player} byId={byId} />
    <div className={`app ${welcome ? 'hushed' : ''}`}>
      <header className={`top ${player.playing ? 'playing' : ''}`}>
        <a className="mark" href="#" onClick={go('songs')} aria-label="Chog Choir">
          {[...'Chog Choir'].map((ch, i) => <span key={i} aria-hidden style={{ ['--i' as string]: i } as React.CSSProperties}>{ch === ' ' ? '\u00a0' : ch}</span>)}
        </a>
        <nav className="tabs" aria-label="Sections">
          <a href="#" className={view === 'songs' ? 'on' : ''} onClick={go('songs')} aria-current={view === 'songs' ? 'page' : undefined}>Songs</a>
          <a href="#studio" className={view === 'studio' ? 'on' : ''} onClick={go('studio')} aria-current={view === 'studio' ? 'page' : undefined}>Studio</a>
          <a href="#choir" className={view === 'choir' ? 'on' : ''} onClick={go('choir')} aria-current={view === 'choir' ? 'page' : undefined}>The Choir</a>
          <a href="#records" className={view === 'records' ? 'on' : ''} onClick={go('records')} aria-current={view === 'records' ? 'page' : undefined}>Records</a>
        </nav>
        <div className="top-tools">
          <button className="how" onClick={() => setWelcome(true)} aria-label="How it works">How it works</button>
          <ThemeToggle />
          <WalletButton byId={byId} />
        </div>
      </header>
      {welcome && <Onboarding chogs={chogs} byId={byId} byN={byN} player={player} onClose={closeWelcome} />}
      {view === 'songs' && <Songs chogs={chogs} byId={byId} byN={byN} player={player} />}
      {view === 'studio' && <Studio chogs={chogs} byId={byId} player={player} />}
      {view === 'choir' && <Choir chogs={chogs} byId={byId} player={player} targets={targets} net={net} setNet={setNet} />}
      {view === 'records' && <Records byId={byId} player={player} targets={targets} net={net} setNet={setNet} />}
    </div>
    </>
  )
}
