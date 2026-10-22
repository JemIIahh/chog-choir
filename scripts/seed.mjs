// Keeps the testnet choir from sounding empty: the project wallet claims a handful of replica Chogs and has them
// sing one note each per round (all in one placeMany transaction per 25), then seals finished rounds so Records has something to play.
// These are real transactions from the deployer wallet and are labelled as such in the README.
//
//   node seed.mjs                  # sing in the current round (skips Chogs that already sang)
//   node seed.mjs --seal           # seal finished rounds that have voices
//   node seed.mjs --loop 300       # do both every 300 s until stopped
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { voiceFor } from '../web/src/audio/voice.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const arg = k => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined)
let env = {}
try { env = Object.fromEntries(fs.readFileSync(path.join(here, '../contracts/.env.testnet'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) } catch { /* flags may supply everything */ }
// flags let the same script seed a local chain for testing: --rpc --key --chain --choir --nft
const dep = arg('--choir') ? { choir: arg('--choir'), nft: arg('--nft') } : JSON.parse(fs.readFileSync(path.join(here, '../web/src/chain/deployments.json'), 'utf8'))['10143']
if (!dep) throw new Error('web/src/chain/deployments.json has no testnet deployment yet')

const rpcUrl = arg('--rpc') ?? env.MONAD_TESTNET_RPC
const chain = defineChain({ id: Number(arg('--chain') ?? 10143), name: 'Chog Choir target', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } })
const account = privateKeyToAccount(arg('--key') ?? env.DEPLOYER_PRIVATE_KEY)
const pub = createPublicClient({ chain, transport: http() })
const wallet = createWalletClient({ account, chain, transport: http() })

const choirAbi = parseAbi([
  'function currentEpoch() view returns (uint256)',
  'function hasSung(uint256,uint16) view returns (bool)',
  'function sealedBy(uint256) view returns (address)',
  'function noteCount(uint256) view returns (uint256)',
  'function place(uint16,uint8,uint8)',
  'function placeMany(uint16[],uint8[],uint8[])',
  'function seal(uint256)',
])
const nftAbi = parseAbi(['function claim(uint256)', 'function ownerOf(uint256) view returns (address)'])

// ── the ensemble: chosen from the real traits so every voice type and vowel is there
const m = JSON.parse(fs.readFileSync(path.join(here, '../web/public/data/chogs.json'), 'utf8'))
const chogs = m.rows.map(r => {
  const traits = {}
  m.traits.forEach((t, i) => { if (r[2 + i] >= 0) traits[t] = m.values[i][r[2 + i]] })
  return { id: r[0], n: r[1], spec: voiceFor(traits).spec }
})
// a balanced ensemble: every voice type, picked by a stable hash so the same Chogs sing every run
const COUNT = Number(arg('--count') ?? 28)
const typeOrder = ['bass', 'tenor', 'alto', 'soprano']
const byType = Object.fromEntries(typeOrder.map(t => [t, chogs.filter(c => c.spec.voiceType === t).sort((a, b) => ((a.id * 2654435761) >>> 0) - ((b.id * 2654435761) >>> 0))]))
const cast = Array.from({ length: COUNT }, (_, i) => byType[typeOrder[i % 4]][Math.floor(i / 4)]).filter(Boolean).map(chog => ({ chog }))

async function send(address, abi, functionName, args) {
  const { request } = await pub.simulateContract({ account, address, abi, functionName, args })
  const hash = await wallet.writeContract(request)
  await pub.waitForTransactionReceipt({ hash })
}

async function sing() {
  const epoch = await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'currentEpoch' })
  const todo = []
  for (const [i, { chog }] of cast.entries()) {
    try { await pub.readContract({ address: dep.nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(chog.id)] }) }
    catch { await send(dep.nft, nftAbi, 'claim', [BigInt(chog.id)]); console.log('claimed', chog.id, `(#${chog.n})`) }
    if (await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'hasSung', args: [epoch, chog.id] })) continue
    const h = ((chog.id * 40503 + Number(epoch) * 9973 + i * 31) >>> 0)
    const step = (i * 5 + Number(epoch) * 3 + (h % 3)) % 16
    const span = chog.spec.high - chog.spec.low + 1
    todo.push({ id: chog.id, step, pitch: chog.spec.low + (h % span) })
  }
  // up to 25 Chogs per transaction
  for (let i = 0; i < todo.length; i += 25) {
    const b = todo.slice(i, i + 25)
    await send(dep.choir, choirAbi, 'placeMany', [b.map(n => n.id), b.map(n => n.step), b.map(n => n.pitch)])
  }
  console.log(`round ${Number(epoch) + 1}: ${todo.length} notes placed`)
}

async function seal() {
  const epoch = Number(await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'currentEpoch' }))
  for (let e = Math.max(0, epoch - 12); e < epoch; e++) {
    const by = await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'sealedBy', args: [BigInt(e)] })
    const n = await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'noteCount', args: [BigInt(e)] })
    if (by === '0x0000000000000000000000000000000000000000' && n > 0n) { await send(dep.choir, choirAbi, 'seal', [BigInt(e)]); console.log(`sealed round ${e + 1} (${n} voices)`) }
  }
}

const loop = process.argv.indexOf('--loop')
const run = async () => { if (process.argv.includes('--seal') || loop >= 0) await seal(); if (!process.argv.includes('--seal')) await sing() }
await run()
if (loop >= 0) { const s = Number(process.argv[loop + 1] ?? 300); setInterval(() => run().catch(e => console.error(String(e).slice(0, 200))), s * 1000) }
