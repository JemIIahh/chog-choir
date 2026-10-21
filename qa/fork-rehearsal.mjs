// Rehearses the mainnet deployment on a local fork of Monad mainnet, with the REAL Chog Genesis and the REAL $CHOG.
// Nothing is sent to the real chain: anvil forks it and impersonates a real holder.
//
//   node fork-rehearsal.mjs
//
// It checks, against the real contracts: the deploy script's guards, one note, a 73-Chog batch from the biggest holder,
// an encore whose $CHOG is really burned (total supply drops), and sealing the finished round.
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createTestClient, createWalletClient, defineChain, http, parseAbi } from '../web/node_modules/viem/_esm/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const contracts = path.join(here, '../contracts')
const PORT = 8599
const RPC = `http://127.0.0.1:${PORT}`
const NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
const TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777'
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil's public test key; local fork only
const PRICE = 1000n * 10n ** 18n

const chain = defineChain({ id: 143, name: 'Monad (fork)', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } } })
const pub = createPublicClient({ chain, transport: http(), batch: { multicall: true } })
// holder discovery reads the real chain directly (read-only); everything that writes happens on the fork
const real = createPublicClient({ chain: defineChain({ ...chain, rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } } }), transport: http(), batch: { multicall: true } })
const test = createTestClient({ chain, mode: 'anvil', transport: http() })

const nftAbi = parseAbi(['function ownerOf(uint256) view returns (address)'])
const tokAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'])
const choirAbi = parseAbi([
  'function place(uint16,uint8,uint8)', 'function placeMany(uint16[],uint8[],uint8[])', 'function encore(uint16,uint8,uint8)', 'function seal(uint256)',
  'function noteCount(uint256) view returns (uint256)', 'function totalBurned() view returns (uint256)', 'function singers() view returns (uint32)', 'function voices() view returns (uint256)',
  'function currentEpoch() view returns (uint256)', 'function sealedBy(uint256) view returns (address)', 'function startTime() view returns (uint64)', 'function epochSeconds() view returns (uint64)',
])

let failures = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

const anvil = spawn('anvil', ['--fork-url', 'https://rpc.monad.xyz', '--port', String(PORT), '--silent'], { stdio: 'ignore' })
const stop = () => { try { anvil.kill() } catch { /* already gone */ } }
process.on('exit', stop)

try {
  for (let i = 0; i < 40; i++) { try { await pub.getChainId(); break } catch { await new Promise(r => setTimeout(r, 500)) } }

  // deploy exactly as the mainnet command will
  const dep = spawnSync('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast'], { cwd: contracts, env: { ...process.env, DEPLOYER_PRIVATE_KEY: DEPLOYER_KEY, NFT, TOKEN, EPOCH_SECONDS: '86400' }, encoding: 'utf8' })
  const CHOIR = /CHOIR\s+(0x[0-9a-fA-F]{40})/.exec(dep.stdout)?.[1]
  check('deploy script runs against the real collection and token', !!CHOIR, CHOIR)
  if (!CHOIR) throw new Error(dep.stdout + dep.stderr)

  const start = await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'startTime' })
  check('rounds are aligned to UTC midnight', Number(start) % 86400 === 0, new Date(Number(start) * 1000).toISOString())

  // find the biggest holder and one of their Chogs
  const res = await real.multicall({ allowFailure: true, batchSize: 200_000, contracts: Array.from({ length: 1969 }, (_, i) => ({ address: NFT, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(i + 1)] })) })
  const byOwner = new Map()
  res.forEach((x, i) => byOwner.set(x.result, [...(byOwner.get(x.result) ?? []), i + 1]))
  const [whale, ids] = [...byOwner.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  check('biggest holder found', ids.length >= 50, `${whale} holds ${ids.length}`)

  const asWhale = createWalletClient({ account: whale, chain, transport: http() })
  await test.impersonateAccount({ address: whale })
  await test.setBalance({ address: whale, value: 10n ** 21n })
  const send = async (address, abi, functionName, args) => {
    const hash = await asWhale.writeContract({ address, abi, functionName, args, gas: 30_000_000n })
    const r = await pub.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') throw new Error(`${functionName} reverted`)
    return r
  }
  const ok = async (name, fn) => { try { const r = await fn(); check(name, true, r?.gasUsed ? `gas ${r.gasUsed}` : ''); return r } catch (e) { check(name, false, String(e.shortMessage ?? e).slice(0, 160)); return null } }

  // one note, then a batch for the rest
  const [first, ...rest] = ids
  await ok('place: the owner sings one note', () => send(CHOIR, choirAbi, 'place', [first, 3, 7]))
  const batch = rest.slice(0, 72)
  const r = await ok(`placeMany: ${batch.length} Chogs in one transaction`, () => send(CHOIR, choirAbi, 'placeMany', [batch, batch.map((_, i) => i % 16), batch.map((_, i) => i % 12)]))
  check('every Chog counted', (await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'noteCount', args: [0n] })) === BigInt(1 + batch.length))
  if (r) check('batch fits well inside a block', r.gasUsed < 15_000_000n, `${r.gasUsed} gas (${(Number(r.gasUsed) / batch.length).toFixed(0)} per Chog)`)

  // a stranger cannot sing for someone else's Chog
  const stranger = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  await test.impersonateAccount({ address: stranger })
  await test.setBalance({ address: stranger, value: 10n ** 20n })
  const sh = await createWalletClient({ account: stranger, chain, transport: http() }).writeContract({ address: CHOIR, abi: choirAbi, functionName: 'place', args: [first, 0, 0], gas: 500_000n })
  check("a stranger cannot sing for someone else's Chog", (await pub.waitForTransactionReceipt({ hash: sh })).status === 'reverted')

  // the encore with the real $CHOG: exact approval, real burn
  const supply0 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'totalSupply' })
  const bal0 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [whale] })
  await send(TOKEN, tokAbi, 'approve', [CHOIR, PRICE])
  await ok('encore: burns real $CHOG', () => send(CHOIR, choirAbi, 'encore', [first, 9, 2]))
  const supply1 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'totalSupply' })
  const bal1 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [whale] })
  check('$CHOG total supply dropped by exactly the price', supply0 - supply1 === PRICE, `${supply0 - supply1}`)
  check('the holder paid exactly the price', bal0 - bal1 === PRICE)
  check('the choir holds none of it', (await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [CHOIR] })) === 0n)
  check('exact approval fully used', (await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'allowance', args: [whale, CHOIR] })) === 0n)
  check('totalBurned counts it', (await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'totalBurned' })) === PRICE)

  // seal the finished round
  await test.increaseTime({ seconds: 86400 + 5 })
  await test.mine({ blocks: 1 })
  await ok('seal: anyone can freeze the finished round', () => send(CHOIR, choirAbi, 'seal', [0n]))
  check('round is sealed', (await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'sealedBy', args: [0n] })) === whale)
  check('singers and voices add up', Number(await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'singers' })) === 1 + batch.length && (await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'voices' })) === BigInt(2 + batch.length))
} catch (e) {
  console.error(e)
  failures++
} finally {
  stop()
}
console.log(failures === 0 ? '\nFork rehearsal: all checks passed.' : `\nFork rehearsal: ${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
