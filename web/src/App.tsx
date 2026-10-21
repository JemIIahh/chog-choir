import { useEffect, useMemo, useState } from 'react'
import { renderSong } from './audio/render'
import { usePlayer } from './audio/usePlayer'
import type { Song } from './lib/share'
import { loadChogs, type Chog } from './data/chogs'
import { Choir } from './views/Choir'
import { Records } from './views/Records'
import { Studio } from './views/Studio'

type View = 'studio' | 'choir' | 'records'
const viewFromHash = (): View => (location.hash.startsWith('#choir') ? 'choir' : location.hash.startsWith('#records') ? 'records' : 'studio')

export default function App() {
  const [chogs, setChogs] = useState<Chog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadChogs().then(setChogs).catch(e => setError(String(e.message ?? e)))
  }, [])

  if (error) return <Splash text={`${error}. Reload to try again.`} />
  if (!chogs) return <Splash text="Gathering 1,969 Chogs…" />
  return <Shell chogs={chogs} />
}

function Splash({ text }: { text: string }) {
  return <div className="splash"><span className="splash-mark">Chog Choir</span><p>{text}</p></div>
}

function Shell({ chogs }: { chogs: Chog[] }) {
  const byId = useMemo(() => new Map(chogs.map(c => [c.id, c])), [chogs])
  const player = usePlayer(byId)
  const [view, setView] = useState<View>(viewFromHash)

  // lets tests render and measure the sound without a speaker
  useEffect(() => {
    ;(window as unknown as { __choir: unknown }).__choir = {
      chogs,
      song: player.current,
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
    history.pushState(null, '', v === 'studio' ? location.pathname : `#${v}`)
    setView(v)
  }

  return (
    <div className="app">
      <header className="top">
        <a className="mark" href="#" onClick={go('studio')}>Chog Choir</a>
        <nav className="tabs" aria-label="Sections">
          <a href="#" className={view === 'studio' ? 'on' : ''} onClick={go('studio')} aria-current={view === 'studio' ? 'page' : undefined}>Studio</a>
          <a href="#choir" className={view === 'choir' ? 'on' : ''} onClick={go('choir')} aria-current={view === 'choir' ? 'page' : undefined}>The Choir</a>
          <a href="#records" className={view === 'records' ? 'on' : ''} onClick={go('records')} aria-current={view === 'records' ? 'page' : undefined}>Records</a>
        </nav>
      </header>
      {view === 'studio' && <Studio chogs={chogs} byId={byId} player={player} />}
      {view === 'choir' && <Choir chogs={chogs} byId={byId} player={player} />}
      {view === 'records' && <Records byId={byId} player={player} />}
    </div>
  )
}
