import { useHolder } from '../chain/useHolder'
import { thumb, type Chog } from '../data/chogs'

type Props = { byId: Map<number, Chog>; onPick(c: Chog): void; selectedN?: number | null }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** "Find my Chogs": connect a wallet, see the real Chogs it holds, tap one to hear its song. */
export function HolderPanel({ byId, onPick, selectedN }: Props) {
  const h = useHolder()
  if (h.account)
    return (
      <div className="holder">
        <p className="holder-line">
          {h.ids === null ? 'Looking for your Chogs…' : h.ids.length === 0 ? `${short(h.account)} holds no Chog Genesis. Type a number to hear any Chog.` : `${short(h.account)} holds ${h.ids.length} ${h.ids.length === 1 ? 'Chog' : 'Chogs'}. Tap one.`}
          <button className="btn quiet small" onClick={h.reset}>Not me</button>
        </p>
        {h.ids && h.ids.length > 0 && (
          <div className="thumbs row holder-row">
            {h.ids.slice(0, 40).map(id => {
              const c = byId.get(id)!
              return (
                <button key={id} className={`thumb v${c.spec.vowel} ${selectedN === c.n ? 'sel' : ''}`} onClick={() => onPick(c)} title={`#${c.n}`} aria-label={`Chog #${c.n}`}>
                  <img src={thumb(c.n)} alt="" draggable={false} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  return (
    <div className="holder">
      {h.wallets === null ? null : h.wallets.length === 0 ? (
        <p className="holder-line">No wallet in this browser. Type a number to hear any Chog.</p>
      ) : (
        <div className="holder-btns">
          {h.wallets.map(w => (
            <button key={w.rdns ?? w.name} className="btn" disabled={h.busy} onClick={() => h.connect(w)}>
              {w.icon && <img src={w.icon} alt="" width={18} height={18} />}
              {h.busy ? 'Waiting for your wallet…' : `Find my Chogs with ${w.name}`}
            </button>
          ))}
          <span className="holder-fine">It only reads which Chogs you hold. Nothing is signed or sent.</span>
        </div>
      )}
      {h.error && <p className="w-err" role="alert">{h.error}</p>}
    </div>
  )
}
