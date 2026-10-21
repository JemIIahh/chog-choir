import { BaseError, ContractFunctionRevertedError, createPublicClient, fallback, http, type Address, type PublicClient } from 'viem'
import type { Note } from '../lib/share'
import { choirAbi, nftAbi, tokenAbi } from './abi'
import type { Deployment, Target } from './config'
import type { Session } from './wallet'

export type Reader = { pub: PublicClient; target: Target }

/** Reads go to the first public RPC and fall over to the others if it rate-limits or goes down. */
export function makeReader(target: Target): Reader {
  const urls = target.chain.rpcUrls.default.http
  const transport = urls.length > 1 ? fallback(urls.map(u => http(u, { retryCount: 1, timeout: 12_000 })), { retryCount: 1 }) : http()
  return { pub: createPublicClient({ chain: target.chain, transport, batch: { multicall: true } }), target }
}

export const unpack = (n: number): Note => ({ id: (n >>> 16) & 0xffff, step: (n >>> 8) & 255, pitch: n & 255 })

export type Round = { epoch: number; start: number; end: number; notes: Note[]; now: number }

export async function readRound(r: Reader, d: Deployment): Promise<Round> {
  const epoch = await r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'currentEpoch' })
  const [start, raw, block] = await Promise.all([
    r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'epochStart', args: [epoch] }),
    r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'notesOf', args: [epoch] }),
    r.pub.getBlock(),
  ])
  return { epoch: Number(epoch), start: Number(start), end: Number(start) + d.epochSeconds, notes: raw.map(Number).map(unpack), now: Number(block.timestamp) }
}

export type Sealed = { epoch: number; start: number; hash: `0x${string}`; by: Address; notes: Note[] }

export async function readSealed(r: Reader, d: Deployment): Promise<Sealed[]> {
  const epochs = await r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'sealedEpochs' })
  const out = await Promise.all(
    [...epochs].reverse().slice(0, 24).map(async e => {
      const [start, hash, by, raw] = await Promise.all([
        r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'epochStart', args: [e] }),
        r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'trackHash', args: [e] }),
        r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'sealedBy', args: [e] }),
        r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'notesOf', args: [e] }),
      ])
      return { epoch: Number(e), start: Number(start), hash, by, notes: raw.map(Number).map(unpack) }
    }),
  )
  return out
}

export type Waiting = { epoch: number; start: number; voices: number }

/** Finished rounds that have voices but nobody has sealed yet (last 12 rounds). */
export async function readWaiting(r: Reader, d: Deployment, current: number): Promise<Waiting[]> {
  const eps = Array.from({ length: Math.min(12, current) }, (_, i) => current - 1 - i)
  if (eps.length === 0) return []
  const res = await r.pub.multicall({
    allowFailure: true,
    contracts: eps.flatMap(e => [
      { address: d.choir, abi: choirAbi, functionName: 'sealedBy', args: [BigInt(e)] } as const,
      { address: d.choir, abi: choirAbi, functionName: 'noteCount', args: [BigInt(e)] } as const,
    ]),
  })
  const out: Waiting[] = []
  eps.forEach((e, i) => {
    const by = res[i * 2]
    const cnt = res[i * 2 + 1]
    const sealed = by.status === 'success' && (by.result as string) !== '0x0000000000000000000000000000000000000000'
    const voices = cnt.status === 'success' ? Number(cnt.result) : 0
    if (!sealed && voices > 0) out.push({ epoch: e, start: 0, voices })
  })
  return out
}

/** Which of the 1,969 ids this account owns, in one multicall. */
export async function readHeld(r: Reader, nft: Address, account: Address, supply = 1969): Promise<number[]> {
  const res = await r.pub.multicall({
    allowFailure: true,
    batchSize: 200_000, // one eth_call, not ~70: the public RPC allows 50 requests a second
    contracts: Array.from({ length: supply }, (_, i) => ({ address: nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(i + 1)] }) as const),
  })
  const mine: number[] = []
  res.forEach((x, i) => { if (x.status === 'success' && (x.result as string).toLowerCase() === account.toLowerCase()) mine.push(i + 1) })
  return mine
}

export async function readSung(r: Reader, d: Deployment, epoch: number, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  const res = await r.pub.multicall({
    allowFailure: true,
    contracts: ids.map(id => ({ address: d.choir, abi: choirAbi, functionName: 'hasSung', args: [BigInt(epoch), id] }) as const),
  })
  return new Set(ids.filter((_, i) => res[i].status === 'success' && res[i].result === true))
}

export async function isClaimed(r: Reader, nft: Address, id: number): Promise<boolean> {
  try {
    await r.pub.readContract({ address: nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(id)] })
    return true
  } catch {
    return false
  }
}

export type LoftStat = { total: number; last: number; streak: number; best: number }

/** Every Chog's record in one call. Index 0 is token id 1. */
export async function readLoft(r: Reader, d: Deployment, supply = 1969): Promise<LoftStat[]> {
  // in chunks: a single call over every seat costs a lot of gas on Monad and some public RPCs cap eth_call
  const CHUNK = 400
  const starts = Array.from({ length: Math.ceil(supply / CHUNK) }, (_, i) => 1 + i * CHUNK)
  const parts = await Promise.all(starts.map(from => r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'loft', args: [BigInt(from), BigInt(Math.min(CHUNK, supply - (from - 1)))] })))
  return parts.flat().map(x => ({ total: x.total, last: x.lastPlusOne, streak: x.streak, best: x.best }))
}

