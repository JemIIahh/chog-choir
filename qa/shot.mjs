import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://127.0.0.1:5188/'
const out = process.argv[3] ?? 'shot'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.staff', { timeout: 15000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}-${name}.png`, fullPage: name === 'mobile' })
  console.log(name, 'errors:', errors.length ? errors.join('\n') : 'none')
  await page.close()
}
await browser.close()
