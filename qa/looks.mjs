// Screenshots of every view at desktop and phone width, with the song playing so the backdrop is painted.
// usage: node looks.mjs <outDir> [url]
import { chromium } from 'playwright'
const out = process.argv[2]
const url = process.argv[3] ?? 'http://127.0.0.1:5188/'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const views = [
  ['welcome', '', true],
  ['songs', '#c=1531', false],
  ['studio', '#studio', false],
  ['choir', '#choir', false],
  ['records', '#records', false],
]
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  for (const [name, hash, welcome] of views) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    if (!welcome) await page.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(url + hash, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    if (name === 'songs') { await page.locator('.play').first().click().catch(() => {}); await page.waitForTimeout(1500) }
    if (name === 'welcome') { await page.locator('.play').first().click().catch(() => {}); await page.waitForTimeout(1400) }
    await page.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: tag === 'mobile' && name !== 'welcome' })
    if (errors.length) console.log(tag, name, 'ERRORS', errors.join(' | '))
    await page.close()
  }
}
await browser.close()
console.log('done')
