import { useWalletCtx } from '../chain/WalletContext'

/** The wallets found in this browser, one button each. Used by the header menu, Songs, the welcome and the Choir. */
export function WalletChooser({ solid, onDone }: { solid?: boolean; onDone?(): void }) {
  const { wallets, busy, error, connect } = useWalletCtx()
  if (wallets === null) return <p className="w-note">Looking for wallets…</p>
  if (wallets.length === 0)
    return <p className="w-note">No wallet found in this browser. You can still listen to everything here. To sing, install a wallet such as MetaMask or Rabby, then reload.</p>
  return (
    <>
      <div className="w-list">
        {wallets.map(w => (
          <button key={w.rdns ?? w.name} className={`btn ${solid ? 'solid' : ''}`} disabled={busy} onClick={async () => { if (await connect(w)) onDone?.() }}>
            {w.icon && <img src={w.icon} alt="" width={20} height={20} />}
            {busy ? 'Waiting for your wallet…' : `Connect ${w.name}`}
          </button>
        ))}
      </div>
      {error && <p className="w-err" role="alert">{error}</p>}
    </>
  )
}
