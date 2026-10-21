// Builds web/public/data/chogs.json.
// tokenId -> "#n" comes from tokenURI() on the real contract. Traits come from the contract's own IPFS metadata
// (scripts/.cache/meta, filled by build-data.mjs); anything not fetched yet falls back to a community mirror
// passed with --mirror <file> and is counted in the output so it can be re-verified later.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'

const here = path.dirname(fileURLToPath(import.meta.url))
const NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
const SUPPLY = 1969
const mirrorPath = process.argv[process.argv.indexOf('--mirror') + 1]
const client = createPublicClient({ transport: http('https://rpc.monad.xyz') })
const abi = parseAbi(['function tokenURI(uint256) view returns (string)'])

const mirror = mirrorPath && process.argv.includes('--mirror') ? JSON.parse(await fs.readFile(mirrorPath, 'utf8')) : null
const mirrorByN = mirror ? Object.fromEntries(Object.values(mirror).map(v => [v.n, v.traits])) : {}

const uris = {}
for (let s = 1; s <= SUPPLY; s += 250) {
  const ids = Array.from({ length: Math.min(250, SUPPLY - s + 1) }, (_, i) => s + i)
  const res = await client.multicall({
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    allowFailure: false,
    contracts: ids.map(id => ({ address: NFT, abi, functionName: 'tokenURI', args: [BigInt(id)] })),
  })
  ids.forEach((id, i) => (uris[id] = res[i]))
}
const nOf = id => Number(uris[id].match(/\/(\d+)\.json$/)[1])

let first = 0, mirrored = 0, mismatched = 0
const perId = []
for (let id = 1; id <= SUPPLY; id++) {
  const n = nOf(id)
  let traits = null
  try {
    const m = JSON.parse(await fs.readFile(path.join(here, '.cache/meta', n + '.json'), 'utf8'))
    traits = Object.fromEntries(m.attributes.map(a => [a.trait_type, a.value]))
    first++
    if (mirrorByN[n] && JSON.stringify(mirrorByN[n]) !== JSON.stringify(traits) && JSON.stringify(Object.entries(mirrorByN[n]).sort()) !== JSON.stringify(Object.entries(traits).sort())) mismatched++
  } catch {
    traits = mirrorByN[n]
    if (!traits) throw new Error(`no traits for token ${id} (#${n}); run build-data.mjs or pass --mirror`)
    mirrored++
  }
  perId.push({ id, n, traits })
}

const traitNames = []
const dict = {}
for (const { traits } of perId) for (const [k, v] of Object.entries(traits)) {
  if (!dict[k]) { dict[k] = []; traitNames.push(k) }
  if (!dict[k].includes(v)) dict[k].push(v)
}
const rows = perId.map(({ id, n, traits }) => [id, n, ...traitNames.map(t => (t in traits ? dict[t].indexOf(traits[t]) : -1))])
const manifest = { contract: NFT, chainId: 143, supply: SUPPLY, traits: traitNames, values: traitNames.map(t => dict[t]), rows }
const out = path.join(here, '../web/public/data/chogs.json')
await fs.mkdir(path.dirname(out), { recursive: true })
await fs.writeFile(out, JSON.stringify(manifest))
console.log(`manifest: ${SUPPLY} tokens | ${first} from the contract's IPFS metadata, ${mirrored} from mirror | ${mismatched} mirror mismatches in the overlap`)
console.log('traits:', traitNames.map(t => `${t}(${dict[t].length})`).join(' '))
