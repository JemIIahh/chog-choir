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

export type Deployment = { choir: Address; nft: Address; epochSeconds: number }

export type Target = { chain: Chain; deployment: Deployment | null }

/**
 * Where Today's Choir lives. Production points at the committed Monad testnet deployment.
 * In dev, ?chain=31337&rpc=...&choir=0x..&nft=0x.. points the same UI at a local chain for tests.
 */
export function resolveTarget(): Target {
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
      return { chain, deployment: { choir: choir as Address, nft: nft as Address, epochSeconds: Number(q.get('epoch') ?? 3600) } }
    }
  }
  const d = (deployments as Record<string, Deployment | null>)['10143']
  return { chain: monadTestnet, deployment: d }
}
