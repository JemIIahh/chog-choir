import type { Address } from 'viem'
import type { Found } from './wallet'

/**
 * Optional sign-in with email or Google through Privy: an embedded wallet for people who have no crypto wallet.
 * It is off unless VITE_PRIVY_APP_ID is set at build time, and its code only downloads when someone chooses it.
 */
export const cleanAppId = (raw: unknown): string | null => {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return /^[a-z0-9]{20,40}$/i.test(v) ? v : null // Privy app ids are 25 letters and digits
}

export const PRIVY_APP_ID = cleanAppId(import.meta.env.VITE_PRIVY_APP_ID)
export const privyEnabled = PRIVY_APP_ID !== null

/** how the embedded wallet is told apart from browser wallets (stored as "the wallet used last time") */
export const PRIVY_ID = 'io.privy'

export type PrivyFound = Found & { address: Address }

/** a small envelope on the page's own colours, used as the wallet icon */
export const PRIVY_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="10" fill="#ff7a3d"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="11" width="20" height="14" rx="3"/><path d="M9 13l9 6.5L27 13"/></g></svg>')

export const privyMessages = {
  unavailable: 'Email sign-in is not available right now. You can still use a wallet.',
  offline: 'Could not reach the sign-in service. Check your connection and try again.',
  noWallet: 'Signed in, but the wallet could not be created. Try again.',
  failed: 'Could not sign in. Try again.',
} as const

/**
 * What to do once Privy is ready.
 *  - login: the visitor asked to sign in. If a session is already there (someone else's, or an old one) it is ended first,
 *    so choosing "Email or Google" always means a fresh sign-in and never hands over a wallet nobody just signed in to.
 *  - restore: the page reloaded and the visitor never disconnected; the session they had may be resumed.
 */
export type Plan = 'login' | 'relogin' | 'resume' | 'gone'
export const planFor = (mode: 'login' | 'restore', authenticated: boolean): Plan =>
  mode === 'login' ? (authenticated ? 'relogin' : 'login') : authenticated ? 'resume' : 'gone'

/** A wallet is handed to the app only for a session the visitor just signed in to, or one they are resuming after a reload. */
export const mayHandOver = (mode: 'login' | 'restore', signedInJustNow: boolean): boolean => mode === 'restore' || signedInJustNow
