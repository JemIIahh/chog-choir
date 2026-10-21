import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const NFT = process.argv[2], CHOIR = process.argv[3], TOKEN = process.argv[4]
const ACCT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RPC = 'http://127.0.0.1:8545'
const BASE = `http://127.0.0.1:5188/?chain=31337&rpc=${RPC}&choir=${CHOIR}&nft=${NFT}&token=${TOKEN}&epoch=3600`
const rpc = (method, params = []) => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then(r => r.json())

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(({ acct, rpcUrl }) => {
  const provider = {
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [acct]
      if (method === 'eth_chainId') return '0x7a69'
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
}, { acct: ACCT, rpcUrl: RPC })

const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const step = msg => console.log('•', msg)

await page.goto(BASE + '#choir', { waitUntil: 'networkidle' })
await page.waitForSelector('.stage h1')
await page.waitForFunction(() => document.querySelector('.stage h1')?.textContent === 'Round 1', null, { timeout: 15000 }).catch(async e => { console.log('H1 now:', JSON.stringify(await page.textContent('.stage h1')), 'SUB:', await page.textContent('.stage .sub'), 'URL', page.url()); throw e })
assert.match(await page.textContent('.stage .sub'), /0 voices/)
step('round 1 loads from chain, 0 voices')

await page.click('button:has-text("Connect Mock wallet")')
await page.waitForSelector('.wallet.on')
step('wallet connected')

await page.click('button:has-text("Claim a free Chog")')
await page.waitForSelector('.mine .thumb', { timeout: 20000 })
step('claimed a replica Chog; it shows under "Your Chogs"')
await page.screenshot({ path: '/tmp/e2e-1-claimed.png' })

await page.click('.mine .thumb')
await page.click('.grid .cell >> nth=' + (3 * 16 + 5)) // 4th row from the top, 6th step
await page.waitForSelector('.note.pending')
step('previewed a note on the staff')
await page.screenshot({ path: '/tmp/e2e-2-pending.png' })

await page.click('button:has-text("Sing Chog")')
await page.waitForFunction(() => /1 voice\b/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 20000 })
assert.equal(await page.locator('.grid .note:not(.pending)').count(), 1)
step('note is on chain and on the staff (1 voice)')
await page.waitForFunction(() => /sang this round/.test(document.body.textContent ?? ''))
assert.equal(await page.locator('button:has-text("Sing Chog")').count(), 0)
step('same Chog cannot sing a second plain note; it is offered an encore instead')
await page.screenshot({ path: '/tmp/e2e-3-sung.png' })

// community counter and the loft see the new singer
await page.waitForFunction(() => /1 of 1,969 Chogs have sung/.test(document.querySelector('.community')?.textContent ?? ''), null, { timeout: 25000 })
assert.equal(await page.locator('.loft canvas').count(), 1)
step('community meter shows 1 of 1,969 Chogs have sung; loft is drawn')

// encore: burn test $CHOG for a second note
await page.click('.grid .cell >> nth=' + (6 * 16 + 9))
await page.click('button:has-text("Get 1,000 test")')
await page.waitForSelector('button.big:has-text("burn 1,000")', { timeout: 20000 })
step('test $CHOG faucet worked')
await page.screenshot({ path: '/tmp/e2e-3b-encore.png' })
await page.click('button.big:has-text("burn 1,000")')
await page.waitForFunction(() => /2 voices/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 30000 })
step('encore burned $CHOG and added a second voice (2 voices)')
const dead = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: TOKEN, data: '0x70a08231' + '000000000000000000000000000000000000000000000000000000000000dead' }, 'latest'] }) })).json()
assert.equal(BigInt(dead.result), 1000n * 10n ** 18n)
step('1,000 $CHOG really sits at the burn address')

// play the live round
await page.click('.play')
await page.waitForTimeout(1500)
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.playhead')).opacity), '1')
step('live round plays')

// end the round, then seal it from Records
await rpc('evm_increaseTime', [3700]); await rpc('evm_mine')
await page.goto(BASE + '#records', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Waiting to be sealed', { timeout: 20000 })
await page.click('button:has-text("Connect Mock wallet")')
await page.waitForSelector('.wallet.on')
await page.click('button:has-text("Seal it")')
await page.waitForSelector('.round', { timeout: 20000 })
step('round sealed and listed in Records')
assert.match(await page.textContent('.stage .sub'), /2 voices/)
await page.click('.play')
await page.waitForTimeout(1200)
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.playhead')).opacity), '1')
step('sealed record plays back')
await page.screenshot({ path: '/tmp/e2e-4-records.png' })

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors')
await browser.close()
assert.equal(errors.filter(e => !/favicon|Failed to load resource/.test(e)).length, 0)
console.log('E2E PASSED')
