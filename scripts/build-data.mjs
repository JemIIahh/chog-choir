// Builds the Chog Genesis manifest + thumbnails from the live Monad mainnet contract.
// tokenId -> metadata file comes from tokenURI() on-chain (ids are shuffled vs. the "#n" in the name).
//   node build-data.mjs            # metadata + manifest
//   node build-data.mjs --images   # also thumbnails
import fs from 'node:fs/promises'
import path from 'node:path'
import { createPublicClient, http, parseAbi } from 'viem'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(here, '.cache')
const OUT_DATA = path.join(here, '../web/public/data')
const OUT_IMG = path.join(here, '../web/public/chogs')

const RPC = 'https://rpc.monad.xyz'
const NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
const SUPPLY = 1969
const GATEWAYS = ['https://ipfs.filebase.io/ipfs', 'https://gateway.pinata.cloud/ipfs', 'https://ipfs.io/ipfs', 'https://dweb.link/ipfs', 'https://4everland.io/ipfs', 'https://nftstorage.link/ipfs']
const withImages = process.argv.includes('--images')

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function pool(items, n, fn) {
  let i = 0, done = 0
  const out = new Array(items.length)
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
      if (++done % 200 === 0) console.log(`  ${done}/${items.length}`)
    }
  }))
  return out
}

const client = createPublicClient({ transport: http(RPC) })
const ERC721_ABI = parseAbi(['function tokenURI(uint256) view returns (string)'])
async function tokenURIs(ids) {
  for (let a = 0; a < 6; a++) {
    try {
      return await client.multicall({
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
        allowFailure: false,
        contracts: ids.map(id => ({ address: NFT, abi: ERC721_ABI, functionName: 'tokenURI', args: [BigInt(id)] })),
      })
    } catch (e) { console.log('  rpc retry', a, String(e).slice(0, 120)); await sleep(800 * (a + 1)) }
  }
  throw new Error('multicall failed')
}

function decodeString(hex) {
  const x = hex.slice(2)
  const n = parseInt(x.slice(64, 128), 16)
  return Buffer.from(x.slice(128, 128 + n * 2), 'hex').toString()
}

// Public gateways answer 429 after a handful of requests. Each gateway gets its own adaptive pacer:
// back off hard on 429, creep faster after successes.
const gw = GATEWAYS.map(url => ({ url, nextAt: 0, gap: 300, bad: 0 }))
async function getRaw(rel, kind, retries = 60) {
  for (let a = 0; a < retries; a++) {
    const g = gw.reduce((x, y) => (x.nextAt <= y.nextAt ? x : y))
    const wait = g.nextAt - Date.now()
    g.nextAt = Math.max(Date.now(), g.nextAt) + g.gap // reserve the slot before awaiting
    if (wait > 0) await sleep(wait)
    try {
      const r = await fetch(`${g.url}/${rel}`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
      if (r.ok) {
        const out = kind === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer())
        if (kind === 'buf' && out.subarray(0, 4).toString() !== 'RIFF') throw new Error('not an image') // challenge page, not a Chog
        g.gap = Math.max(120, g.gap * 0.93)
        return out
      }
      if (r.status === 429) {
        g.gap = Math.min(6000, g.gap * 1.8)
        g.nextAt = Date.now() + Math.min(8000, g.gap * 2)
      } else {
        g.gap = Math.min(6000, g.gap * 2)
        g.nextAt = Date.now() + 6000
      }
    } catch { g.gap = Math.min(6000, g.gap * 1.5); g.nextAt = Date.now() + 3000 }
  }
  throw new Error('failed ' + rel)
}
const getJson = rel => getRaw(rel, 'json')
const getBuf = rel => getRaw(rel, 'buf')

await fs.mkdir(path.join(CACHE, 'meta'), { recursive: true })
await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
await fs.mkdir(OUT_DATA, { recursive: true })

// 1. tokenId -> tokenURI (on-chain), batched
console.log('tokenURI for 1..%d', SUPPLY)
const uris = new Array(SUPPLY + 1)
for (let s = 1; s <= SUPPLY; s += 250) {
  const ids = Array.from({ length: Math.min(250, SUPPLY - s + 1) }, (_, i) => s + i)
  const res = await tokenURIs(ids)
  ids.forEach((id, i) => { uris[id] = res[i] })
}
const bases = new Set(uris.slice(1).map(u => u.replace(/\/\d+\.json$/, '')))
if (bases.size !== 1) throw new Error('multiple metadata bases: ' + [...bases].join(','))
const metaBase = [...bases][0].replace('ipfs://', '')
const fileOf = id => Number(uris[id].match(/\/(\d+)\.json$/)[1])
console.log('metadata base', metaBase)

// 2. metadata
console.log('metadata json')
const metas = await pool(Array.from({ length: SUPPLY }, (_, i) => i + 1), 6, async id => {
  const n = fileOf(id)
  const f = path.join(CACHE, 'meta', n + '.json')
  try { return JSON.parse(await fs.readFile(f, 'utf8')) } catch {}
  const j = await getJson(`${metaBase}/${n}.json`)
  await fs.writeFile(f, JSON.stringify(j))
  return j
})

// 3. manifest: trait dictionaries + compact rows [tokenId, n, ...valueIdx]
const traitNames = []
const dict = {}
for (const m of metas) for (const a of m.attributes) {
  if (!dict[a.trait_type]) { dict[a.trait_type] = []; traitNames.push(a.trait_type) }
  if (!dict[a.trait_type].includes(a.value)) dict[a.trait_type].push(a.value)
}
const rows = metas.map((m, i) => {
  const id = i + 1
  const byName = Object.fromEntries(m.attributes.map(a => [a.trait_type, a.value]))
  return [id, fileOf(id), ...traitNames.map(t => (t in byName ? dict[t].indexOf(byName[t]) : -1))]
})
const imgBases = new Set(metas.map(m => m.image.replace('ipfs://', '').replace(/\/[^/]+$/, '')))
const manifest = { contract: NFT, chainId: 143, supply: SUPPLY, metaBase, imageBase: [...imgBases][0], traits: traitNames, values: traitNames.map(t => dict[t]), rows }
await fs.writeFile(path.join(OUT_DATA, 'chogs.json'), JSON.stringify(manifest))
console.log('manifest ok:', traitNames.join(', '))
for (const t of traitNames) console.log(`  ${t}: ${dict[t].length} values`)

// 4. thumbnails
if (withImages) {
  const sharp = (await import('sharp')).default
  await fs.mkdir(OUT_IMG, { recursive: true })
  console.log('thumbnails')
  await pool(metas, 8, async m => {
    const ext = m.image.split('.').pop()
    const n = Number(m.name.match(/#(\d+)/)[1])
    const out = path.join(OUT_IMG, n + '.webp')
    try { await fs.access(out); return } catch {}
    const src = path.join(CACHE, 'img', n + '.' + ext)
    let buf
    try { buf = await fs.readFile(src) } catch { buf = await getBuf(m.image.replace('ipfs://', '')); await fs.writeFile(src, buf) }
    await sharp(buf).resize(192, 192, { fit: 'cover' }).webp({ quality: 82 }).toFile(out)
  })
  console.log('thumbnails done')
}
