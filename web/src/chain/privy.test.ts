import { describe, expect, it } from 'vitest'
import { cleanAppId, isFreshSignIn, mayHandOver, ownsEmbedded, parseMethods, planFor } from './privy'

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

describe('isFreshSignIn: which Privy "sign-in complete" events count', () => {
  it('ignores the event Privy fires at once for a session that was already there', () => {
    expect(isFreshSignIn({ wasAlreadyAuthenticated: true }, false)).toBe(false)
    expect(isFreshSignIn({ wasAlreadyAuthenticated: true }, true)).toBe(false)
  })
  it('ignores a sign-in this page did not start', () => {
    expect(isFreshSignIn({ wasAlreadyAuthenticated: false }, false)).toBe(false)
  })
  it('counts a sign-in this page started on a browser that was not signed in', () => {
    expect(isFreshSignIn({ wasAlreadyAuthenticated: false }, true)).toBe(true)
  })
})

describe('ownsEmbedded: only the signed-in user\'s own wallet is handed over', () => {
  const user = { linkedAccounts: [{ type: 'email', address: 'a@b.c' }, { type: 'wallet', walletClientType: 'privy', address: '0xAbC0000000000000000000000000000000000001' }, { type: 'wallet', walletClientType: 'metamask', address: '0xdef0000000000000000000000000000000000002' }] }
  it('accepts the user\'s embedded wallet, whatever the letter case', () => {
    expect(ownsEmbedded(user, '0xabc0000000000000000000000000000000000001')).toBe(true)
  })
  it('refuses a wallet that is not the user\'s: another person\'s stale entry, or an external wallet', () => {
    expect(ownsEmbedded(user, '0x1110000000000000000000000000000000000009')).toBe(false)
    expect(ownsEmbedded(user, '0xdef0000000000000000000000000000000000002')).toBe(false)
  })
  it('refuses everything when nobody is signed in', () => {
    expect(ownsEmbedded(null, '0xabc')).toBe(false)
    expect(ownsEmbedded(undefined, '0xabc')).toBe(false)
    expect(ownsEmbedded({}, '0xabc')).toBe(false)
  })
})

describe('parseMethods: which sign-in methods to offer', () => {
  it('is email alone by default, because only methods switched on in the Privy dashboard work', () => {
    for (const none of [undefined, '', '  ', 'sms', 'wallet', 7, null]) expect(parseMethods(none)).toEqual(['email'])
  })
  it('adds Google only when asked for it', () => {
    expect(parseMethods('email,google')).toEqual(['email', 'google'])
    expect(parseMethods(' Google , EMAIL ')).toEqual(['email', 'google'])
    expect(parseMethods('google')).toEqual(['google'])
  })
  it('ignores anything it does not know, so a typo cannot ask Privy for a method that is not set up', () => {
    expect(parseMethods('email,twitter,wallet,google,google')).toEqual(['email', 'google'])
  })
})
