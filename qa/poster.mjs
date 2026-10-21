import { chromium } from 'playwright'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await ctx.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
for (const n of [1462, 1531]) {
  await p.goto(`http://127.0.0.1:5188/#c=${n}`, { waitUntil: 'networkidle' }); await p.waitForSelector('.sleeve-wrap'); await p.reload({ waitUntil: 'networkidle' })
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('button:has-text("Save poster")')])
  await dl.saveAs(`${process.env.OUT ?? '/tmp'}/poster-${n}.png`); console.log('saved', dl.suggestedFilename())
}
console.log(errs.length ? errs : 'no errors'); await b.close()
