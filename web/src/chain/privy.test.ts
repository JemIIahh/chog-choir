import { describe, expect, it } from 'vitest'
import { cleanAppId } from './privy'

describe('cleanAppId', () => {
  it('accepts a Privy app id and trims it', () => {
    expect(cleanAppId('cm1abcdefghijklmnopqrstuv')).toBe('cm1abcdefghijklmnopqrstuv')
    expect(cleanAppId('  cm1abcdefghijklmnopqrstuv\n')).toBe('cm1abcdefghijklmnopqrstuv')
  })
  it('turns the feature off for anything that is not an id', () => {
    for (const bad of [undefined, null, '', '   ', 'invalid', 'your-app-id-here', 'has spaces in it xxxxxxxx', 'x'.repeat(80), 123, {}]) expect(cleanAppId(bad)).toBeNull()
  })
})
