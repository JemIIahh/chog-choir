import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Address, type PublicClient } from 'viem'
import type { Note } from '../lib/share'
import { choirAbi, nftAbi } from './abi'
import type { Deployment, Target } from './config'
import type { Session } from './wallet'

export type Reader = { pub: PublicClient; target: Target }

export function makeReader(target: Target): Reader {
  return { pub: createPublicClient({ chain: target.chain, transport: http(), batch: { multicall: true } }), target }
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

// ───────────── writes ─────────────

const REVERTS: Record<string, string> = {
  NotYourChog: "That Chog isn't in your wallet.",
  AlreadySang: 'This Chog already sang this round. Pick another, or wait for the next round.',
  OutOfRange: 'That cell is outside the staff.',
  EpochNotOver: 'This round is still being sung.',
  AlreadySealed: 'Someone already sealed this round.',
  Silent: 'Nobody sang in that round, so there is nothing to seal.',
}

export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    const rev = e.walk(x => x instanceof ContractFunctionRevertedError)
    if (rev instanceof ContractFunctionRevertedError && rev.data?.errorName && REVERTS[rev.data.errorName]) return REVERTS[rev.data.errorName]
    const code = (e.walk(x => typeof (x as { code?: unknown }).code === 'number') as { code?: number } | null)?.code
    if (code === 4001) return 'Cancelled in your wallet.'
    if (/insufficient funds/i.test(e.shortMessage)) return 'Not enough MON for gas. Get testnet MON from a faucet and try again.'
    if (/already minted|ERC721InvalidSender|ERC721InvalidReceiver/i.test(e.message)) return 'Someone already claimed that Chog. Pick another.'
    return e.shortMessage
  }
  return e instanceof Error ? e.message : 'Something went wrong.'
}

async function send(r: Reader, s: Session, call: { address: Address; abi: typeof choirAbi | typeof nftAbi; functionName: string; args: unknown[] }) {
  // simulate first so a revert shows its reason instead of a vague wallet error
  const { request } = await r.pub.simulateContract({ ...(call as object), account: s.account } as never)
  const hash = await s.client.writeContract(request as never)
  const receipt = await r.pub.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('The transaction was reverted.')
  return hash
}

export const claimChog = (r: Reader, s: Session, d: Deployment, id: number) =>
  send(r, s, { address: d.nft, abi: nftAbi, functionName: 'claim', args: [BigInt(id)] })

export const placeNote = (r: Reader, s: Session, d: Deployment, id: number, step: number, pitch: number) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'place', args: [id, step, pitch] })

export const sealRound = (r: Reader, s: Session, d: Deployment, epoch: number) =>
  send(r, s, { address: d.choir, abi: choirAbi, functionName: 'seal', args: [BigInt(epoch)] })
