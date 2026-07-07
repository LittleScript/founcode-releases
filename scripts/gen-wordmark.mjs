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

// Light-theme variant: neutral (white/gray) glyphs -> dark ink; the
// colored gradient keeps its hue, slightly darkened for contrast.
const dark = Buffer.from(data)
for (let i = 0; i < dark.length; i += 4) {
  if ((dark[i + 3] ?? 0) === 0) continue
  const r = dark[i] ?? 0
  const g = dark[i + 1] ?? 0
  const b = dark[i + 2] ?? 0
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 28) {
    // Neutral pixel ("Foun" + the slash body) -> slate-900.
    dark[i] = 15
    dark[i + 1] = 23
    dark[i + 2] = 42
  } else {
    dark[i] = Math.round(r * 0.72)
    dark[i + 1] = Math.round(g * 0.72)
    dark[i + 2] = Math.round(b * 0.72)
  }
}
const outDark = await sharp(dark, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .resize({ width: 720 })
  .png()
  .toBuffer()
writeFileSync('src/renderer/assets/wordmark-dark.png', outDark)

console.log(`wordmark.png + wordmark-dark.png generated (${info.width}x${info.height} -> 720w)`)
