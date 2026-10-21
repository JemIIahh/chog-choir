import { chromium } from 'playwright'
import fs from 'node:fs'
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } } for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], xr = re[i + k + len / 2], xi = im[i + k + len / 2], vr = xr * cr - xi * ci, vi = xr * ci + xi * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } } }
function bands(x, rate) {
  const N = 16384, acc = new Float64Array(N / 2); let frames = 0
  for (let from = 0; from + N < x.length; from += N / 2) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[from + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let i = 0; i < N / 2; i++) acc[i] += re[i] ** 2 + im[i] ** 2; frames++ }
  const hz = rate / N, e = (lo, hi) => { let s = 0; for (let i = Math.floor(lo / hz); i < Math.ceil(hi / hz); i++) s += acc[i]; return 10 * Math.log10(s / frames + 1e-20) }
  return { sub: e(30, 120), low: e(120, 300), voice: e(300, 3000), air: e(6000, 16000) }
}
const stats = x => { let pk = 0, s = 0, clip = 0; for (const v of x) { const a = Math.abs(v); if (a > pk) pk = a; s += v * v; if (a >= 0.999) clip++ } return { peak: +pk.toFixed(3), rmsDb: +(20 * Math.log10(Math.sqrt(s / x.length))).toFixed(1), clip } }
const browser = await chromium.launch(); const page = await browser.newPage()
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForSelector('.staff')
const names = ['no beat', 'lo-fi', 'pulse', 'halftime']; const ref = {}
for (let beat = 0; beat < 4; beat++) {
  const r = await page.evaluate(b => window.__choir.render({ ...window.__choir.song(), beat: b }, 2), beat)
  const x = Float32Array.from(r.left); const b = bands(x, r.rate); const st = stats(x)
  if (beat === 0) Object.assign(ref, b)
  console.log(names[beat].padEnd(9), JSON.stringify(st), `sub ${b.sub.toFixed(0)} low ${b.low.toFixed(0)} voice ${b.voice.toFixed(0)} (${(b.voice - ref.voice).toFixed(1)} vs no beat) air ${b.air.toFixed(0)}`)
  if (beat === 1) fs.writeFileSync('/tmp/chog-lofi.f32', Buffer.from(x.buffer))
}
// worst case: 160 voices over every beat
for (let beat = 1; beat < 4; beat++) {
  const r = await page.evaluate(b => { const chogs = window.__choir.chogs; const notes = []; for (let i = 0; i < 160; i++) { const c = chogs[(i * 37) % chogs.length]; notes.push({ id: c.id, step: i % 16, pitch: (i * 5) % 12 }) } return window.__choir.render({ ...window.__choir.song(), beat: b, notes }, 1) }, beat)
  console.log('160 voices +', names[beat].padEnd(9), JSON.stringify(stats(Float32Array.from(r.left))))
}
await browser.close()
