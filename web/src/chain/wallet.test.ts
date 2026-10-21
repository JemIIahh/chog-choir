import { describe, expect, it } from 'vitest'
import type { EIP1193Provider } from 'viem'
import { monadMainnet, monadTestnet } from './config'
import { ensureChain, sharedAccount } from './wallet'

type Call = { method: string; params?: unknown }
const fake = (opts: { chainId: number; switchError?: { code: number }; accounts?: string[] }) => {
  const calls: Call[] = []
  let chainId = opts.chainId
  const provider = {
    request: async ({ method, params }: Call) => {
      calls.push({ method, params })
      if (method === 'eth_chainId') return '0x' + chainId.toString(16)
      if (method === 'wallet_switchEthereumChain') {
        if (opts.switchError) throw Object.assign(new Error('unknown chain'), opts.switchError)
        chainId = Number((params as [{ chainId: string }])[0].chainId)
        return null
      }
      if (method === 'wallet_addEthereumChain') { chainId = Number((params as [{ chainId: string }])[0].chainId); return null }
      if (method === 'eth_accounts') return opts.accounts ?? []
      throw new Error('unexpected ' + method)
    },
  } as unknown as EIP1193Provider
  return { provider, calls }
}

describe('ensureChain', () => {
  it('does nothing when the wallet is already on the right network', async () => {
    const { provider, calls } = fake({ chainId: 10143 })
    await ensureChain(provider, monadTestnet)
    expect(calls.map(c => c.method)).toEqual(['eth_chainId'])
  })

  it('asks the wallet to switch when it is on another network', async () => {
    const { provider, calls } = fake({ chainId: 1 })
    await ensureChain(provider, monadMainnet)
    expect(calls.map(c => c.method)).toEqual(['eth_chainId', 'wallet_switchEthereumChain'])
    expect(calls[1].params).toEqual([{ chainId: '0x8f' }])
  })

  it('adds the network when the wallet has never heard of it, with every RPC, the explorer and the symbol', async () => {
    for (const code of [4902, -32603]) {
      const { provider, calls } = fake({ chainId: 1, switchError: { code } })
      await ensureChain(provider, monadTestnet)
      const add = calls.find(c => c.method === 'wallet_addEthereumChain')!
      const p = (add.params as [Record<string, unknown>])[0]
      expect(p.chainId).toBe('0x279f')
      expect((p.rpcUrls as string[]).length).toBeGreaterThanOrEqual(2)
      expect((p.nativeCurrency as { symbol: string }).symbol).toBe('MON')
      expect(p.blockExplorerUrls).toBeTruthy()
    }
  })

  it('passes a refusal through instead of swallowing it', async () => {
    const { provider } = fake({ chainId: 1, switchError: { code: 4001 } }) // the user said no
    await expect(ensureChain(provider, monadMainnet)).rejects.toMatchObject({ code: 4001 })
  })
})

describe('sharedAccount', () => {
  it('returns the account a site was already given, or null, and never throws', async () => {
    const w = (provider: EIP1193Provider) => ({ name: 'Test wallet', provider })
    expect(await sharedAccount(w(fake({ chainId: 1, accounts: ['0xabc'] }).provider))).toBe('0xabc')
    expect(await sharedAccount(w(fake({ chainId: 1, accounts: [] }).provider))).toBeNull()
    expect(await sharedAccount(w({ request: async () => { throw new Error('locked') } } as unknown as EIP1193Provider))).toBeNull()
  })
})
