import type { Chain } from 'viem'
import type { useWallet } from '../chain/useWallet'
import { WalletChooser } from './WalletChooser'

type W = ReturnType<typeof useWallet>

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function WalletPanel({ wallet, chain, why }: { wallet: W; chain: Chain; why: string }) {
  const { session, disconnect } = wallet
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
      <WalletChooser />
    </div>
  )
}
