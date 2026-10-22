// A phone's view of the production build: the welcome screen, the pages and the sound, with touch events and the phone's real (short) visible height.
//   node mobile.mjs                         (run `pnpm build` in web/ first; serves it locally)
//   node mobile.mjs https://chog-choir.vercel.app/
//   BROWSER=webkit node mobile.mjs         (the Safari engine, the one every iPhone browser uses; needs `npx playwright install webkit`)
// Checks what was broken on phones: the welcome footer sitting on top of its content, text cut off at the card's edge, controls too small to hit,
// a record sleeve or loft wider than a narrow screen, and Play making no sound (including a Safari-like phone that has the audio-session API,
// and an older iPhone that does not and needs the silent-media trick).
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 4176
const REMOTE = process.argv[2]
const BASE = REMOTE ? REMOTE.replace(/\/?$/, '/') : `http://127.0.0.1:${PORT}/`
const server = REMOTE ? null : spawn(path.join(here, '../web/node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: path.join(here, '../web'), stdio: 'ignore' })
const stop = () => { try { server?.kill() } catch { /* gone */ } }
process.on('exit', stop)
for (let i = 0; i < 30; i++) { try { if ((await fetch(BASE)).ok) break } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)) }

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
// width x height is what the page can use: an iPhone 14 is 390x844 but about 390x664 in Safari once the address bar and toolbar are showing
const PHONES = [
  { name: 'iPhone 14 (Safari bars)', w: 390, h: 664, ua: IPHONE_UA },
  { name: 'iPhone SE (Safari bars)', w: 375, h: 553, ua: IPHONE_UA },
  { name: 'Android 360x640', w: 360, h: 640, ua: ANDROID_UA },
  { name: 'small 320x568', w: 320, h: 568, ua: ANDROID_UA },
]

const failures = []
const check = (ok, msg) => { console.log(ok ? '  ✓' : '  ✗', msg); if (!ok) failures.push(msg) }
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium
console.log(`browser engine: ${process.env.BROWSER === 'webkit' ? 'WebKit (Safari)' : 'Chromium'}`)
const browser = await engine.launch()

// ── a slow font host must not hold the page up (the fonts are third-party and a phone's connection can be poor)
{
  console.log('\nfonts that never arrive')
  const timeToWelcome = async hang => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })
    if (hang) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, () => { /* never answered */ })
    const page = await ctx.newPage()
    const t0 = Date.now()
    await page.goto(BASE, { waitUntil: 'commit', timeout: 60000 }).catch(() => undefined)
    const t = await page.waitForSelector('.onb-card', { timeout: 40000 }).then(() => Date.now() - t0, () => Infinity)
    await ctx.close()
    return t
  }
  // measured against the same run's normal load, so a slow connection to a remote site does not fail it
  const normal = await timeToWelcome(false), hung = await timeToWelcome(true)
  check(hung <= Math.max(6000, normal * 1.5 + 2000), `the welcome appears while the fonts are still missing (${hung} ms; ${normal} ms with the fonts)`)
}

