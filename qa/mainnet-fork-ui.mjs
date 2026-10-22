// The mainnet experience in a real browser, on a local fork of Monad mainnet: the REAL Chog Genesis and the REAL $CHOG,
// with the biggest real holder (73 Chogs) impersonated. Nothing is sent to the real chain.
//   node mainnet-fork-ui.mjs        (needs the dev server on :5188, as run-e2e.sh starts it)
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createTestClient, defineChain, http, parseAbi } from '../web/node_modules/viem/_esm/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.join(here, 'shots'); fs.mkdirSync(shots, { recursive: true })
const PORT = 8599, RPC = `http://127.0.0.1:${PORT}`
const NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763', TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777'
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil's public test key; local fork only
const E18 = 10n ** 18n
const chain = defineChain({ id: 143, name: 'Monad (fork)', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } } })
const pub = createPublicClient({ chain, transport: http() })
const real = createPublicClient({ chain: defineChain({ ...chain, rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } } }), transport: http(), batch: { multicall: true } })
const test = createTestClient({ chain, mode: 'anvil', transport: http() })
const choirAbi = parseAbi(['function noteCount(uint256) view returns (uint256)', 'function totalBurned() view returns (uint256)', 'function currentEpoch() view returns (uint256)', 'function hasSung(uint256,uint16) view returns (bool)'])
const tokAbi = parseAbi(['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'])
const step = m => console.log('•', m)

