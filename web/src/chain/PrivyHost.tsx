import { PrivyProvider, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useRef } from 'react'
import type { Address } from 'viem'
import { monadMainnet, monadTestnet } from './config'
import { PRIVY_ICON, PRIVY_ID, privyMessages, type PrivyFound } from './privy'
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
        loginMethods: ['email', 'google'],
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
  const { ready, authenticated, logout } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const started = useRef(false)
  const delivered = useRef<string | null>(null)
  const { login } = useLogin({ onError: err => onGone(String(err) === 'exited_auth_flow' ? undefined : privyMessages.failed) })

  useEffect(() => { registerLogout(async () => { await logout() }) }, [logout, registerLogout])

  // the sign-in service never came up
  useEffect(() => {
    if (ready) return
    const t = window.setTimeout(() => onGone(privyMessages.offline), INIT_MS)
    return () => window.clearTimeout(t)
  }, [ready, onGone])

  // ready: either ask them to sign in, or learn that the last session is gone
  useEffect(() => {
    if (!ready || authenticated) return
    if (mode === 'login') { if (!started.current) { started.current = true; login() } } else onGone()
  }, [ready, authenticated, mode, login, onGone])

  // signed in: wait for the embedded wallet, then give its provider to the app
  const embedded = wallets.find(w => w.walletClientType === 'privy')
  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || embedded) return
    const t = window.setTimeout(() => onGone(privyMessages.noWallet), WALLET_MS)
    return () => window.clearTimeout(t)
  }, [ready, authenticated, walletsReady, embedded, onGone])

  useEffect(() => {
    if (!embedded || delivered.current === embedded.address) return
    delivered.current = embedded.address
    embedded.getEthereumProvider().then(
      // Privy's provider is a standard EIP-1193 provider; its type is just spelled differently from viem's
      provider => onWallet({ name: 'Email wallet', rdns: PRIVY_ID, icon: PRIVY_ICON, provider: provider as unknown as Found['provider'], address: embedded.address as Address }),
      () => onGone(privyMessages.noWallet),
    )
  }, [embedded, onWallet, onGone])

  return null
}
