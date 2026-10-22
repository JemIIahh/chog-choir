import { describe, expect, it } from 'vitest'
import { cleanAppId, mayHandOver, planFor } from './privy'

describe('cleanAppId', () => {
  it('accepts a Privy app id and trims it', () => {
    expect(cleanAppId('cm1abcdefghijklmnopqrstuv')).toBe('cm1abcdefghijklmnopqrstuv')
    expect(cleanAppId('  cm1abcdefghijklmnopqrstuv\n')).toBe('cm1abcdefghijklmnopqrstuv')
  })
  it('turns the feature off for anything that is not an id', () => {
    for (const bad of [undefined, null, '', '   ', 'invalid', 'your-app-id-here', 'has spaces in it xxxxxxxx', 'x'.repeat(80), 123, {}]) expect(cleanAppId(bad)).toBeNull()
  })
})

describe('planFor: what to do when Privy is ready', () => {
  it('a visitor who asks to sign in always gets a fresh sign-in, even if an old session is still there', () => {
    expect(planFor('login', false)).toBe('login')
    expect(planFor('login', true)).toBe('relogin') // end the old session first
  })
  it('after a reload the last session is resumed only if there still is one', () => {
    expect(planFor('restore', true)).toBe('resume')
    expect(planFor('restore', false)).toBe('gone')
  })
})

describe('mayHandOver: when a wallet may be given to the app', () => {
  it('never hands over an old session just because someone clicked "Email or Google"', () => {
    expect(mayHandOver('login', false)).toBe(false) // an old session is present but nobody has signed in yet
    expect(mayHandOver('login', true)).toBe(true)
  })
  it('resumes without a new sign-in only after a reload', () => {
    expect(mayHandOver('restore', false)).toBe(true)
  })
})
