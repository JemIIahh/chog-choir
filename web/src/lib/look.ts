import { useSyncExternalStore } from 'react'

// The look of the app is a set of CSS tokens (see styles.css) plus surface rules scoped by html[data-look].
export const LOOKS = [
  { id: 'stage', name: 'Stage' },
  { id: 'poster', name: 'Poster' },
  { id: 'sorbet', name: 'Sorbet' },
] as const
export type Look = (typeof LOOKS)[number]['id']

const KEY = 'chogchoir:look'
const EVENT = 'chogchoir:look'
const valid = (v: unknown): v is Look => LOOKS.some(l => l.id === v)

/** Before the first paint: ?look=poster wins, then the last one chosen, then Stage. */
export function initLook() {
  let l: Look = 'stage'
  const q = new URLSearchParams(location.search).get('look')
  try {
    const kept = localStorage.getItem(KEY)
    if (valid(kept)) l = kept
  } catch { /* private mode: no memory, still fine */ }
  if (valid(q)) l = q
  document.documentElement.dataset.look = l
}

export function setLook(l: Look) {
  document.documentElement.dataset.look = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}
export const useLook = (): Look => useSyncExternalStore(subscribe, () => (document.documentElement.dataset.look as Look) ?? 'stage')

/** A CSS token's current value, for canvas drawing. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
