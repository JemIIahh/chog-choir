// Downscales the source art (scripts/.cache/mirror-art or first-party originals) into the two sizes the app uses.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const src = process.argv[2] ?? '.cache/mirror-art'
const out = '../web/public/chogs'
await fs.mkdir(path.join(out, 'lg'), { recursive: true })
const files = (await fs.readdir(src)).filter(f => f.endsWith('.webp'))
let i = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < files.length) {
    const f = files[i++]
    const buf = await fs.readFile(path.join(src, f))
    await sharp(buf).resize(128, 128).webp({ quality: 80 }).toFile(path.join(out, f))
    await sharp(buf).resize(256, 256).webp({ quality: 82 }).toFile(path.join(out, 'lg', f))
  }
}))
console.log(files.length, 'chogs resized')
