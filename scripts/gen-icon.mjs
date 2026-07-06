// Generates build/icon.png (512x512). The OFFICIAL logo
// (build/logo-source.png, provided by Koko) takes precedence; the drawn
// SVG below is only the fallback when the source asset is missing.
// electron-builder converts the PNG to .ico for Windows automatically.
import { existsSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

if (existsSync('build/logo-source.png')) {
  mkdirSync('build', { recursive: true })
  await sharp('build/logo-source.png').resize(512, 512).png().toFile('build/icon.png')
  console.log('build/icon.png generated from official logo')
  process.exit(0)
}

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12181f"/>
      <stop offset="1" stop-color="#0a0d12"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34e8a9"/>
      <stop offset="1" stop-color="#14b886"/>
    </linearGradient>
  </defs>

  <rect x="16" y="16" width="480" height="480" rx="96" fill="url(#bg)"/>
  <rect x="16" y="16" width="480" height="480" rx="96" fill="none"
        stroke="#34e8a9" stroke-opacity="0.28" stroke-width="6"/>

  <!-- F/ monogram -->
  <g fill="none" stroke-linecap="round">
    <path d="M150 150 h130 M150 150 v212 M150 252 h96"
          stroke="#e8edf4" stroke-width="34"/>
    <path d="M368 140 L294 372" stroke="url(#glow)" stroke-width="34"/>
  </g>

  <!-- pipeline rail: plan · gate · execute · verify -->
  <g>
    <rect x="112" y="404" width="96" height="14" rx="7" fill="#4cb8ff"/>
    <rect x="230" y="404" width="14" height="14" fill="#34e8a9" transform="rotate(45 237 411)"/>
    <rect x="266" y="404" width="60" height="14" rx="7" fill="#8b8cf9"/>
    <rect x="340" y="404" width="60" height="14" rx="7" fill="#c084fc"/>
  </g>
</svg>`

mkdirSync('build', { recursive: true })
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('build/icon.png')
console.log('build/icon.png generated')
