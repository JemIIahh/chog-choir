// Email / Google sign-in (Privy) is optional and must never get in the way. Checks, without a real Privy app:
//   1. no app id configured  -> no such option, and the page never contacts Privy
//   2. an app id Privy rejects -> the option shows, fails with a clear message after a wait, and the rest of the page keeps working
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
  console.log('PRIVY FALLBACK PASSED')
} catch (e) { failed = true; console.error(e) } finally { await browser.close(); stop() }
process.exit(failed ? 1 : 0)
