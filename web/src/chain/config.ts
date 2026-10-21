import { defineChain, type Address, type Chain } from 'viem'
import deployments from './deployments.json'

export const REAL_CHOG: Address = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
export const MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadexplorer.com' } },
  contracts: { multicall3: { address: MULTICALL3 } },
})

export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://monadvision.com' } },
  contracts: { multicall3: { address: MULTICALL3 } },
})

/** token is the $CHOG that encores burn (0x0 = encores off); encorePrice is in its smallest unit */
export type Deployment = { choir: Address; nft: Address; token: Address; encorePrice: string; epochSeconds: number; faucet?: boolean }

export type Target = { chain: Chain; deployment: Deployment | null }
export type Net = 'main' | 'test'

/**
 * Where the Choir lives. `main` is Monad mainnet with the real Chog Genesis collection; `test` is Monad testnet with
 * free replica Chogs, so anyone can try it. Both read from the committed deployments.json.
 * In dev, ?chain=31337&rpc=...&choir=0x..&nft=0x.. points `test` at a local chain for tests.
 */
export function resolveTargets(): Record<Net, Target> {
  const all = deployments as Record<string, Deployment | null>
  const out: Record<Net, Target> = {
    main: { chain: monadMainnet, deployment: all['143'] ?? null },
    test: { chain: monadTestnet, deployment: all['10143'] ?? null },
  }
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search)
    const rpc = q.get('rpc')
    const choir = q.get('choir')
    const nft = q.get('nft')
    if (rpc && choir && nft) {
      const id = Number(q.get('chain') ?? 31337)
      const chain = defineChain({
        id,
        name: 'Local',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
        contracts: { multicall3: { address: MULTICALL3 } },
      })
      const token = (q.get('token') ?? '0x0000000000000000000000000000000000000000') as Address
      out.test = { chain, deployment: { choir: choir as Address, nft: nft as Address, token, encorePrice: q.get('price') ?? '1000000000000000000000', epochSeconds: Number(q.get('epoch') ?? 3600), faucet: true } }
      out.main = { chain: monadMainnet, deployment: null }
    }
  }
  return out
}

export const defaultNet = (t: Record<Net, Target>): Net => (t.main.deployment ? 'main' : 'test')
