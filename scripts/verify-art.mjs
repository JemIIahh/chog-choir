// Spot-checks the bundled thumbnails against the original art on IPFS (the contract's own image CID).
import fs from 'node:fs/promises'
import sharp from 'sharp'

const IMG = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e'
const SAMPLE = Number(process.argv[2] ?? 40)
const pick = Array.from({ length: SAMPLE }, () => 1 + Math.floor(Math.random() * 1969))
let worst = 0, checked = 0
for (const n of pick) {
  let buf = null
  for (let a = 0; a < 10 && !buf; a++) {
    const r = await fetch(`https://ipfs.filebase.io/ipfs/${IMG}/${n}.webp`, { headers: { 'user-agent': 'Mozilla/5.0' } }).catch(() => null)
    if (r?.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.subarray(0, 4).toString() === 'RIFF') buf = b }
    else await new Promise(res => setTimeout(res, 1500 * (a + 1)))
  }
  if (!buf) { console.log('skip', n); continue }
  const a = await sharp(buf).resize(32, 32).raw().toBuffer()
  const b = await sharp(await fs.readFile(`../web/public/chogs/lg/${n}.webp`)).resize(32, 32).raw().toBuffer()
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i])
  const mean = d / a.length
  worst = Math.max(worst, mean); checked++
}
console.log(`checked ${checked} thumbnails against IPFS originals; worst mean difference ${worst.toFixed(2)}/255`)
