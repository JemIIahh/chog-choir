import { describe, expect, it } from 'vitest'
import { pickNet } from './config'

describe('pickNet: where a visitor lands', () => {
  const both = { main: true, test: true }
  it('lands on the free testnet copy by default, even when mainnet is deployed', () => {
    expect(pickNet(both, null, null)).toBe('test')
  })
  it('a link that names a network wins, then the last choice', () => {
    expect(pickNet(both, 'main', 'test')).toBe('main')
    expect(pickNet(both, null, 'main')).toBe('main')
    expect(pickNet(both, 'test', 'main')).toBe('test')
  })
  it('never lands somewhere that is not deployed', () => {
    expect(pickNet({ main: false, test: true }, 'main', 'main')).toBe('test')
    expect(pickNet({ main: true, test: false }, null, null)).toBe('main')
    expect(pickNet({ main: true, test: false }, 'test', 'test')).toBe('main')
  })
  it('ignores junk in the link or in storage', () => {
    expect(pickNet(both, 'mainnet', '<script>')).toBe('test')
    expect(pickNet(both, '', '')).toBe('test')
  })
})
