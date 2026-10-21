import { createWalletClient, custom, type Address, type Chain, type EIP1193Provider, type WalletClient } from 'viem'

export type Found = { name: string; icon?: string; rdns?: string; provider: EIP1193Provider }

/** EIP-6963 discovery, falling back to a bare window.ethereum. */
export function discoverWallets(waitMs = 350): Promise<Found[]> {
  return new Promise(resolve => {
    const found = new Map<string, Found>()
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail as { info: { name: string; icon: string; rdns: string }; provider: EIP1193Provider }
      found.set(d.info.rdns, { name: d.info.name, icon: d.info.icon, rdns: d.info.rdns, provider: d.provider })
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      const list = [...found.values()]
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum
      if (list.length === 0 && eth) list.push({ name: 'Browser wallet', provider: eth })
      resolve(list)
    }, waitMs)
  })
}

export type Session = { account: Address; client: WalletClient; name: string; /** switches the wallet to this chain; call right before sending a transaction */ ensure(): Promise<void> }

const hex = (n: number) => `0x${n.toString(16)}`

export function makeSession(w: Found, account: Address, chain: Chain): Session {
  return { account, name: w.name, client: createWalletClient({ account, chain, transport: custom(w.provider) }), ensure: () => ensureChain(w.provider, chain) }
}

export async function ensureChain(provider: EIP1193Provider, chain: Chain) {
  const current = (await provider.request({ method: 'eth_chainId' })) as string
  if (Number(current) === chain.id) return
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex(chain.id) }] })
  } catch (e) {
    const code = (e as { code?: number }).code
    if (code !== 4902 && code !== -32603) throw e
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: hex(chain.id),
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls.default.http,
        blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
      }],
    })
  }
}

/** Ask a wallet which account to use, without switching networks or signing anything. */
export async function requestAccount(w: Found): Promise<Address> {
  const accounts = (await w.provider.request({ method: 'eth_requestAccounts' })) as Address[]
  if (!accounts[0]) throw new Error('The wallet did not share an account.')
  return accounts[0]
}

/** The account a wallet already shared with this site, if any. Never opens a prompt. */
export async function sharedAccount(w: Found): Promise<Address | null> {
  try {
    const accounts = (await w.provider.request({ method: 'eth_accounts' })) as Address[]
    return accounts[0] ?? null
  } catch {
    return null
  }
}
