import { describe, expect, it } from 'vitest'
import { claimPlayback, hasAudioSession, isIOS, needsMediaHold, setSession, silentWav } from './unlock'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

describe('telling phones apart', () => {
  it('knows an iPhone, an iPad that says it is a Mac, and not a Mac or an Android phone', () => {
    expect(isIOS({ userAgent: IPHONE })).toBe(true)
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
    expect(isIOS({ userAgent: ANDROID })).toBe(false)
  })
  it('only an iPhone without the audio-session API needs the silent-media trick', () => {
    expect(needsMediaHold({ userAgent: IPHONE })).toBe(true)
    expect(needsMediaHold({ userAgent: IPHONE, audioSession: { type: 'auto' } })).toBe(false)
    expect(needsMediaHold({ userAgent: ANDROID })).toBe(false)
    expect(hasAudioSession({ audioSession: { type: 'auto' } })).toBe(true)
    expect(hasAudioSession({})).toBe(false)
  })
})

describe('the audio session', () => {
  it('asks for playback, so the silent switch does not mute the sound', () => {
    const nav = { audioSession: { type: 'auto' } }
    expect(claimPlayback(nav)).toBe(true)
    expect(nav.audioSession.type).toBe('playback')
  })
  it('lets the microphone record, and takes playback back afterwards', () => {
    const nav = { audioSession: { type: 'playback' } }
    expect(setSession('play-and-record', nav)).toBe(true)
    expect(nav.audioSession.type).toBe('play-and-record')
    expect(setSession('playback', nav)).toBe(true)
    expect(nav.audioSession.type).toBe('playback')
  })
  it('does nothing, without complaining, where the API does not exist or refuses', () => {
    expect(claimPlayback({})).toBe(false)
    const refusing = { audioSession: Object.defineProperty({}, 'type', { get: () => 'auto', set: () => { throw new Error('no') } }) as { type: string } }
    expect(claimPlayback(refusing)).toBe(false)
  })
})

describe('the silent WAV', () => {
  const w = silentWav(), v = new DataView(w.buffer)
  const text = (at: number, n: number) => String.fromCharCode(...w.slice(at, at + n))
  it('is a well-formed 8 kHz, 8-bit, mono PCM file', () => {
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(1) // mono
    expect(v.getUint32(24, true)).toBe(8000)
    expect(v.getUint16(34, true)).toBe(8)
    expect(text(36, 4)).toBe('data')
    expect(v.getUint32(4, true)).toBe(w.length - 8)
    expect(v.getUint32(40, true)).toBe(w.length - 44)
  })
  it('is silence: every sample is the 8-bit zero level', () => {
    expect(new Set(w.slice(44))).toEqual(new Set([128]))
  })
})
