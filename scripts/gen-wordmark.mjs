// Converts the official wordmark (white/gradient text on solid black)
// into a transparent PNG: alpha = max(r,g,b) per pixel (black-to-alpha),
// so it composites cleanly on any dark surface.
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'build/wordmark-source.png'

const { data, info } = await sharp(SRC)
  .trim()
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  data[i + 3] = Math.max(data[i], data[i + 1], data[i + 2])
}

const out = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .resize({ width: 720 })
  .png()
  .toBuffer()

writeFileSync('src/renderer/assets/wordmark.png', out)
writeFileSync('website/wordmark.png', out)
console.log(`wordmark.png generated (${info.width}x${info.height} -> 720w, transparent)`)