// a huge gas cap so the fork can answer the same 1,969-seat reads the public RPC does
const anvil = spawn('anvil', ['--fork-url', 'https://rpc.monad.xyz', '--port', String(PORT), '--gas-limit', '3000000000', '--silent'], { stdio: 'ignore' })
const stop = () => { try { anvil.kill() } catch { /* gone */ } }
process.on('exit', stop)
let failed = false
try {
  for (let i = 0; i < 40; i++) { try { await pub.getChainId(); break } catch { await new Promise(r => setTimeout(r, 500)) } }
  const dep = spawnSync('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast'], { cwd: path.join(here, '../contracts'), env: { ...process.env, DEPLOYER_PRIVATE_KEY: DEPLOYER_KEY, NFT, TOKEN, EPOCH_SECONDS: '86400' }, encoding: 'utf8' })
  const CHOIR = /CHOIR\s+(0x[0-9a-fA-F]{40})/.exec(dep.stdout)?.[1]
  assert.ok(CHOIR, dep.stdout + dep.stderr)
  step(`deployed the choir on the fork against the real collection and token (${CHOIR})`)

  // the fork fetches each storage slot from the real chain the first time it is read; warm it up so the page's 10 s timeout is not the thing under test
  const warm = createPublicClient({ chain, transport: http(RPC, { timeout: 300_000 }), batch: { multicall: true } })
  await warm.multicall({ allowFailure: true, batchSize: 200_000, contracts: Array.from({ length: 1969 }, (_, i) => ({ address: NFT, abi: parseAbi(['function ownerOf(uint256) view returns (address)']), functionName: 'ownerOf', args: [BigInt(i + 1)] })) })
  const res = await real.multicall({ allowFailure: true, batchSize: 200_000, contracts: Array.from({ length: 1969 }, (_, i) => ({ address: NFT, abi: parseAbi(['function ownerOf(uint256) view returns (address)']), functionName: 'ownerOf', args: [BigInt(i + 1)] })) })
  const byOwner = new Map(); res.forEach((x, i) => byOwner.set(x.result, (byOwner.get(x.result) ?? 0) + 1))
  const [WHALE, count] = [...byOwner.entries()].sort((a, b) => b[1] - a[1])[0]
  await test.impersonateAccount({ address: WHALE }); await test.setBalance({ address: WHALE, value: 10n ** 21n })
  step(`impersonating the biggest real holder ${WHALE}, who holds ${count} Chogs`)

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ acct, rpcUrl }) => {
    localStorage.setItem('chogchoir:welcome-seen', '1')
    const provider = {
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [acct]
        if (method === 'eth_chainId') return '0x8f'
        if (method === 'wallet_switchEthereumChain') return null
        const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
        const j = await r.json()
        if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e }
        return j.result
      },
      on() {}, removeListener() {},
    }
    const info = { uuid: 'mock', name: 'Mock wallet', icon: 'data:image/svg+xml;base64,PHN2Zy8+', rdns: 'test.mock' }
    window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider } })))
  }, { acct: WHALE, rpcUrl: RPC })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  await page.goto(`http://127.0.0.1:5188/?chain=143&rpc=${RPC}&choir=${CHOIR}&nft=${NFT}&token=${TOKEN}&epoch=86400&real=1&net=main#choir`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => /^Round \d+$/.test(document.querySelector('.stage h1')?.textContent ?? ''), null, { timeout: 30000 })
  await page.click('button.wrow:has-text("Mock wallet")')
  await page.waitForFunction(n => document.querySelectorAll('.mine .thumb').length === n, count, { timeout: 60000 })
  step(`the page finds all ${count} real Chogs in the wallet`)
  assert.equal(await page.locator('button:has-text("Claim")').count(), 0)
  assert.equal(await page.locator('button:has-text("Get 1,000 test")').count(), 0)
  step('no free claims and no faucet: this is the real-collection experience')
  await page.waitForSelector(`button:has-text("Sing with all ${count} of your Chogs")`)
  assert.match(await page.textContent('.act'), new RegExp(`${Math.ceil(count / 25)} transactions of up to 25 Chogs`))
  step(`it offers "Sing with all ${count}" and says it will take ${Math.ceil(count / 25)} transactions`)
  await page.screenshot({ path: path.join(shots, '7-real-holder.png') })

  await page.click(`button:has-text("Sing with all ${count} of your Chogs")`)
  await page.waitForFunction(n => new RegExp(`${n} voices`).test(document.querySelector('.stage .sub')?.textContent ?? ''), count, { timeout: 120000 })
  const epoch = await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'currentEpoch' })
  assert.equal(await pub.readContract({ address: CHOIR, abi: choirAbi, functionName: 'noteCount', args: [epoch] }), BigInt(count))
  step(`all ${count} real Chogs sang, in ${Math.ceil(count / 25)} transactions`)
  await page.screenshot({ path: path.join(shots, '8-real-holder-sang.png') })

  // an encore with the real $CHOG: approve exactly 1,000, burn it
  await page.click('.mine .thumb >> nth=0')
  await page.click('.grid .cell >> nth=' + (5 * 16 + 7))
  const supply0 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'totalSupply' })
  const bal0 = await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [WHALE] })
  try { await page.waitForSelector('button.big:has-text("burn 1,000")', { timeout: 20000 }) } catch (e) { console.log('ACT TEXT:', JSON.stringify(await page.textContent('.act'))); await page.screenshot({ path: path.join(shots, 'x-debug.png') }); throw e }
  await page.click('button.big:has-text("burn 1,000")')
  await page.waitForFunction(n => new RegExp(`${n + 1} voices`).test(document.querySelector('.stage .sub')?.textContent ?? ''), count, { timeout: 60000 })
  assert.equal(supply0 - (await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'totalSupply' })), 1000n * E18)
  assert.equal(bal0 - (await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [WHALE] })), 1000n * E18)
  assert.equal(await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'allowance', args: [WHALE, CHOIR] }), 0n)
  assert.equal(await pub.readContract({ address: TOKEN, abi: tokAbi, functionName: 'balanceOf', args: [CHOIR] }), 0n)
  step('encore with the real $CHOG through the page: exactly 1,000 burned, supply down by 1,000, approval used up, choir holds none')
  await page.waitForFunction(() => /1,000 \$CHOG burned/.test(document.querySelector('.community')?.textContent ?? ''), null, { timeout: 30000 })
  step('the page shows "1,000 $CHOG burned"')
  await page.screenshot({ path: path.join(shots, '9-real-holder-encore.png') })

  assert.equal(errors.filter(e => !/favicon|Failed to load resource/.test(e)).length, 0, errors.join('\n'))
  step('no page errors')
  await browser.close()
  console.log('MAINNET FORK UI PASSED')
} catch (e) { failed = true; console.error(e) } finally { stop() }
process.exit(failed ? 1 : 0)
