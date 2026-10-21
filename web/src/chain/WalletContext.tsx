import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { explain, makeReader, readHeld } from './client'
import { monadMainnet, REAL_CHOG } from './config'
import { discoverWallets, requestAccount, sharedAccount, type Found } from './wallet'

// One wallet connection for the whole app, shared by the header button, Songs, the welcome and the Choir.
// Connecting only reads the account; nothing is signed or sent, and the network is switched only when you sing.

const KEY = 'chogchoir:wallet'
const reader = makeReader({ chain: monadMainnet, deployment: null })
const id = (w: Found) => w.rdns ?? w.name

type Ctx = {
  wallets: Found[] | null
  found: Found | null
  account: Address | null
  /** real Chog Genesis ids this account holds on Monad; null while looking */
  held: number[] | null
  busy: boolean
  error: string | null
  connect(w: Found): Promise<boolean>
  disconnect(): void
  /** the wallet menu in the header */
  menuOpen: boolean
  setMenuOpen(open: boolean): void
  /** the wallet connected last time, if the visitor did not disconnect */
  last: string | null
}

const Wallet = createContext<Ctx | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<Found[] | null>(null)
  const [found, setFound] = useState<Found | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [held, setHeld] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [last] = useState<string | null>(() => { try { return localStorage.getItem(KEY) } catch { return null } })

  // find the wallets in this browser, and quietly pick up the one connected last time (no prompt)
  useEffect(() => {
    let live = true
    void discoverWallets().then(async list => {
      if (!live) return
      setWallets(list)
      let last: string | null = null
      try { last = localStorage.getItem(KEY) } catch { /* private mode */ }
      const w = last ? list.find(x => id(x) === last) : undefined
      if (!w) return
      const acc = await sharedAccount(w)
      if (live && acc) { setFound(w); setAccount(acc) }
    })
    return () => { live = false }
  }, [])

  const connect = useCallback(async (w: Found) => {
    setBusy(true)
    setError(null)
    try {
      const acc = await requestAccount(w)
      setFound(w)
      setAccount(acc)
      try { localStorage.setItem(KEY, id(w)) } catch { /* ignore */ }
      return true
    } catch (e) {
      setError(explain(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setFound(null); setAccount(null); setHeld(null); setError(null)
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [])

  // follow account switches inside the wallet
  useEffect(() => {
    const p = found?.provider as { on?: (e: string, f: (a: string[]) => void) => void; removeListener?: (e: string, f: (a: string[]) => void) => void } | undefined
    if (!p?.on) return
    const onAccounts = (a: string[]) => { if (a[0]) setAccount(a[0] as Address); else disconnect() }
    p.on('accountsChanged', onAccounts)
    return () => p.removeListener?.('accountsChanged', onAccounts)
  }, [found, disconnect])

  // which real Chogs this account holds (read-only, on mainnet)
  useEffect(() => {
    if (!account) { setHeld(null); return }
    let live = true
    setHeld(null)
    readHeld(reader, REAL_CHOG as Address, account).then(ids => { if (live) setHeld(ids) }, () => { if (live) setHeld([]) })
    return () => { live = false }
  }, [account])

  const value = useMemo(() => ({ wallets, found, account, held, busy, error, connect, disconnect, menuOpen, setMenuOpen, last }), [wallets, found, account, held, busy, error, connect, disconnect, menuOpen, last])
  return <Wallet.Provider value={value}>{children}</Wallet.Provider>
}

export function useWalletCtx(): Ctx {
  const c = useContext(Wallet)
  if (!c) throw new Error('useWalletCtx needs a WalletProvider')
  return c
}