// ── no web fonts at all: the fallback fonts are wider, and every page must still fit a narrow screen
{
  console.log('\nno web fonts (fallback fonts)')
  for (const [w, h] of [[320, 568], [360, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())
    await ctx.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
    const page = await ctx.newPage()
    for (const hash of ['#c=1462', '#studio', '#choir', '#records']) {
      await page.goto(BASE + '?fb=' + Math.random().toString(36).slice(2) + hash, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.tabs', { timeout: 30000 }); await page.waitForTimeout(1200)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      check(over <= 0, `${w}px, ${hash}: no sideways scroll with the fallback font${over > 0 ? ` (${over}px too wide)` : ''}`)
    }
    await ctx.close()
  }
}

// ── layout
for (const p of PHONES) {
  console.log(`\n${p.name}`)
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, isMobile: true, hasTouch: true, userAgent: p.ua })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.onb-card', { timeout: 15000 }); await page.waitForTimeout(900)

  // the welcome, step by step
  for (let step = 1; step <= 4; step++) {
    const m = await page.evaluate(() => {
      const card = document.querySelector('.onb-card'), body = document.querySelector('.onb-body'), foot = document.querySelector('.onb-foot')
      const cr = card.getBoundingClientRect(), br = body.getBoundingClientRect(), fr = foot.getBoundingClientRect()
      const scrolls = el => { for (let e = el; e && e !== card.parentElement; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (e !== card && (o === 'auto' || o === 'scroll')) return true } return false }
      const cut = []
      for (const el of card.querySelectorAll('.onb-body *')) {
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
        if (getComputedStyle(el).position === 'absolute' && !el.closest('.sleeve-wrap')) continue
        if (r.right > cr.right + 1 && !scrolls(el)) cut.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} right=${Math.round(r.right)} card=${Math.round(cr.right)}`)
      }
      const nextBtn = document.querySelector('.onb-nav .btn.solid').getBoundingClientRect()
      return { overlap: Math.round(br.bottom - fr.top), footInView: fr.top >= 0 && fr.bottom <= innerHeight + 1, nextInView: nextBtn.right <= innerWidth && nextBtn.bottom <= innerHeight + 1 && nextBtn.left >= 0, bodyReachable: body.scrollHeight <= body.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(body).overflowY), cut: [...new Set(cut)].slice(0, 3), footOverflow: foot.scrollWidth > foot.clientWidth + 1 }
    })
    check(m.overlap <= 1, `welcome step ${step}: the footer does not sit on its content (overlap ${m.overlap}px)`)
    check(m.footInView && m.nextInView, `welcome step ${step}: Back and Next are on screen without scrolling`)
    check(m.bodyReachable, `welcome step ${step}: content taller than the screen can be scrolled to`)
    check(m.cut.length === 0 && !m.footOverflow, `welcome step ${step}: nothing is cut off at the card's right edge${m.cut.length ? ' (' + m.cut.join('; ') + ')' : ''}`)
    if (step < 4) { await page.tap('.onb-nav .btn.solid'); await page.waitForTimeout(450) }
  }

  // the pages, with the welcome already seen
  await page.evaluate(() => localStorage.setItem('chogchoir:welcome-seen', '1'))
  await page.goto(BASE + '?again=1#c=1462', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.hero .sleeve-wrap', { timeout: 15000 }); await page.waitForTimeout(700)
  const songs = await page.evaluate(() => {
    const vw = innerWidth, sw = document.querySelector('.hero .sleeve-wrap'), card = sw.closest('.stage, .hero, section') || document.body
    const r = sw.getBoundingClientRect(), disc = document.querySelector('.hero .disc').getBoundingClientRect()
    const small = [...document.querySelectorAll('.tabs a, .top .btn, .top .mode, .btn:not(.small)')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 40 }).map(e => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)} ${Math.round(e.getBoundingClientRect().height)}px`)
    return { vw, docOver: document.documentElement.scrollWidth - vw, sleeveRight: Math.round(r.right), discRight: Math.round(disc.right), small: [...new Set(small)].slice(0, 6) }
  })
  check(songs.docOver <= 0, 'Songs: the page does not scroll sideways')
  check(songs.discRight <= songs.vw - 8, `Songs: the record fits the screen (right edge ${songs.discRight} of ${songs.vw})`)
  check(songs.small.length === 0, `Songs: buttons and tabs are at least 40px tall${songs.small.length ? ' (too small: ' + songs.small.join(', ') + ')' : ''}`)

  await page.goto(BASE + '?again=2#choir', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.loft canvas', { timeout: 30000 }); await page.waitForTimeout(900)
  const choir = await page.evaluate(() => { const c = document.querySelector('.loft canvas').getBoundingClientRect(), w = document.querySelector('.loft').getBoundingClientRect(); return { canvasRight: Math.round(c.right), wrapRight: Math.round(w.right), vw: innerWidth, docOver: document.documentElement.scrollWidth - innerWidth } })
  check(choir.canvasRight <= choir.wrapRight + 1 && choir.canvasRight <= choir.vw, `Choir: the loft fits its card and the screen (canvas ${choir.canvasRight}, card ${choir.wrapRight}, screen ${choir.vw})`)
  check(choir.docOver <= 0, 'Choir: the page does not scroll sideways')
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
  await ctx.close()
}

// ── sound: a tap on Play must start audio that is actually audible
async function soundCase(label, { ua, audioSession }) {
  console.log(`\nsound: ${label}`)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, userAgent: ua })
  await ctx.addInitScript(({ audioSession }) => {
    if (audioSession) { const s = { type: 'auto' }; Object.defineProperty(navigator, 'audioSession', { value: s, configurable: true }); window.__session = s }
    else { try { Object.defineProperty(navigator, 'audioSession', { value: undefined, configurable: true }) } catch { /* ok */ } }
    window.__media = []
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () { window.__media.push({ loop: this.loop, src: String(this.src).slice(0, 20) }); return play.call(this) }
    const AC = window.AudioContext, ctxs = (window.__ctxs = [])
    const connect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) { const c = this.context; if (!c.__an) { c.__an = c.createAnalyser(); c.__an.fftSize = 2048; connect.call(c.__an, c.destination) } connect.call(this, c.__an) }
      return connect.call(this, dest, ...rest)
    }
    window.AudioContext = new Proxy(AC, { construct(T, a) { const c = new T(...a); ctxs.push(c); return c } })
    window.__level = () => { let best = 0; for (const c of ctxs) { if (!c.__an) continue; const a = new Float32Array(c.__an.fftSize); c.__an.getFloatTimeDomainData(a); for (const v of a) best = Math.max(best, Math.abs(v)) } return best }
  }, { audioSession })
  const page = await ctx.newPage()
  const level = async () => { let peak = 0; for (let i = 0; i < 40; i++) { peak = Math.max(peak, await page.evaluate(() => window.__level())); await page.waitForTimeout(60) } return peak }
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForSelector('.onb .play.wide', { timeout: 15000 }); await page.waitForTimeout(600)
  await page.tap('.onb .play.wide'); await page.waitForTimeout(500)
  const st = await page.evaluate(() => (window.__ctxs || []).map(c => c.state).join(','))
  check(st.split(',').includes('running'), `welcome "Hear a Chog sing": the audio context is running (${st || 'none'})`)
  check(await level() > 0.05, 'welcome "Hear a Chog sing": the sound is audible')
  if (audioSession) check(await page.evaluate(() => window.__session.type) === 'playback', 'the page asks the phone to treat its sound as playback (so the silent switch does not mute it)')
  else if (/iPhone/.test(ua)) check((await page.evaluate(() => window.__media)).some(m => m.loop), 'an older iPhone gets the silent looping media that lets Web Audio through the silent switch')
  await page.tap('.onb-skip'); await page.waitForTimeout(600)
  await page.tap('.stage .play, .hero .play, button:has-text("Play")')
  await page.waitForTimeout(600)
  check(await level() > 0.05, 'Songs "Play": the sound is audible')
  await ctx.close()
}
await soundCase('Android Chrome (no audio-session API)', { ua: ANDROID_UA, audioSession: false })
await soundCase('iPhone Safari 17 (has the audio-session API)', { ua: IPHONE_UA, audioSession: true })
await soundCase('older iPhone (no audio-session API)', { ua: IPHONE_UA, audioSession: false })

await browser.close()
stop()
console.log(failures.length ? `\nMOBILE CHECK FAILED (${failures.length})` : '\nMOBILE CHECK PASSED')
process.exit(failures.length ? 1 : 0)
