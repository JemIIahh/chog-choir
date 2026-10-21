import { chromium } from 'playwright'
import fs from 'node:fs'

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } }
}
function spectrum(x, rate, from, n = 16384) {
  const re = new Float64Array(n), im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n))
  fft(re, im)
  const mag = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i])
  return { mag, hzPer: rate / n }
}
const band = (s, lo, hi) => { let e = 0; for (let i = Math.floor(lo / s.hzPer); i < Math.ceil(hi / s.hzPer); i++) e += s.mag[i] ** 2; return e }
const db = v => (10 * Math.log10(v + 1e-20)).toFixed(1)
const stats = x => { let pk = 0, sum = 0, clip = 0; for (const v of x) { const a = Math.abs(v); if (a > pk) pk = a; sum += v * v; if (a >= 0.999) clip++ } return { peak: pk, rmsDb: 20 * Math.log10(Math.sqrt(sum / x.length) + 1e-12), clip, nan: x.some(Number.isNaN) } }

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1')) // the welcome would hide the page
page.on('pageerror', e => console.log('pageerror', e.message))
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.waitForSelector('.staff')

// 1. every vowel, same pitch, a plain tenor voice: do the formants land where they should?
const names = ['AH', 'EH', 'EE', 'OH', 'OO']
const res = {}
for (let v = 0; v < 5; v++) {
  const out = await page.evaluate(v => {
    const c = window.__choir.chogs.find(c => c.spec.vowel === v && c.spec.voiceType === 'tenor' && c.spec.fx === 'none' && c.spec.unison === 1 && !c.spec.hollow)
    const base = window.__choir.song()
    return window.__choir.render({ ...base, notes: [{ id: c.id, step: 0, pitch: 4 }], space: 0 }, 1).then(r => ({ r, id: c.id, n: c.n }))
  }, v)
  const x = Float32Array.from(out.r.left)
  const from = Math.floor(out.r.rate * 0.4)
  const s = spectrum(x, out.r.rate, from)
  res[names[v]] = { n: out.n, low: band(s, 200, 450), f1: band(s, 450, 900), f2lo: band(s, 900, 1500), f2hi: band(s, 1700, 2500), top: band(s, 2500, 5000) }
  // fundamental: strongest peak between 100 and 330 Hz
  let pk = 0, pkHz = 0
  for (let i = Math.floor(100 / s.hzPer); i < 330 / s.hzPer; i++) if (s.mag[i] > pk) { pk = s.mag[i]; pkHz = i * s.hzPer }
  const e = res[names[v]]
  e.pitch = pkHz
  const tot = e.low + e.f1 + e.f2lo + e.f2hi + e.top
  console.log(names[v].padEnd(3), `#${out.n}`.padEnd(6), 'share% low/F1/F2lo/F2hi/top:', [e.low, e.f1, e.f2lo, e.f2hi, e.top].map(b => (100 * b / tot).toFixed(0).padStart(3)).join(' '), 'f0', e.pitch.toFixed(0) + 'Hz', 'F2hi/F1 dB', db(e.f2hi / Math.max(e.low, e.f1)), JSON.stringify(stats(x)))
}

// 2. the default band, two loops, and a packed choir
const mix = await page.evaluate(() => window.__choir.render(window.__choir.song(), 2))
console.log('default band :', JSON.stringify(stats(mix.left)))
const dense = await page.evaluate(() => {
  const chogs = window.__choir.chogs
  const notes = []
  for (let i = 0; i < 160; i++) { const c = chogs[(i * 37) % chogs.length]; notes.push({ id: c.id, step: i % 16, pitch: (i * 5) % 12 }) }
  return window.__choir.render({ ...window.__choir.song(), notes }, 1)
})
console.log('160-note choir:', JSON.stringify(stats(dense.left)))
fs.writeFileSync('/tmp/chog-default.f32', Buffer.from(Float32Array.from(mix.left).buffer))
await browser.close()
