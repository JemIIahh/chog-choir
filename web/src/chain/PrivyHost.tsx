import { PrivyProvider, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { monadMainnet, monadTestnet } from './config'
import { isFreshSignIn, mayHandOver, ownsEmbedded, planFor, PRIVY_ICON, PRIVY_ID, PRIVY_METHODS, privyMessages, type PrivyFound } from './privy'
import type { Found } from './wallet'

export type HostProps = {
  appId: string
  /** login: the visitor asked to sign in. restore: the page reloaded and the last session may still be good. */
  mode: 'login' | 'restore'
  onWallet(w: PrivyFound): void
  /** the flow ended without a wallet; `message` is for the visitor, absent when they simply closed the sign-in window */
  onGone(message?: string): void
  registerLogout(fn: () => Promise<void>): void
}

const INIT_MS = 20_000
const WALLET_MS = 20_000

/** Loaded only when someone picks email or Google. Hands the embedded wallet's provider to the app's own wallet layer. */
export default function PrivyHost(props: HostProps) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <PrivyProvider
      appId={props.appId}
      config={{
        loginMethods: PRIVY_METHODS,
        appearance: { theme: dark ? 'dark' : 'light', accentColor: '#ff7a3d', landingHeader: 'Sing with Chog Choir', loginMessage: 'No crypto wallet needed.', showWalletLoginFirst: false },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        supportedChains: [monadTestnet, monadMainnet],
        defaultChain: monadTestnet,
      }}
    >
      <Bridge {...props} />
    </PrivyProvider>
  )
}

function Bridge({ mode, onWallet, onGone, registerLogout }: HostProps) {
  const { ready, authenticated, logout, user } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const started = useRef(false)
  const delivered = useRef<string | null>(null)
  const [signedInJustNow, setSignedInJustNow] = useState(false)
  const loginStarted = useRef(false) // true only once THIS page has called login(), after any old session was ended
  const { login } = useLogin({
    onComplete: done => { if (isFreshSignIn(done, loginStarted.current)) setSignedInJustNow(true) },
    onError: err => onGone(String(err) === 'exited_auth_flow' ? undefined : privyMessages.failed),
  })

  useEffect(() => { registerLogout(async () => { await logout() }) }, [logout, registerLogout])

  // the sign-in service never came up
  useEffect(() => {
    if (ready) return
    const t = window.setTimeout(() => onGone(privyMessages.offline), INIT_MS)
    return () => window.clearTimeout(t)
  }, [ready, onGone])

  // ready: sign in afresh, resume the last session, or learn that it is gone
  useEffect(() => {
    if (!ready || started.current) return
    const plan = planFor(mode, authenticated)
    if (plan === 'gone') { onGone(); return }
    started.current = true
    const start = () => { loginStarted.current = true; login() }
    if (plan === 'relogin') void logout().then(start, () => onGone(privyMessages.failed)) // end the old session first, then sign in afresh
    else if (plan === 'login') start()
  }, [ready, authenticated, mode, login, logout, onGone])

  // signed in: wait for the embedded wallet, then give its provider to the app
  // the embedded wallet that belongs to whoever is signed in now (never a stale entry from an earlier session)
  const embedded = wallets.find(w => w.walletClientType === 'privy' && ownsEmbedded(user, w.address))
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || embedded || !mayHandOver(mode, signedInJustNow)) return
    const t = window.setTimeout(() => onGone(privyMessages.noWallet), WALLET_MS)
    return () => window.clearTimeout(t)
  }, [ready, authenticated, walletsReady, embedded, mode, signedInJustNow, onGone])

  useEffect(() => {
    if (!embedded || !authenticated || !mayHandOver(mode, signedInJustNow) || delivered.current === embedded.address) return
    delivered.current = embedded.address
    embedded.getEthereumProvider().then(
      // Privy's provider is a standard EIP-1193 provider; its type is just spelled differently from viem's
      provider => onWallet({ name: 'Email wallet', rdns: PRIVY_ID, icon: PRIVY_ICON, provider: provider as unknown as Found['provider'], address: embedded.address as Address }),
      () => onGone(privyMessages.noWallet),
    )
  }, [embedded, authenticated, mode, signedInJustNow, onWallet, onGone])

  return null
}
