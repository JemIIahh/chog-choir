import { BEATS } from '../audio/band'
import { MODES, ROOTS } from '../lib/music'
import { TEMPO_MAX, TEMPO_MIN, type Song } from '../lib/share'

type Props = {
  song: Song
  playing: boolean
  onToggle(): void
  onChange(patch: Partial<Song>): void
  /** the key is fixed by the chain in Today's Choir */
  keyLocked?: boolean
  children?: React.ReactNode
}

function Slider({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange(v: number): void; unit?: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="slider">
      <span className="sl-top">
        <span>{label}</span>
        <output>{value}{unit}</output>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ ['--p' as string]: `${pct}%` } as React.CSSProperties} />
    </label>
  )
}

export function Dock({ song, playing, onToggle, onChange, keyLocked, children }: Props) {
  return (
    <div className="dock">
      <button className={`play ${playing ? 'on' : ''}`} onClick={onToggle} aria-label={playing ? 'Pause the choir' : 'Play the choir'}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><rect x="6" y="5" width="4.5" height="14" rx="1.4" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.4" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
        )}
      </button>

      <Slider label="Tempo" value={song.tempo} min={TEMPO_MIN} max={TEMPO_MAX} onChange={tempo => onChange({ tempo })} unit=" bpm" />
      <Slider label="Space" value={song.space} min={0} max={100} onChange={space => onChange({ space })} />
      <Slider label="Brightness" value={song.bright} min={0} max={100} onChange={bright => onChange({ bright })} />

      <div className="keypick">
        <span>Key and beat</span>
        <div className="key-row">
          <select value={song.root} disabled={keyLocked} onChange={e => onChange({ root: Number(e.target.value) })} aria-label="Key">
            {ROOTS.map((r, i) => <option key={r} value={i}>{r}</option>)}
          </select>
          <select value={song.mode} disabled={keyLocked} onChange={e => onChange({ mode: Number(e.target.value) })} aria-label="Scale">
            {MODES.map((m, i) => <option key={m.name} value={i}>{m.name.toLowerCase()}</option>)}
          </select>
          <select value={song.beat} onChange={e => onChange({ beat: Number(e.target.value) })} aria-label="Beat">
            {BEATS.map((b, i) => <option key={b} value={i}>{b.toLowerCase()}</option>)}
          </select>
        </div>
      </div>

      {children && <div className="dock-actions">{children}</div>}
    </div>
  )
}
