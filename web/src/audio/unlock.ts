// What it takes to make Web Audio audible and dependable on a phone.
//
//  - iPhones mute Web Audio while the ringer switch is on silent, unless the page says it is playing media. Safari 17 has an API for that
//    (navigator.audioSession); older iOS only lets the sound through while a media element is playing, so a silent looping one is played.
//  - Phones only let audio start from a tap, and the engine is also asked to start from places that are not a tap (after a page change, after a
//    short delay), so the first touch anywhere unlocks the sound for the rest of the visit.

type Session = { type: string }
type Nav = { audioSession?: Session; userAgent?: string; platform?: string; maxTouchPoints?: number }

/** an iPhone or iPad (an iPad can say it is a Mac) */
export function isIOS(nav: Nav = navigator): boolean {
  return /iP(hone|ad|od)/.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
}

/** true when this browser has the audio-session API (Safari 17 and later) */
export const hasAudioSession = (nav: Nav = navigator): boolean => !!nav.audioSession

/** Tell the phone this page is playing sound, so the silent switch does not mute it. Returns whether the browser has the API. */
export function claimPlayback(nav: Nav = navigator): boolean {
  return setSession('playback', nav)
}

/** While the microphone is in use the session has to allow recording; give it back to playback afterwards. */
export function setSession(type: 'playback' | 'play-and-record', nav: Nav = navigator): boolean {
  try {
    const s = nav.audioSession
    if (!s) return false
    if (s.type !== type) s.type = type
    return true
  } catch {
    return false
  }
}

/** 0.1 s of silence as a WAV file (8 kHz, 8-bit, mono; 8-bit silence is the value 128) */
export function silentWav(): Uint8Array<ArrayBuffer> {
  const rate = 8000, n = 800
  const out = new Uint8Array(new ArrayBuffer(44 + n))
  const v = new DataView(out.buffer)
  const tag = (at: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(at + i, t.charCodeAt(i)) }
  tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE')
  tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  tag(36, 'data'); v.setUint32(40, n, true)
  out.fill(128, 44)
  return out
}

/** older iOS: a page that is playing a media element is "playing media", and the silent switch stops muting its Web Audio */
export const needsMediaHold = (nav: Nav = navigator): boolean => isIOS(nav) && !hasAudioSession(nav)

let hold: HTMLAudioElement | null = null
export function holdMedia(on: boolean): void {
  if (typeof Audio === 'undefined') return
  if (!on) { hold?.pause(); return }
  if (!hold) {
    hold = new Audio(URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' })))
    hold.loop = true
    hold.preload = 'auto'
    hold.setAttribute('playsinline', '')
  }
  void hold.play().catch(() => { /* if the phone refuses this, it is the same as not having the trick */ })
}

type ACtor = typeof AudioContext
/** an AudioContext on every phone that has one (iOS before 14.5 only has the prefixed one, which takes no options) */
export function newAudioContext(options?: AudioContextOptions): AudioContext {
  const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor }
  if (w.AudioContext) return new w.AudioContext(options)
  if (w.webkitAudioContext) return new w.webkitAudioContext()
  throw new Error('This browser has no Web Audio, so it cannot play sound.')
}
