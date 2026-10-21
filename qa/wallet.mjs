// The wallet button: one place (top right), shared by every page, remembered, and clear about what it does.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const base = process.argv[2] ?? 'http://127.0.0.1:5188/'
const HOLDER = '0x3d38fee3e1a4c43d8fcf715aa6c9ff025074e7e0' // owner of token 1 on Monad mainnet (public data)
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(acct => {
  localStorage.getItem('chogchoir:welcome-seen') || localStorage.setItem('chogchoir:welcome-seen', '1')
  const provider = { request: async ({ method }) => (method === 'eth_requestAccounts' || method === 'eth_accounts' ? [acct] : method === 'eth_chainId' ? '0x8f' : null), on() {}, removeListener() {} }
  const info = { uuid: 'mock', name: 'Mock wallet', icon: 'data:image/svg+xml;base64,PHN2Zy8+', rdns: 'test.mock' }
  window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider } })))
}, HOLDER)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message))
const step = m => console.log('•', m)

await p.goto(base + '#c=1462', { waitUntil: 'networkidle' })
const btn = p.locator('.wbtn')
assert.equal((await btn.textContent()).trim(), 'Connect wallet')
const box = await btn.boundingBox()
assert.ok(box.x + box.width > 1440 * 0.8 && box.y < 120, `the button is top right (at ${Math.round(box.x)},${Math.round(box.y)})`)
step('"Connect wallet" is in the top right corner')
assert.equal(await p.locator('text=/Find my Chogs/').count(), 0)
step('nothing says "Find my Chogs with…" any more')

// the Songs page offers one button that opens the same modal
await p.click('.holder button:has-text("Connect wallet")')
await p.waitForSelector('.wmodal .wrow:has-text("Mock wallet")')
step('the Songs page has one "Connect wallet" button that opens the same modal')
assert.match(await p.textContent('.wmodal'), /Nothing is signed or sent/)
assert.equal(await p.getAttribute('.wmodal', 'aria-modal'), 'true')
step('the modal lists the wallet as a row and says nothing is signed')
await p.keyboard.press('Escape'); assert.equal(await p.locator('.wmodal').count(), 0)
step('Escape closes the modal')
await btn.click(); await p.waitForSelector('.wmodal')
await p.mouse.click(8, 8); assert.equal(await p.locator('.wmodal').count(), 0)
step('clicking the dimmed page closes it too')
await btn.click()
await p.click('.wmodal .wrow:has-text("Mock wallet")')
await p.waitForSelector('.wbtn:not(.solid)')
assert.match(await btn.textContent(), /0x3d38…e7e0/)
assert.equal(await p.locator('.wmodal').count(), 0)
step('connecting shows the short address and closes the modal')
await p.waitForSelector('.holder .thumb', { timeout: 30000 })
step(`Songs shows the holder's real Chogs (${await p.locator('.holder .thumb').count()})`)

await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.wbtn:not(.solid)', { timeout: 10000 })
step('the connection is remembered after a reload, with no wallet prompt')

await btn.click()
await p.waitForFunction(() => /Chog Genesis\. Tap one/.test(document.querySelector('.wmenu')?.textContent ?? ''), null, { timeout: 30000 }) // the count is read from the chain
assert.ok(await p.locator('.wmenu .acct-chog').count() >= 1)
assert.match(await p.getAttribute('.wmenu a', 'href'), new RegExp(HOLDER, 'i'))
step('the account card shows your Chogs and an explorer link for the address')
await p.click('.wmenu button:has-text("Copy")')
await p.waitForSelector('.wmenu button:has-text("Copied")').catch(() => {}) // clipboard can be blocked in headless; not fatal
await p.click('.wmenu .acct-chog'); await p.waitForTimeout(300)
assert.match(await p.evaluate(() => location.hash), /^#c=\d+/); assert.equal(await p.locator('.wmenu').count(), 0)
step('tapping one of your Chogs opens its song and closes the card')
await btn.click(); await p.keyboard.press('Escape'); assert.equal(await p.locator('.wmenu').count(), 0)
step('Escape closes the account card')
await btn.click(); await p.click('.wmenu button:has-text("Disconnect")')
assert.equal((await btn.textContent()).trim(), 'Connect wallet')
await p.reload({ waitUntil: 'networkidle' })
assert.equal((await p.locator('.wbtn').textContent()).trim(), 'Connect wallet')
step('Disconnect works and is remembered')

// the same button on a phone
await p.setViewportSize({ width: 390, height: 844 })
const mb = await p.locator('.wbtn').boundingBox()
assert.ok(mb && mb.x >= 0 && mb.x + mb.width <= 390, 'fits on a phone')
step('the button fits on a phone screen')
assert.equal(errs.length, 0, errs.join(' | '))
await b.close()
console.log('WALLET PASSED')
