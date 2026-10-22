// The whole product in a real browser. Two modes:
//   local (default)  a fresh anvil chain; qa/run-e2e.sh starts it and jumps the clock between rounds.
//   MODE=testnet     the real Monad testnet: a fresh wallet is funded from the deployer, every transaction is signed and sent for
//                    real, and the test waits for real rounds to end (use a short-round deployment, e.g. EPOCH_SECONDS=300).
//                      MODE=testnet EPOCH=300 node e2e.mjs <nft> <choir> <token>
// What it covers:
//   claim, sing, encore (a real burn), sing with several Chogs at once, the "what if more Chogs sing" preview,
//   seal, play every sealed round in turn, a duet, and hum-a-tune with a fake microphone.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from '../web/node_modules/viem/_esm/index.js'
import { generatePrivateKey, privateKeyToAccount } from '../web/node_modules/viem/_esm/accounts/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.join(here, 'shots')
fs.mkdirSync(shots, { recursive: true })

const NFT = process.argv[2], CHOIR = process.argv[3], TOKEN = process.argv[4]
const TEST = process.env.MODE === 'testnet'
const RPC = TEST ? (process.env.TESTNET_RPC ?? 'https://testnet-rpc.monad.xyz') : 'http://127.0.0.1:8545'
const CHAIN_ID = TEST ? 10143 : 31337
const EPOCH = Number(process.env.EPOCH ?? 3600)
const BASE = `http://127.0.0.1:5188/?chain=${CHAIN_ID}&rpc=${RPC}&choir=${CHOIR}&nft=${NFT}&token=${TOKEN}&epoch=${EPOCH}`
const rpc = (method, params = []) => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then(r => r.json())
const chain = { id: CHAIN_ID, name: TEST ? 'Monad Testnet' : 'Local', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }
const pub = createPublicClient({ chain, transport: http() })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const TO = ms => (TEST ? ms * 2.5 : ms) // real transactions take a few seconds each

