#!/usr/bin/env node
/**
 * Generate app icon from SVG golden retriever design.
 * Creates icon.png (1024x1024) and all sizes needed for .icns.
 * Then uses macOS `iconutil` to create icon.icns.
 */
import sharp from 'sharp'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BUILD = resolve(ROOT, 'build')
const RESOURCES = resolve(ROOT, 'resources')

// Golden retriever sitting - vector-style SVG icon
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0f1f33"/>
    </radialGradient>
    <linearGradient id="fur" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E8B84B"/>
      <stop offset="100%" stop-color="#C4912A"/>
    </linearGradient>
    <linearGradient id="furLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F0CC6B"/>
      <stop offset="100%" stop-color="#E0A840"/>
    </linearGradient>
    <linearGradient id="furDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B07820"/>
      <stop offset="100%" stop-color="#8B5E18"/>
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="#2a5a8f" stroke-width="6"/>

  <!-- Body - main torso -->
  <ellipse cx="256" cy="340" rx="95" ry="80" fill="url(#fur)" stroke="#2a1a08" stroke-width="3"/>

  <!-- Chest/belly lighter area -->
  <ellipse cx="256" cy="355" rx="55" ry="55" fill="url(#furLight)" stroke="none"/>

  <!-- Front left leg -->
  <rect x="200" y="370" width="30" height="70" rx="12" fill="url(#fur)" stroke="#2a1a08" stroke-width="2.5"/>
  <ellipse cx="215" cy="440" rx="18" ry="10" fill="url(#furLight)" stroke="#2a1a08" stroke-width="2"/>

  <!-- Front right leg -->
  <rect x="282" y="370" width="30" height="70" rx="12" fill="url(#fur)" stroke="#2a1a08" stroke-width="2.5"/>
  <ellipse cx="297" cy="440" rx="18" ry="10" fill="url(#furLight)" stroke="#2a1a08" stroke-width="2"/>

  <!-- Tail - curved up on left side -->
  <path d="M 165 310 Q 120 260 135 210 Q 140 195 155 200 Q 165 205 160 220 Q 150 260 175 300"
        fill="url(#fur)" stroke="#2a1a08" stroke-width="2.5" stroke-linejoin="round"/>

  <!-- Head -->
  <ellipse cx="256" cy="220" rx="75" ry="68" fill="url(#fur)" stroke="#2a1a08" stroke-width="3"/>

  <!-- Head lighter area (face) -->
  <ellipse cx="256" cy="230" rx="50" ry="45" fill="url(#furLight)" stroke="none"/>

  <!-- Left ear (floppy) -->
  <ellipse cx="190" cy="195" rx="28" ry="45" transform="rotate(15, 190, 195)"
           fill="url(#furDark)" stroke="#2a1a08" stroke-width="2.5"/>
  <ellipse cx="192" cy="200" rx="16" ry="30" transform="rotate(15, 192, 200)"
           fill="url(#fur)" stroke="none"/>

  <!-- Right ear (floppy) -->
  <ellipse cx="322" cy="195" rx="28" ry="45" transform="rotate(-15, 322, 195)"
           fill="url(#furDark)" stroke="#2a1a08" stroke-width="2.5"/>
  <ellipse cx="320" cy="200" rx="16" ry="30" transform="rotate(-15, 320, 200)"
           fill="url(#fur)" stroke="none"/>

  <!-- Snout / muzzle -->
  <ellipse cx="256" cy="248" rx="32" ry="22" fill="url(#furLight)" stroke="#2a1a08" stroke-width="2"/>

  <!-- Nose -->
  <ellipse cx="256" cy="240" rx="12" ry="8" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="1"/>
  <ellipse cx="253" cy="238" rx="4" ry="2.5" fill="#444" opacity="0.6"/>

  <!-- Eyes -->
  <ellipse cx="232" cy="210" rx="10" ry="11" fill="#1a1a1a"/>
  <ellipse cx="280" cy="210" rx="10" ry="11" fill="#1a1a1a"/>
  <!-- Eye shine -->
  <circle cx="235" cy="207" r="3.5" fill="white" opacity="0.9"/>
  <circle cx="283" cy="207" r="3.5" fill="white" opacity="0.9"/>
  <!-- Brown iris ring -->
  <ellipse cx="232" cy="210" rx="10" ry="11" fill="none" stroke="#4a2a00" stroke-width="2"/>
  <ellipse cx="280" cy="210" rx="10" ry="11" fill="none" stroke="#4a2a00" stroke-width="2"/>

  <!-- Mouth - happy -->
  <path d="M 242 255 Q 256 268 270 255" fill="none" stroke="#2a1a08" stroke-width="2" stroke-linecap="round"/>

  <!-- Tongue -->
  <path d="M 250 258 Q 256 275 262 258" fill="#e06070" stroke="#c04050" stroke-width="1.5"/>

  <!-- Eyebrows -->
  <path d="M 220 198 Q 230 192 242 196" fill="none" stroke="#8B5E18" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 292 198 Q 282 192 270 196" fill="none" stroke="#8B5E18" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Collar -->
  <path d="M 200 280 Q 256 305 312 280" fill="none" stroke="#e04040" stroke-width="6" stroke-linecap="round"/>
  <circle cx="256" cy="295" r="7" fill="#FFD700" stroke="#C4912A" stroke-width="1.5"/>
</svg>`

const svgBuffer = Buffer.from(SVG)

async function main() {
  mkdirSync(BUILD, { recursive: true })
  mkdirSync(RESOURCES, { recursive: true })

  // Generate 1024x1024 master icon
  console.log('Generating icon.png (1024x1024)...')
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(resolve(BUILD, 'icon.png'))

  // Copy to resources too
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(resolve(RESOURCES, 'icon.png'))

  // Generate .ico (256x256 PNG, electron-builder handles ICO conversion usually)
  console.log('Generating icon.ico placeholder (256x256 PNG)...')
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(resolve(BUILD, 'icon.png'))

  // Generate iconset for macOS .icns
  const iconsetDir = resolve(BUILD, 'icon.iconset')
  if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true })
  mkdirSync(iconsetDir, { recursive: true })

  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    console.log(`  ${size}x${size}...`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsetDir, `icon_${size}x${size}.png`))

    // @2x variant
    const size2x = size * 2
    if (size2x <= 1024) {
      console.log(`  ${size}x${size}@2x (${size2x}x${size2x})...`)
      await sharp(svgBuffer)
        .resize(size2x, size2x)
        .png()
        .toFile(resolve(iconsetDir, `icon_${size}x${size}@2x.png`))
    }
  }

  // Use iconutil to create .icns (macOS only)
  console.log('Creating icon.icns...')
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(BUILD, 'icon.icns')}"`)
    // Also copy to resources
    execSync(`cp "${resolve(BUILD, 'icon.icns')}" "${resolve(RESOURCES, 'icon.icns')}"`)
    console.log('icon.icns created successfully')
  } catch (e) {
    console.error('iconutil failed (may not be on macOS):', e.message)
  }

  // Re-generate the 1024 master as icon.png (we overwrote it with 256 above)
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(resolve(BUILD, 'icon.png'))

  // Also generate a 512x512 for use in dev mode
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(resolve(RESOURCES, 'icon-512.png'))

  console.log('Done! Icons generated in build/ and resources/')
}

main().catch(console.error)
