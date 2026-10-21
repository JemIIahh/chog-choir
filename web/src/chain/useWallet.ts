import { useMemo } from 'react'
import type { Chain } from 'viem'
import { useWalletCtx } from './WalletContext'
import { makeSession } from './wallet'

/** The shared connection, as a signing session for one chain (null until a wallet is connected). */
export function useWallet(chain: Chain) {
  const { wallets, found, account, busy, error, connect, disconnect } = useWalletCtx()
  const session = useMemo(() => (found && account ? makeSession(found, account, chain) : null), [found, account, chain])
  return { wallets, session, busy, error, connect, disconnect }
}