// the wallet: on anvil the first account is unlocked; on testnet a fresh key is funded from the deployer and signs for real
let account = { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }
let signer = null
let funder = null
if (TEST) {
  const env = Object.fromEntries(fs.readFileSync(path.join(here, '../contracts/.env.testnet'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  funder = createWalletClient({ account: privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY), chain, transport: http(RPC) })
  account = privateKeyToAccount(generatePrivateKey())
  signer = createWalletClient({ account, chain, transport: http(RPC) })
  const h = await funder.sendTransaction({ to: account.address, value: parseEther('1') })
  await pub.waitForTransactionReceipt({ hash: h })
  console.log(`• funded a fresh test wallet ${account.address} with 1 MON`)
}
const ACCT = account.address
const choirAbi = parseAbi(['function noteCount(uint256) view returns (uint256)', 'function totalBurned() view returns (uint256)', 'function currentEpoch() view returns (uint256)', 'function startTime() view returns (uint64)', 'function sealedCount() view returns (uint256)'])
const tokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function allowance(address,address) view returns (uint256)'])
const read = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args })
const chainNow = async () => Number((await pub.getBlock()).timestamp)
const roundNow = async () => { const e = Number(await read(CHOIR, choirAbi, 'currentEpoch')); const st = Number(await read(CHOIR, choirAbi, 'startTime')); return { e, end: st + (e + 1) * EPOCH } }
/** the next round: on anvil jump the clock, on testnet wait for it */
async function nextRound() {
  if (!TEST) { await rpc('evm_increaseTime', [EPOCH + 100]); await rpc('evm_mine'); return }
  const { end } = await roundNow()
  const wait = Math.max(0, end - (await chainNow())) + 4
  console.log(`  (waiting ${wait}s for the round to end)`)
  await sleep(wait * 1000)
}
/** on testnet, start a phase only when enough of the round is left to finish it */
async function freshRound(min = 200) {
  if (!TEST) return
  const { end } = await roundNow()
  const left = end - (await chainNow())
  if (left < min) { console.log(`  (only ${left}s left in this round; waiting for the next)`); await sleep((left + 4) * 1000) }
}

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(here, 'hum.wav')}`],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
if (TEST) await ctx.exposeFunction('__send', async tx => signer.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined }))
await ctx.addInitScript(({ acct, rpcUrl, chainHex }) => {
  localStorage.getItem('chogchoir:welcome-seen') || localStorage.setItem('chogchoir:welcome-seen', '1')
  const provider = {
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [acct]
      if (method === 'eth_chainId') return chainHex
      if (method === 'eth_sendTransaction' && window.__send) return window.__send(params[0])
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
}, { acct: ACCT, rpcUrl: RPC, chainHex: '0x' + CHAIN_ID.toString(16) })

const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const step = msg => console.log('•', msg)
const sub = () => page.textContent('.stage .sub')
const shot = name => page.screenshot({ path: path.join(shots, name) })
const setRange = (sel, v) => page.locator(sel).evaluate((el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, v)

// ───────────────────────── round 1: one Chog, one note, one encore
await freshRound(220)
const R1 = (await roundNow()).e // the round index this part runs in
await page.goto(BASE + '#choir', { waitUntil: 'networkidle' })
await page.waitForSelector('.stage h1')
await page.waitForFunction(r => document.querySelector('.stage h1')?.textContent === `Round ${r}`, R1 + 1, { timeout: TO(15000) }).catch(async e => { console.log('H1 now:', JSON.stringify(await page.textContent('.stage h1')), 'SUB:', await sub(), 'URL', page.url()); throw e })
assert.match(await sub(), /0 voices/)
step(`round ${R1 + 1} loads from chain, 0 voices`)
const startTime = Number(await read(CHOIR, choirAbi, 'startTime'))
assert.equal(startTime % EPOCH, 0)
step('rounds are aligned to the clock (start is a multiple of the round length)')

await page.click('button.wrow:has-text("Mock wallet")')
await page.waitForSelector('.wallet.on')
await page.waitForSelector('.wbtn:not(.solid)')
step('wallet connected (the header button shows the account too)')

await page.click('button:has-text("Claim a free Chog")')
await page.waitForSelector('.mine .thumb', { timeout: 20000 })
step('claimed a replica Chog; it shows under "Your Chogs"')
assert.equal(await page.locator('button:has-text("Sing with all")').count(), 0)
step('with one Chog there is no "sing with all" button')

await page.click('.mine .thumb')
await page.click('.grid .cell >> nth=' + (3 * 16 + 5))
await page.waitForSelector('.note.pending')
step('previewed a note on the staff')
await page.click('button:has-text("Sing Chog")')
await page.waitForFunction(() => /1 voice\b/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 20000 })
assert.equal(await page.locator('.grid .note:not(.pending)').count(), 1)
step('note is on chain and on the staff (1 voice)')
await page.waitForFunction(() => /sang this round/.test(document.body.textContent ?? ''))
assert.equal(await page.locator('button:has-text("Sing Chog")').count(), 0)
step('same Chog cannot sing a second plain note; it is offered an encore instead')
await page.waitForFunction(() => /1 of 1,969 Chogs have sung/.test(document.querySelector('.community')?.textContent ?? ''), null, { timeout: 25000 })
assert.equal(await page.locator('.loft canvas').count(), 1)
step('community meter shows 1 of 1,969 Chogs have sung; loft is drawn')
assert.equal(await page.locator('.community .burned').count(), 0)
step('nothing burned yet, so no burn counter')

// encore: approve exactly the price, burn it for real
await page.click('.grid .cell >> nth=' + (6 * 16 + 9))
await page.click('button:has-text("Get 1,000 test")')
await page.waitForSelector('button.big:has-text("burn 1,000")', { timeout: TO(20000) })
step('test $CHOG faucet worked')
const supplyBefore = await read(TOKEN, tokenAbi, 'totalSupply')
await page.click('button.big:has-text("burn 1,000")')
await page.waitForFunction(() => /2 voices/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 30000 })
step('encore added a second voice (2 voices)')
const E18 = 10n ** 18n
assert.equal(await read(TOKEN, tokenAbi, 'balanceOf', [CHOIR]), 0n)
assert.equal(supplyBefore - (await read(TOKEN, tokenAbi, 'totalSupply')), 1000n * E18)
assert.equal(await read(CHOIR, choirAbi, 'totalBurned'), 1000n * E18)
assert.equal(await read(TOKEN, tokenAbi, 'balanceOf', [ACCT]), 0n)
step('the 1,000 $CHOG was really burned: the choir holds none, the wallet paid it, and the token supply fell by exactly 1,000')
assert.equal(await read(TOKEN, tokenAbi, 'allowance', [ACCT, CHOIR]), 0n)
step('the approval was exactly one encore, not unlimited, and is fully used')
await page.waitForFunction(() => /1,000 \$CHOG burned/.test(document.querySelector('.community')?.textContent ?? ''), null, { timeout: 25000 })
step('the page shows "1,000 $CHOG burned"')
await page.click('.play')
await page.waitForTimeout(1500)
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.playhead')).opacity), '1')
step('live round plays')
await shot('1-round-1.png')

// seal that round
await nextRound()
await page.goto(BASE + '#records', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Waiting to be sealed', { timeout: TO(20000) })
await page.waitForSelector('.wallet.on', { timeout: 15000 })
step('the wallet stays connected on another page')
await page.click('button:has-text("Seal it")')
await page.waitForSelector('.round', { timeout: TO(20000) })
step(`round ${R1 + 1} sealed and listed in Records`)
assert.equal(await page.locator('button:has-text("Play all")').count(), 0)
step('with one sealed round there is no "play all"')

// ───────────────────────── round 2: three Chogs sing in one transaction
await page.goto(BASE + '#choir', { waitUntil: 'networkidle' })
await page.waitForFunction(r => document.querySelector('.stage h1')?.textContent === `Round ${r}`, R1 + 2, { timeout: TO(15000) })
await page.waitForSelector('.wallet.on', { timeout: 15000 })
for (const want of [2, 3]) {
  await page.click('button:has-text("Claim another")')
  await page.waitForFunction(w => document.querySelectorAll('.mine .thumb').length === w, want, { timeout: TO(25000) })
}
step('claimed two more Chogs (three in the wallet)')
await page.waitForSelector('button:has-text("Sing with all 3 of your Chogs")')
await shot('2-three-chogs.png')
await page.click('button:has-text("Sing with all 3 of your Chogs")')
await page.waitForFunction(() => /3 voices/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: TO(40000) })
const epoch2 = await read(CHOIR, choirAbi, 'currentEpoch')
assert.equal(await read(CHOIR, choirAbi, 'noteCount', [epoch2]), 3n)
step('three Chogs sang in one transaction (3 voices on chain)')
assert.equal(await page.locator('button:has-text("Sing with all")').count(), 0)
step('after singing, the "sing with all" button is gone')

// what if more Chogs sang: a preview that never touches the chain
assert.match(await page.textContent('.fill output'), /3 Chogs · live/)
await setRange('.fill input', 60)
await page.waitForFunction(() => /60 Chogs · preview/.test(document.querySelector('.fill output')?.textContent ?? ''))
assert.match(await page.textContent('.community'), /60 of 1,969 Chogs singing \(preview\)/)
assert.match(await sub(), /3 voices \(\+ preview\)/) // the header never counts stand-ins as real voices
assert.match(await page.textContent('.c-next'), /Right now: voices, a pad, bass\./)
step('slider to 60: the page says preview, and the bass has joined')
await shot('3-preview-60.png')
await setRange('.fill input', 150)
await page.waitForFunction(() => /drums/.test(document.querySelector('.c-next')?.textContent ?? ''))
step('slider to 150: the drums have joined')
assert.equal(await read(CHOIR, choirAbi, 'noteCount', [epoch2]), 3n)
step('the chain still has only the 3 real voices')
await page.click('.fill button:has-text("Back to live")')
await page.waitForFunction(() => /3 Chogs · live/.test(document.querySelector('.fill output')?.textContent ?? ''))
assert.match(await sub(), /3 voices/)
step('back to live')

// ───────────────────────── play every sealed round
await nextRound()
await page.goto(BASE + '#records', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Waiting to be sealed', { timeout: TO(20000) })
await page.waitForSelector('.wallet.on', { timeout: 15000 })
await page.click('button:has-text("Seal it")')
await page.waitForFunction(() => document.querySelectorAll('.round').length === 2, null, { timeout: TO(25000) })
step(`round ${R1 + 2} sealed; Records lists two rounds`)
await setRange('.dock input[type=range] >> nth=0', 132) // quickest tempo, so the album is short
await page.click('button:has-text("Play all 2 rounds")')
await page.waitForFunction(() => /playing 1 of 2/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 10000 })
assert.match(await page.textContent('.stage h1'), new RegExp(`Round ${R1 + 1}`))
step('"Play all" starts at the oldest round')
await page.waitForFunction(() => /playing 2 of 2/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 30000 })
assert.match(await page.textContent('.stage h1'), new RegExp(`Round ${R1 + 2}`))
step('and moves on to the next round by itself')
await shot('4-records-album.png')
await page.waitForFunction(() => !/playing \d of 2/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 30000 })
step('and stops after the last one')

// ───────────────────────── a duet
await page.goto(BASE + '#c=1462', { waitUntil: 'networkidle' })
await page.waitForSelector('.hero-info h2')
const soloNotes = await page.locator('.grid .note').count()
await page.fill('input[aria-label="Duet partner\'s number"]', '88')
await page.click('button:has-text("Sing together")')
await page.waitForFunction(() => /& #88/.test(document.querySelector('.hero-info h2')?.textContent ?? ''), null, { timeout: 10000 })
assert.equal(await page.evaluate(() => location.hash), '#c=1462&d=88')
assert.ok((await page.locator('.grid .note').count()) > soloNotes)
step(`duet: the link is #c=1462&d=88 and the staff grew from ${soloNotes} to ${await page.locator('.grid .note').count()} notes`)
await shot('5-duet.png')
await page.goto(BASE + '#c=1462&d=88', { waitUntil: 'networkidle' })
await page.waitForFunction(() => /& #88/.test(document.querySelector('.hero-info h2')?.textContent ?? ''))
step('opening the duet link restores the duet')
await page.click('button:has-text("Solo again")')
await page.waitForFunction(() => !/&/.test(document.querySelector('.hero-info h2')?.textContent ?? ''))
assert.equal(await page.evaluate(() => location.hash), '#c=1462')
step('"Solo again" returns to the single song')

// ───────────────────────── hum a tune (the browser's fake microphone plays qa/hum.wav)
const before = await page.locator('.grid .note').count()
await page.click('button:has-text("Hum a tune")')
await page.waitForSelector('.hum-say:has-text("Get ready")')
await page.waitForSelector('.hum-say:has-text("Hum now")', { timeout: 10000 })
step('count-in, then "Hum now"')
await page.waitForSelector('.hero-note:has-text("singing the tune you hummed")', { timeout: 30000 })
const humNotes = await page.locator('.grid .note').count()
assert.ok(humNotes >= 3, `the hum made ${humNotes} notes`)
step(`hummed tune is on the staff as ${humNotes} notes (was ${before}); the Chog sings it`)
await shot('6-hum.png')
await page.click('button:has-text("Back to its own song")')
await page.waitForFunction(() => !document.querySelector('.hero-note'))
step('"Back to its own song" restores the Chog\'s own hook')

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors')
await browser.close()
if (TEST) {
  // give what is left of the test wallet's MON back to the deployer
  try {
    const left = await pub.getBalance({ address: ACCT })
    const fee = parseEther('0.002')
    if (left > fee * 2n) await pub.waitForTransactionReceipt({ hash: await signer.sendTransaction({ to: funder.account.address, value: left - fee }) })
    console.log(`• returned ${(Number(left - fee) / 1e18).toFixed(3)} MON to the deployer`)
  } catch (e) { console.log('(could not return the leftover MON:', String(e.shortMessage ?? e).slice(0, 80), ')') }
}
assert.equal(errors.filter(e => !/favicon|Failed to load resource/.test(e)).length, 0)
console.log('E2E PASSED')
