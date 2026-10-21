import { chromium } from 'playwright'
const [NFT, CHOIR] = process.argv.slice(2)
const b = await chromium.launch(); const p = await b.newPage()
p.on('console', m => console.log('console', m.type(), m.text().slice(0, 300)))
p.on('pageerror', e => console.log('pageerror', e.message))
await p.goto(`http://127.0.0.1:5188/?chain=31337&rpc=http://127.0.0.1:8545&choir=${CHOIR}&nft=${NFT}&epoch=3600#choir`, { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
console.log('H1:', await p.textContent('.stage h1').catch(e => 'none'), '| SUB:', await p.textContent('.stage .sub').catch(() => 'none'))
await b.close()
