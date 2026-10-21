import type { Chain } from 'viem'
import type { useWallet } from '../chain/useWallet'

type W = ReturnType<typeof useWallet>

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function WalletPanel({ wallet, chain, why }: { wallet: W; chain: Chain; why: string }) {
  const { wallets, session, busy, error, connect, disconnect } = wallet
  if (session)
    return (
      <div className="wallet on">
        <span className="w-dot" />
        <span className="w-id">{short(session.account)}</span>
        <span className="w-net">{chain.name}</span>
        <button className="btn quiet small" onClick={disconnect}>Disconnect</button>
      </div>
    )
  return (
    <div className="wallet">
      <p className="w-why">{why}</p>
      {wallets === null ? (
        <p className="w-note">Looking for wallets…</p>
      ) : wallets.length === 0 ? (
        <p className="w-note">No wallet found in this browser. You can still listen to everything here. To sing, install a wallet such as MetaMask or Rabby, then reload.</p>
      ) : (
        <div className="w-list">
          {wallets.map(w => (
            <button key={w.rdns ?? w.name} className="btn solid" disabled={busy} onClick={() => connect(w)}>
              {w.icon && <img src={w.icon} alt="" width={20} height={20} />}
              {busy ? 'Waiting for your wallet…' : `Connect ${w.name}`}
            </button>
          ))}
        </div>
      )}
      {error && <p className="w-err" role="alert">{error}</p>}
    </div>
  )
}
