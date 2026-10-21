import { useWalletCtx } from '../chain/WalletContext'
import { thumb, type Chog } from '../data/chogs'
import { WalletChooser } from './WalletChooser'

type Props = { byId: Map<number, Chog>; onPick(c: Chog): void; selectedN?: number | null; /** list the wallets right here (the welcome hides the header) */ inline?: boolean }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Your Chogs: once a wallet is connected, the real Chogs it holds, tap one to hear its song. */
export function HolderPanel({ byId, onPick, selectedN, inline }: Props) {
  const { account, held, disconnect, setMenuOpen } = useWalletCtx()
  if (account)
    return (
      <div className="holder">
        <p className="holder-line">
          {held === null ? 'Looking for your Chogs…' : held.length === 0 ? `${short(account)} holds no Chog Genesis. Type a number to hear any Chog.` : `${short(account)} holds ${held.length} ${held.length === 1 ? 'Chog' : 'Chogs'}. Tap one.`}
          <button className="btn quiet small" onClick={disconnect}>Disconnect</button>
        </p>
        {held && held.length > 0 && (
          <div className="thumbs row holder-row">
            {held.slice(0, 40).map(id => {
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
      <p className="holder-line">
        Own a Chog? Connect your wallet to see yours here.
        {!inline && <button className="btn small" onClick={() => setMenuOpen(true)}>Connect wallet</button>}
      </p>
      {inline && <WalletChooser />}
      {inline && <span className="holder-fine">Connecting only reads which Chogs you hold. Nothing is signed or sent.</span>}
    </div>
  )
}
