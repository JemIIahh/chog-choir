import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
await p.addInitScript(() => localStorage.setItem('chogchoir:welcome-seen', '1')) // the welcome would hide the page
await p.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await p.waitForSelector('.hero')
const N = 200
const res = await p.evaluate(async N => {
  const chogs = window.__choir.chogs; const out = []
  for (let i = 0; i < N; i++) {
    const c = chogs[Math.floor((i * chogs.length) / N)]
    const { song } = window.__choir.songFor(c)
    const r = await window.__choir.render(song, 1)
    let pk = 0, s = 0, nan = false
    for (const v of r.left) { if (v !== v) nan = true; const a = Math.abs(v); if (a > pk) pk = a; s += v * v }
    out.push({ n: c.n, peak: pk, rms: 20 * Math.log10(Math.sqrt(s / r.left.length) + 1e-12), nan, bpm: song.tempo, beat: song.beat, mode: song.mode })
  }
  return out
}, N)
const peaks = res.map(r => r.peak), rms = res.map(r => r.rms)
console.log('songs rendered:', res.length)
console.log('peak  max', Math.max(...peaks).toFixed(3), 'mean', (peaks.reduce((a, b) => a + b) / res.length).toFixed(3))
console.log('rms   min', Math.min(...rms).toFixed(1), 'max', Math.max(...rms).toFixed(1), 'dBFS')
console.log('clipping (peak>=0.99):', res.filter(r => r.peak >= 0.99).length, '| NaN:', res.filter(r => r.nan).length, '| near-silent (rms<-35):', res.filter(r => r.rms < -35).length)
const dist = (k) => Object.entries(res.reduce((a, r) => (a[r[k]] = (a[r[k]] ?? 0) + 1, a), {})).map(([x, c]) => `${x}:${c}`).join(' ')
console.log('beats', dist('beat'), '| modes', dist('mode'))
console.log('tempo range', Math.min(...res.map(r => r.bpm)), '-', Math.max(...res.map(r => r.bpm)))
await b.close()
