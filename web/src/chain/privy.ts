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

/** Which sign-in methods to offer. Only methods that are also switched on in the Privy dashboard work, so the default is email alone. */
export type Method = 'email' | 'google'
export const parseMethods = (raw: unknown): Method[] => {
  const asked = typeof raw === 'string' ? raw.split(',').map(x => x.trim().toLowerCase()) : []
  const ok = (['email', 'google'] as const).filter(m => asked.includes(m))
  return ok.length ? ok : ['email']
}

export const PRIVY_APP_ID = cleanAppId(import.meta.env.VITE_PRIVY_APP_ID)
export const PRIVY_METHODS = parseMethods(import.meta.env.VITE_PRIVY_METHODS)
export const privyLabel = PRIVY_METHODS.includes('google') ? 'Email or Google' : 'Sign in with email'
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
export type Mode = 'login' | 'restore' | 'oauth'
export type Plan = 'login' | 'relogin' | 'resume' | 'gone' | 'await'
export const planFor = (mode: Mode, authenticated: boolean): Plan =>
  mode === 'oauth' ? 'await' : mode === 'login' ? (authenticated ? 'relogin' : 'login') : authenticated ? 'resume' : 'gone'

/** A wallet is handed to the app only for a session the visitor just signed in to, or one they are resuming after a reload. */
export const mayHandOver = (mode: Mode, signedInJustNow: boolean): boolean => mode === 'restore' || signedInJustNow

/**
 * Privy calls `onComplete` for a finished sign-in, but ALSO straight away, with `wasAlreadyAuthenticated: true`, when a session
 * already exists. Only a sign-in this page started itself, on a browser that was not signed in, counts as "just signed in".
 */
export const isFreshSignIn = (done: { wasAlreadyAuthenticated: boolean }, weStartedIt: boolean): boolean => weStartedIt && !done.wasAlreadyAuthenticated

/**
 * Is this embedded wallet one of the signed-in user's own? The wallet list can lag behind a sign-out and sign-in for a moment
 * and still show the previous person's wallet, so a wallet is handed over only if the current user's accounts include it.
 */
export const ownsEmbedded = (user: { linkedAccounts?: ReadonlyArray<{ type: string; address?: string; walletClientType?: string }> } | null | undefined, address: string): boolean =>
  !!user?.linkedAccounts?.some(a => a.type === 'wallet' && a.walletClientType === 'privy' && a.address?.toLowerCase() === address.toLowerCase())

// ── coming back from Google
// Google sign-in leaves the page and returns with ?privy_oauth_code=…&privy_oauth_state=… in the address, and the Privy SDK
// completes the sign-in only if it is running when the page loads. So a tab that started a sign-in remembers that (for ten minutes),
// and the Privy host is started again on the way back. A link with those parameters but no remembered start does nothing.
export const OAUTH_FLAG = 'chogchoir:privy-oauth' // sessionStorage: when this tab started a sign-in
export const RETURN_KEY = 'chogchoir:privy-return' // sessionStorage: the page to go back to afterwards
export const OAUTH_MAX_AGE_MS = 10 * 60 * 1000

export const isOAuthReturn = (search: string): boolean => {
  const q = new URLSearchParams(search)
  return q.has('privy_oauth_code') && q.has('privy_oauth_state')
}

/** `startedAt` is what sessionStorage held (a timestamp as text) */
export const startedRecently = (startedAt: string | null, now: number): boolean => {
  const t = Number(startedAt)
  return Number.isFinite(t) && t > 0 && now - t >= 0 && now - t <= OAUTH_MAX_AGE_MS
}

export const rememberStart = (): void => {
  try { sessionStorage.setItem(OAUTH_FLAG, String(Date.now())); sessionStorage.setItem(RETURN_KEY, location.hash) } catch { /* private mode: Google sign-in may not come back */ }
}
export const forgetStart = (): void => { try { sessionStorage.removeItem(OAUTH_FLAG) } catch { /* ignore */ } }
export const takeReturnHash = (): string | null => {
  try { const h = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); return h } catch { return null }
}

/** What to start with when the page loads: finish a Google sign-in, quietly resume last time's session, or nothing. */
export const initialMode = (lastWallet: string | null): Mode | null => {
  if (!privyEnabled) return null
  let started: string | null = null
  try { started = sessionStorage.getItem(OAUTH_FLAG) } catch { /* ignore */ }
  if (isOAuthReturn(location.search) && startedRecently(started, Date.now())) return 'oauth'
  return lastWallet === PRIVY_ID ? 'restore' : null
}
