import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { explain, makeReader, readHeld } from './client'
import { monadMainnet, REAL_CHOG } from './config'
import { discoverWallets, requestAccount, type Found } from './wallet'

const reader = makeReader({ chain: monadMainnet, deployment: null })

/** Finds the real Chog Genesis tokens a wallet holds on Monad. Read-only: nothing is signed or sent. */
export function useHolder() {
  const [wallets, setWallets] = useState<Found[] | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [ids, setIds] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void discoverWallets().then(setWallets) }, [])

  const connect = useCallback(async (w: Found) => {
    setBusy(true)
    setError(null)
    setIds(null)
    try {
      const acc = await requestAccount(w)
      setAccount(acc)
      setIds(await readHeld(reader, REAL_CHOG as Address, acc))
    } catch (e) {
      setAccount(null)
      setError(explain(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const reset = useCallback(() => { setAccount(null); setIds(null); setError(null) }, [])
  return { wallets, account, ids, busy, error, connect, reset }
}
