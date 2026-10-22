// Email / Google sign-in (Privy) is optional and must never get in the way. Checks, without a real Privy app:
//   1. no app id configured  -> no such option, and the page never contacts Privy
//   2. an app id Privy rejects -> the option shows, fails with a clear message after a wait, and the rest of the page keeps working
//   3. the way back from Google -> only a tab that started a sign-in finishes one; a stray link does nothing
// (A real sign-in needs a real Privy app id and an email code: see docs/PRIVY.md.)
//   node privy.mjs
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const vite = path.join(here, '../web/node_modules/.bin/vite')
const step = m => console.log('•', m)
const servers = []
const serve = async (port, env) => {
  const s = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(here, '../web'), env: { ...process.env, ...env }, stdio: 'ignore' })
  servers.push(s)
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return `http://127.0.0.1:${port}/` } catch { /* not up */ } await new Promise(r => setTimeout(r, 500)) }
  throw new Error('dev server did not start')
}
const stop = () => servers.forEach(s => { try { s.kill() } catch { /* gone */ } })
process.on('exit', stop)

const browser = await chromium.launch()
let failed = false
try {
  const open = async base => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
    const page = await ctx.newPage()
    const hosts = new Set(), uncaught = []
    page.on('request', r => hosts.add(new URL(r.url()).host))
    page.on('pageerror', e => uncaught.push(e.message))
    await page.goto(base + '#c=1462', { waitUntil: 'networkidle' })
    await page.click('.wbtn'); await page.waitForSelector('.wmodal')
    return { page, hosts, uncaught }
  }

  // 1. off
  const off = await serve(5190, { VITE_PRIVY_APP_ID: '' })
  const a = await open(off)
  assert.equal(await a.page.locator('.wmodal .wrow:has-text("Sign in with email")').count(), 0)
  assert.ok(![...a.hosts].some(h => /privy|walletconnect|reown/.test(h)))
  step('no app id: no email option, and the page never contacts Privy')

  // 2. a rejected app id
  const on = await serve(5191, { VITE_PRIVY_APP_ID: 'cm1abcdefghijklmnopqrstuv' })
  const b = await open(on)
  assert.equal(await b.page.locator('.wmodal .wrow:has-text("Sign in with email")').count(), 1)
  assert.ok(![...b.hosts].some(h => /privy/.test(h)))
  step('with an app id: the option shows, and Privy is still not contacted until someone picks it')
  await b.page.click('.wmodal .wrow:has-text("Sign in with email")')
  await b.page.waitForSelector('.wmodal .w-err', { timeout: 40000 })
  assert.match(await b.page.textContent('.wmodal .w-err'), /sign-in service/)
  assert.ok([...b.hosts].some(h => /privy/.test(h)))
  step('picking it downloads the SDK, Privy rejects the id, and the visitor gets a clear message')
  assert.equal(await b.page.locator('.wmodal .wrow:has-text("Sign in with email") .spin').count(), 0)
  await b.page.click('.wm-x')
  await b.page.waitForSelector('.wmodal', { state: 'detached' })
  await b.page.click('.play.wide')
  await b.page.waitForTimeout(800)
  assert.equal(await b.page.locator('.play.wide.on').count(), 1)
  assert.equal(b.uncaught.length, 0, b.uncaught.join('\n'))
  step('the page carries on: the modal closes, a song plays, nothing crashed')
  // 3. coming back from Google
  const RET = '?privy_oauth_code=abc&privy_oauth_state=xyz&privy_oauth_provider=google'
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx3.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
  const stray = await ctx3.newPage()
  const strayHosts = new Set()
  stray.on('request', r => strayHosts.add(new URL(r.url()).host))
  await stray.goto(on + RET + '#choir', { waitUntil: 'networkidle' })
  await stray.waitForTimeout(1500)
  assert.ok(![...strayHosts].some(h => /privy/.test(h)))
  step('a link carrying Google-return parameters, from a tab that never started a sign-in, does nothing (Privy is not even contacted)')

  const back = await ctx3.newPage()
  const backHosts = new Set()
  back.on('request', r => backHosts.add(new URL(r.url()).host))
  await back.addInitScript(() => { if (!sessionStorage.getItem('chogchoir:privy-oauth')) sessionStorage.setItem('chogchoir:privy-oauth', String(Date.now())) })
  await back.goto(on + RET + '#choir', { waitUntil: 'networkidle' })
  await back.waitForSelector('.wmodal .w-err', { timeout: 45000 })
  assert.ok([...backHosts].some(h => /privy/.test(h)))
  step('a tab that did start one starts Privy on the way back, and when the sign-in cannot finish the visitor is told, in the connect window')
  await back.click('.wm-x')
  await back.waitForSelector('.wmodal', { state: 'detached' })
  assert.equal(await back.evaluate(() => sessionStorage.getItem('chogchoir:privy-oauth')), null)
  step('and the remembered start is cleared, so it cannot be replayed')
  console.log('PRIVY FALLBACK PASSED')
} catch (e) { failed = true; console.error(e) } finally { await browser.close(); stop() }
process.exit(failed ? 1 : 0)
