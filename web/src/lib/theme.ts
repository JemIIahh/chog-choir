import { useSyncExternalStore } from 'react'

// Two modes, one app: dark (a quiet room lit by the Chogs) and light (white, washed with pale vowel colours).
// The mode is a set of CSS tokens (styles.css) plus surface rules scoped by html[data-theme] (src/themes/*.css).
export type Theme = 'dark' | 'light'

const KEY = 'chogchoir:theme'
const EVENT = 'chogchoir:theme'
const valid = (v: unknown): v is Theme => v === 'dark' || v === 'light'
const BAR = { dark: '#15110f', light: '#fdfbf8' } // browser chrome colour

const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem(KEY)
    return valid(v) ? v : null
  } catch {
    return null // private mode: no memory, still fine
  }
}
const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t])
}

/** Before the first paint: ?theme=light wins, then the visitor's last choice, then their system setting, then dark. */
export function initTheme() {
  const q = new URLSearchParams(location.search).get('theme')
  apply(valid(q) ? q : stored() ?? system())
  // with no choice made yet, follow the system as it changes
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!stored() && !valid(q)) { apply(system()); window.dispatchEvent(new Event(EVENT)) }
  })
}

export function setTheme(t: Theme) {
  apply(t)
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT))
}

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}
export const useTheme = (): Theme => useSyncExternalStore(subscribe, currentTheme)

/** A CSS token's current value, for canvas drawing. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
