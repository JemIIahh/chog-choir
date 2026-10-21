import { useCallback, useEffect, useState } from 'react'
import type { Chain } from 'viem'
import { connectWallet, discoverWallets, type Found, type Session } from './wallet'
import { explain } from './client'

export function useWallet(chain: Chain) {
  const [wallets, setWallets] = useState<Found[] | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void discoverWallets().then(setWallets) }, [])

  const connect = useCallback(async (w: Found) => {
    setBusy(true)
    setError(null)
    try { setSession(await connectWallet(w, chain)) } catch (e) { setError(explain(e)) } finally { setBusy(false) }
  }, [chain])

  const disconnect = useCallback(() => setSession(null), [])

  // follow account switches in the wallet
  useEffect(() => {
    const p = wallets?.find(w => w.name === session?.name)?.provider as { on?: (e: string, f: (a: string[]) => void) => void; removeListener?: (e: string, f: (a: string[]) => void) => void } | undefined
    if (!session || !p?.on) return
    const onAccounts = (a: string[]) => { if (!a[0]) setSession(null) }
    p.on('accountsChanged', onAccounts)
    return () => p.removeListener?.('accountsChanged', onAccounts)
  }, [session, wallets])

  return { wallets, session, busy, error, connect, disconnect }
}
