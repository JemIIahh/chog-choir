// Keeps the testnet choir from sounding empty: the project wallet claims a handful of replica Chogs and has each
// sing one note per round, then seals finished rounds so Records has something to play.
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
try { env = Object.fromEntries(fs.readFileSync(path.join(here, '../contracts/.env'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) } catch { /* flags may supply everything */ }
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
const PLAN = [ // [voice type, steps it sings on across rounds]
  ['bass', [0, 8]], ['bass', [4, 12]], ['tenor', [2, 10]], ['tenor', [6, 14]],
  ['alto', [3, 11]], ['alto', [7, 15]], ['soprano', [1, 9]], ['soprano', [5, 13]], ['alto', [0, 8]], ['tenor', [12, 4]],
]
const used = new Set()
let vowelSeen = new Set()
const cast = PLAN.map(([type, steps]) => {
  const pick = chogs.find(c => c.spec.voiceType === type && !used.has(c.id) && !vowelSeen.has(c.spec.vowel + type) && c.id > 3) ?? chogs.find(c => c.spec.voiceType === type && !used.has(c.id))
  used.add(pick.id); vowelSeen.add(pick.spec.vowel + type)
  return { chog: pick, steps }
})

async function send(address, abi, functionName, args) {
  const { request } = await pub.simulateContract({ account, address, abi, functionName, args })
  const hash = await wallet.writeContract(request)
  await pub.waitForTransactionReceipt({ hash })
}

async function sing() {
  const epoch = await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'currentEpoch' })
  let placed = 0
  for (const [i, { chog, steps }] of cast.entries()) {
    try { await pub.readContract({ address: dep.nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(chog.id)] }) }
    catch { await send(dep.nft, nftAbi, 'claim', [BigInt(chog.id)]); console.log('claimed', chog.id, `(#${chog.n})`) }
    if (await pub.readContract({ address: dep.choir, abi: choirAbi, functionName: 'hasSung', args: [epoch, chog.id] })) continue
    const step = steps[Number(epoch) % steps.length]
    const span = chog.spec.high - chog.spec.low + 1
    const pitch = chog.spec.low + ((i * 3 + Number(epoch)) % span)
    await send(dep.choir, choirAbi, 'place', [chog.id, step, pitch])
    placed++
  }
  console.log(`round ${Number(epoch) + 1}: ${placed} notes placed`)
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
