import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); await ctx.addInitScript(t => { localStorage.setItem('chogchoir:welcome-seen', '1'); localStorage.setItem('chogchoir:theme', t) }, process.env.THEME ?? 'dark'); const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://127.0.0.1:5188/#c=1462', { waitUntil: 'networkidle' }); await p.waitForSelector('.hero')
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('button:has-text("Save clip")')])
await dl.saveAs(`${process.env.OUT ?? '/tmp'}/chog-card-${process.env.THEME ?? 'dark'}.mp4`); console.log('saved', dl.suggestedFilename(), errs.length ? errs : 'no errors'); await b.close()
