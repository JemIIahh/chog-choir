// Against the REAL Privy app (needs VITE_PRIVY_APP_ID, and VITE_PRIVY_METHODS=email,google for the Google checks, set on the server
// being tested). Enters no email and signs in to nothing, so it sends no messages and creates no users.
//   node privy-live.mjs http://127.0.0.1:5193/        (a dev server started with those variables)
//   node privy-live.mjs https://chog-choir.vercel.app/
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = (process.argv[2] ?? '').replace(/\/?$/, '/')
assert.ok(/^https?:/.test(BASE), 'give the address of the site to test')
const WANT_GOOGLE = process.argv.includes('--google')
const step = m => console.log('•', m)
const browser = await chromium.launch()
let failed = false
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
  const page = await ctx.newPage()
  const uncaught = []
  page.on('pageerror', e => uncaught.push(e.message))
  await page.goto(BASE + '#c=1462', { waitUntil: 'networkidle' })
  await page.click('.wbtn'); await page.waitForSelector('.wmodal')
  const row = await page.textContent('.wmodal .wrow:first-child')
  step(`our connect window offers: ${row.replace(/\s+/g, ' ').trim()}`)
  assert.match(row, WANT_GOOGLE ? /Email or Google/ : /email/i)

  await page.click('.wmodal .wrow:first-child')
  const dialog = page.locator('input[type=email], input[placeholder*="email" i]').first()
  await dialog.waitFor({ timeout: 30000 })
  step("Privy's own sign-in window opens, with an email box")
  const google = page.locator('button:not(.wrow):has-text("Google")').first()
  if (WANT_GOOGLE) {
    await google.waitFor({ timeout: 10000 })
    step('and a Google button, because Google is switched on in the dashboard and in this build')
    const nav = page.waitForURL(u => /accounts\.google\.com/.test(u.host), { timeout: 30000 })
    await google.click()
    await nav
    step(`clicking Google leaves for Google's own sign-in page (${new URL(page.url()).host}); nothing was entered`)
  } else {
    assert.equal(await google.count(), 0)
    step('and no Google button (this build offers email only)')
  }
  assert.equal(uncaught.length, 0, uncaught.join('\n'))
  console.log('PRIVY LIVE CHECK PASSED')
} catch (e) { failed = true; console.error(e) } finally { await browser.close() }
process.exit(failed ? 1 : 0)