export async function readCollective(r: Reader, d: Deployment): Promise<{ voices: number; singers: number; burned: bigint }> {
  const [voices, singers, burned] = await Promise.all([
    r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'voices' }),
    r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'singers' }),
    r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'totalBurned' }),
  ])
  return { voices: Number(voices), singers: Number(singers), burned }
}

/** The price lives in the contract; the UI never trusts a config file for it. */
export const readPrice = (r: Reader, d: Deployment) => r.pub.readContract({ address: d.choir, abi: choirAbi, functionName: 'encorePrice' })

export const ZERO = '0x0000000000000000000000000000000000000000'
export const encoresOn = (d: Deployment) => d.token.toLowerCase() !== ZERO

export async function readToken(r: Reader, d: Deployment, account: Address): Promise<{ balance: bigint; allowance: bigint }> {
  const [balance, allowance] = await Promise.all([
    r.pub.readContract({ address: d.token, abi: tokenAbi, functionName: 'balanceOf', args: [account] }),
    r.pub.readContract({ address: d.token, abi: tokenAbi, functionName: 'allowance', args: [account, d.choir] }),
  ])
  return { balance, allowance }
}

export async function readEncored(r: Reader, d: Deployment, epoch: number, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0 || !encoresOn(d)) return new Set()
  const res = await r.pub.multicall({
    allowFailure: true,
    contracts: ids.map(id => ({ address: d.choir, abi: choirAbi, functionName: 'encored', args: [BigInt(epoch), id] }) as const),
  })
  return new Set(ids.filter((_, i) => res[i].status === 'success' && res[i].result === true))
}

// ───────────── writes ─────────────

const REVERTS: Record<string, string> = {
  NotYourChog: "That Chog isn't in your wallet.",
  EncoreOff: 'Encores are not switched on here.',
  SingFirst: 'Sing a note first. An encore is a second one.',
  AlreadyEncored: 'This Chog already took its encore this round.',
  BurnFailed: 'The $CHOG could not be burned. Check your balance and approval.',
  AlreadySang: 'This Chog already sang this round. Pick another, or wait for the next round.',
  OutOfRange: 'That cell is outside the staff.',
  EpochNotOver: 'This round is still being sung.',
  AlreadySealed: 'Someone already sealed this round.',
  Silent: 'Nobody sang in that round, so there is nothing to seal.',
  BadBatch: 'That batch of notes was not valid.',
}

export function explain(e: unknown, opts: { testnet?: boolean } = {}): string {
  if (e instanceof BaseError) {
    const rev = e.walk(x => x instanceof ContractFunctionRevertedError)
    if (rev instanceof ContractFunctionRevertedError && rev.data?.errorName && REVERTS[rev.data.errorName]) return REVERTS[rev.data.errorName]
    const code = (e.walk(x => typeof (x as { code?: unknown }).code === 'number') as { code?: number } | null)?.code
    if (code === 4001) return 'Cancelled in your wallet.'
    if (/insufficient funds/i.test(e.shortMessage)) return opts.testnet ? 'Not enough MON for gas. Get testnet MON from a faucet and try again.' : 'Not enough MON in this wallet to pay for gas.'
    if (/already minted|ERC721InvalidSender|ERC721InvalidReceiver/i.test(e.message)) return 'Someone already claimed that Chog. Pick another.'
    return e.shortMessage
  }
  return e instanceof Error ? e.message : 'Something went wrong.'
}

async function send(r: Reader, s: Session, call: { address: Address; abi: typeof choirAbi | typeof nftAbi | typeof tokenAbi; functionName: string; args: unknown[] }) {
  // simulate first so a revert shows its reason instead of a vague wallet error
  const { request } = await r.pub.simulateContract({ ...(call as object), account: s.account } as never)
  await s.ensure() // the wallet may still be on another network
  const hash = await s.client.writeContract(request as never)
  const receipt = await r.pub.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('The transaction was reverted.')
  return hash
}

export const claimChog = (r: Reader, s: Session, d: Deployment, id: number) =>
  send(r, s, { address: d.nft, abi: nftAbi, functionName: 'claim', args: [BigInt(id)] })

export const placeNote = (r: Reader, s: Session, d: Deployment, id: number, step: number, pitch: number) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'place', args: [id, step, pitch] })

/** Several Chogs sing in one transaction. All or nothing, so the caller passes only Chogs that have not sung this round. */
export const placeMany = (r: Reader, s: Session, d: Deployment, notes: { id: number; step: number; pitch: number }[]) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'placeMany', args: [notes.map(n => n.id), notes.map(n => n.step), notes.map(n => n.pitch)] })

export const sealRound = (r: Reader, s: Session, d: Deployment, epoch: number) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'seal', args: [BigInt(epoch)] })

export const encoreNote = (r: Reader, s: Session, d: Deployment, id: number, step: number, pitch: number) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'encore', args: [id, step, pitch] })

/** Approves exactly one encore's worth, so the wallet shows a spending cap equal to the price and nothing more. */
export const approveToken = (r: Reader, s: Session, d: Deployment, amount: bigint) =>
  send(r, s, { address: d.token, abi: tokenAbi, functionName: 'approve', args: [d.choir, amount] })

export const tokenFaucet = (r: Reader, s: Session, d: Deployment) =>
  send(r, s, { address: d.token, abi: tokenAbi, functionName: 'faucet', args: [] })
