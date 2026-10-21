import { LOOKS, setLook, useLook } from '../lib/look'

// Temporary: lets the owner flip between looks while one is being chosen. Removed once a look is picked.
export function LookSwitch() {
  const look = useLook()
  return (
    <div className="looksw" role="group" aria-label="Look">
      <span>Look</span>
      {LOOKS.map(l => (
        <button key={l.id} className={l.id === look ? 'on' : ''} aria-pressed={l.id === look} onClick={() => setLook(l.id)}>{l.name}</button>
      ))}
    </div>
  )
}
