// The production build, exactly as a judge will load it: no dev overrides, the committed deployments.json, the public RPCs.
// Starts `vite preview` itself and stops it when done.
//   node smoke-prod.mjs            (run `pnpm build` in web/ first)
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 4173
const BASE = `http://127.0.0.1:${PORT}/`
const server = spawn(path.join(here, '../web/node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: path.join(here, '../web'), stdio: 'ignore' })
const stop = () => { try { server.kill() } catch { /* gone */ } }
process.on('exit', stop)
for (let i = 0; i < 30; i++) { try { if ((await fetch(BASE)).ok) break } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)) }

const step = m => console.log('•', m)
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
let failed = false
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = [], requests = new Set(), bad = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  page.on('request', r => requests.add(new URL(r.url()).host))
  page.on('requestfailed', r => bad.push(`${r.url().slice(0, 90)} ${r.failure()?.errorText}`))

  // a first visit gets the welcome
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.onb', { timeout: 10000 })
  step('first visit shows the welcome')
  await page.evaluate(() => localStorage.setItem('chogchoir:welcome-seen', '1'))

  await page.goto(BASE + '#c=1462', { waitUntil: 'networkidle' })
  assert.match(await page.textContent('.hero-info h2'), /Chog #1462/)
  assert.equal(await page.locator('button:has-text("Hum a tune")').count(), 1)
  step('Songs opens Chog #1462, with the hum button')

  // the Choir reads the real final testnet deployment
  await page.goto(BASE + '#choir', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => /^Round \d+$/.test(document.querySelector('.stage h1')?.textContent ?? ''), null, { timeout: 30000 })
  await page.waitForFunction(() => /\b\d+ voices?\b/.test(document.querySelector('.stage .sub')?.textContent ?? ''), null, { timeout: 15000 })
  const sub = await page.textContent('.stage .sub')
  step(`The Choir loads from Monad testnet by default: "${(await page.textContent('.stage h1')).trim()}", ${sub.trim()}`)
  await page.waitForFunction(() => /of 1,969 Chogs have sung/.test(document.querySelector('.community')?.textContent ?? ''), null, { timeout: 30000 })
  assert.equal(await page.locator('.loft canvas').count(), 1)
  assert.match(await page.textContent('.fill output'), /live/)
  step('community meter, loft and the preview slider are there')

  // a crafted link must not be able to point the app at someone else's contract or RPC
  const evil = new Set()
  page.on('request', r => { if (new URL(r.url()).host === 'evil.invalid') evil.add(r.url()) }) // the page's own address contains the word, so compare hosts
  await page.goto(BASE + '?chain=1&rpc=http://evil.invalid&choir=0x0000000000000000000000000000000000000001&nft=0x0000000000000000000000000000000000000002#choir', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => /^Round \d+$/.test(document.querySelector('.stage h1')?.textContent ?? ''), null, { timeout: 30000 })
  assert.equal(evil.size, 0)
  step('dev-only overrides in the link are ignored in the production build')

  await page.goto(BASE + '#records', { waitUntil: 'networkidle' })
  await page.waitForSelector('.stage h1')
  step('Records opens')

  // a phone: nothing sideways
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await phone.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
  const pp = await phone.newPage()
  for (const h of ['#c=1462&d=88', '#choir', '#records', '#studio']) {
    await pp.goto(BASE + h, { waitUntil: 'networkidle' })
    await pp.waitForTimeout(800)
    const over = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(over <= 1, `${h} is ${over}px wider than a phone`)
  }
  step('Songs, Choir, Records and Studio fit a phone with no sideways scroll')

  const hosts = [...requests].filter(h => !/^127\.0\.0\.1/.test(h))
  step(`the page talked to: ${hosts.join(', ')}`)
  const unexpected = hosts.filter(h => !/monad|ankr|fonts\.g(oogleapis|static)\.com/.test(h))
  assert.deepEqual(unexpected, [])
  step('and only to Monad RPCs and Google Fonts')
  const real = errors.filter(e => !/favicon/.test(e))
  assert.equal(real.length, 0, real.join('\n'))
  if (bad.length) console.log('  (failed requests, ignored:', bad.slice(0, 3).join(' | '), ')')
  step('no page errors')
  console.log('PROD SMOKE PASSED')
} catch (e) {
  failed = true
  console.error(e)
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
