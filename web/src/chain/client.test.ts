import { describe, expect, it } from 'vitest'
import { BaseError, ContractFunctionRevertedError, encodeErrorResult } from 'viem'
import { choirAbi } from './abi'
import { explain, unpack } from './client'

const revert = (errorName: 'NotYourChog' | 'AlreadySang' | 'BurnFailed' | 'BadBatch') =>
  new ContractFunctionRevertedError({ abi: choirAbi, data: encodeErrorResult({ abi: choirAbi, errorName }), functionName: 'place' })

describe('explain', () => {
  it('turns every contract error into a sentence a person can act on', () => {
    expect(explain(revert('NotYourChog'))).toMatch(/isn't in your wallet/)
    expect(explain(revert('AlreadySang'))).toMatch(/already sang this round/)
    expect(explain(revert('BurnFailed'))).toMatch(/balance and approval/)
    expect(explain(revert('BadBatch'))).toMatch(/batch/)
  })

  it('says cancelled when the person said no in their wallet', () => {
    const e = new BaseError('User rejected the request.', { cause: Object.assign(new Error('x'), { code: 4001 }) })
    expect(explain(e)).toBe('Cancelled in your wallet.')
  })

  it('points to a faucet only on testnet when there is no gas', () => {
    const e = new BaseError('insufficient funds for gas', { details: 'insufficient funds' })
    Object.defineProperty(e, 'shortMessage', { value: 'insufficient funds for gas' })
    expect(explain(e, { testnet: true })).toMatch(/faucet/)
    expect(explain(e, { testnet: false })).not.toMatch(/faucet/)
    expect(explain(e, { testnet: false })).toMatch(/MON/)
  })

  it('never throws on something that is not an error', () => {
    expect(explain(undefined)).toBe('Something went wrong.')
    expect(explain('boom')).toBe('Something went wrong.')
    expect(explain(new Error('plain'))).toBe('plain')
  })
})

describe('unpack', () => {
  it('reads a note the way the contract packs it (tokenId << 16 | step << 8 | pitch)', () => {
    expect(unpack((1969 << 16) | (15 << 8) | 11)).toEqual({ id: 1969, step: 15, pitch: 11 })
    expect(unpack((1 << 16) | (0 << 8) | 0)).toEqual({ id: 1, step: 0, pitch: 0 })
    // the largest token id still fits in the top 16 bits of a uint32
    expect(unpack(((65535 << 16) | 0) >>> 0).id).toBe(65535)
  })
})
