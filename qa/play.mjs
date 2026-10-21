import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.waitForSelector('.staff')
await page.click('.hero-play')
await page.waitForTimeout(1900)
await page.screenshot({ path: '/tmp/chog-playing.png' })
const state = await page.evaluate(() => ({
  playhead: getComputedStyle(document.querySelector('.playhead')).opacity,
  bubbles: document.querySelectorAll('.bubble').length,
  playBtn: document.querySelector('.play').className,
}))
console.log(JSON.stringify(state), 'errors:', errors.length ? errors.join('\n') : 'none')
await browser.close()
