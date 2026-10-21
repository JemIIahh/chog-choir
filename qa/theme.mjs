// The dark/light toggle: follows the system until a choice is made, remembers the choice, ?theme= overrides, no console errors.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://127.0.0.1:5188/'
const b = await chromium.launch()
let failed = 0
const check = (ok, what) => { console.log(ok ? '•' : 'FAIL', what); if (!ok) failed++ }
const mode = p => p.evaluate(() => document.documentElement.dataset.theme)
const open = async (colorScheme, url = base, init) => {
  const ctx = await b.newContext({ colorScheme, viewport: { width: 1200, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
  if (init) await ctx.addInitScript(init)
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto(url + '#c=1462', { waitUntil: 'networkidle' }); await p.waitForSelector('.mode')
  return { p, ctx, errs }
}
{
  const { p, ctx, errs } = await open('dark')
  check(await mode(p) === 'dark', 'a dark system opens in dark mode')
  await p.click('.mode'); check(await mode(p) === 'light', 'the toggle switches to light')
  check(/dark/.test(await p.getAttribute('.mode', 'aria-label')), 'the button says what it will do next')
  await p.reload({ waitUntil: 'networkidle' }); check(await mode(p) === 'light', 'the choice is remembered after a reload')
  check(await p.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(21, 17, 15)'), 'light mode really changes the page colours')
  check(errs.length === 0, 'no page errors (dark system)'); await ctx.close()
}
{
  const { p, ctx, errs } = await open('light')
  check(await mode(p) === 'light', 'a light system opens in light mode')
  check(await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content) === '#fdfbf8', 'the browser bar colour matches')
  await p.click('.mode'); check(await mode(p) === 'dark', 'and it toggles to dark')
  check(errs.length === 0, 'no page errors (light system)'); await ctx.close()
}
{
  const { p, ctx } = await open('dark', base + '?theme=light')
  check(await mode(p) === 'light', '?theme=light wins over the system'); await ctx.close()
}
await b.close()
console.log(failed ? 'THEME FAILED' : 'THEME PASSED'); process.exit(failed ? 1 : 0)
