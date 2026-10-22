import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { explain, makeReader, readHeld } from './client'
import { monadMainnet, REAL_CHOG } from './config'
import { PrivyGate } from './PrivyGate'
import { PRIVY_APP_ID, PRIVY_ID, privyEnabled, type PrivyFound } from './privy'
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
  /** sign in with email or Google (Privy). Resolves true once the embedded wallet is connected. Absent unless configured. */
  privy: { enabled: boolean; start(): Promise<boolean> }
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
  // Privy: null = not in use, 'login' = the visitor asked to sign in, 'restore' = quietly resume last time's session
  const [privy, setPrivy] = useState<'login' | 'restore' | null>(() => (privyEnabled && last === PRIVY_ID ? 'restore' : null))
  const logoutRef = useRef<(() => Promise<void>) | null>(null)
  const waiting = useRef<((ok: boolean) => void) | null>(null)

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
    setPrivy(null) // a browser wallet replaces any email wallet (its session stays, so it can be resumed later)
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
    if (found?.rdns === PRIVY_ID) void logoutRef.current?.().catch(() => undefined)
    setPrivy(null)
    setFound(null); setAccount(null); setHeld(null); setError(null)
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [found])

  // ── email or Google (Privy)
  const startPrivy = useCallback(() => new Promise<boolean>(resolve => {
    waiting.current?.(false)
    waiting.current = resolve
    setError(null)
    setBusy(true)
    setPrivy('login')
  }), [])
  const onPrivyWallet = useCallback((w: PrivyFound) => {
    setFound(w); setAccount(w.address)
    try { localStorage.setItem(KEY, PRIVY_ID) } catch { /* ignore */ }
    setBusy(false)
    waiting.current?.(true); waiting.current = null
  }, [])
  const onPrivyGone = useCallback((message?: string) => {
    setPrivy(null)
    setBusy(false)
    if (message) setError(message)
    setFound(f => (f?.rdns === PRIVY_ID ? null : f)); setAccount(a => (found?.rdns === PRIVY_ID ? null : a))
    waiting.current?.(false); waiting.current = null
  }, [found])
  const registerLogout = useCallback((fn: () => Promise<void>) => { logoutRef.current = fn }, [])

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

  const privyApi = useMemo(() => ({ enabled: privyEnabled, start: startPrivy }), [startPrivy])
  const value = useMemo(() => ({ wallets, found, account, held, busy, error, connect, disconnect, menuOpen, setMenuOpen, last, privy: privyApi }), [wallets, found, account, held, busy, error, connect, disconnect, menuOpen, last, privyApi])
  return (
    <Wallet.Provider value={value}>
      {children}
      {PRIVY_APP_ID && privy && <PrivyGate appId={PRIVY_APP_ID} mode={privy} onWallet={onPrivyWallet} onGone={onPrivyGone} registerLogout={registerLogout} />}
    </Wallet.Provider>
  )
}

export function useWalletCtx(): Ctx {
  const c = useContext(Wallet)
  if (!c) throw new Error('useWalletCtx needs a WalletProvider')
  return c
}
