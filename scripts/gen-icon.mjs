// Generates the app icons from the OFFICIAL logo (build/logo-source.png):
//   build/icon.png            512px (electron-builder fallback / linux)
//   build/icon.ico            multi-size ICO (256/128/64/48/32/16, PNG-embedded)
//   src/renderer/assets/logo.png  trimmed logo for in-app use
// The source has generous transparent margins; small icon sizes need a
// tight crop to stay legible, so we trim and re-pad slightly.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

if (!existsSync('build/logo-source.png')) {
  console.error('build/logo-source.png missing — add the official logo first.')
  process.exit(1)
}

mkdirSync('build', { recursive: true })
mkdirSync('src/renderer/assets', { recursive: true })

// Tight-trim the margins, then mask with a rounded rectangle so the
// black background corners (outside the tile's curve) become
// transparent, and finally add a little breathing room back.
const trimmed = await sharp('build/logo-source.png').trim().toBuffer()
const meta = await sharp(trimmed).metadata()
const w = meta.width ?? 0
const h = meta.height ?? 0
// The tile's corner radius is ~22.5% of its width.
const radius = Math.round(Math.min(w, h) * 0.225)
const mask = Buffer.from(
  `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" fill="#fff"/></svg>`,
)
const rounded = await sharp(trimmed)
  .composite([{ input: mask, blend: 'dest-in' }])
  .toBuffer()

const pad = Math.round(Math.max(w, h) * 0.04)
const squared = await sharp(rounded)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()

async function pngAt(size) {
  return sharp(squared)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

// icon.png (512) + in-app logo
writeFileSync('build/icon.png', await pngAt(512))
writeFileSync('src/renderer/assets/logo.png', await pngAt(256))

// Multi-size ICO container with PNG-compressed entries (valid on Vista+).
const sizes = [256, 128, 64, 48, 32, 16]
const images = await Promise.all(sizes.map(pngAt))

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)

const entries = []
let offset = 6 + images.length * 16
images.forEach((img, i) => {
  const size = sizes[i]
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size === 256 ? 0 : size, 0) // width (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1) // height
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(img.length, 8)
  entry.writeUInt32LE(offset, 12)
  entries.push(entry)
  offset += img.length
})

writeFileSync('build/icon.ico', Buffer.concat([header, ...entries, ...images]))
console.log('generated: build/icon.png, build/icon.ico (6 sizes), src/renderer/assets/logo.png')
