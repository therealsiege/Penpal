#!/usr/bin/env node
/**
 * Generate app icon from public/logo.png (the canonical Penpal mark).
 * Produces build/icon.png (1024x1024), build/icon.iconset/* + build/icon.icns,
 * resources/icon.png (1024x1024), resources/icon-512.png.
 * Uses macOS `iconutil` to assemble the .icns.
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
const LOGO_SOURCE = resolve(ROOT, 'public', 'logo.png')

async function renderFromLogo(size) {
  // Lanczos3 keeps the cartoon line-art crisp when upscaling 512 → 1024.
  return sharp(LOGO_SOURCE).resize(size, size, { kernel: sharp.kernel.lanczos3, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png()
}

async function main() {
  if (!existsSync(LOGO_SOURCE)) {
    throw new Error(`Logo source not found at ${LOGO_SOURCE}. Place a square PNG at public/logo.png.`)
  }
  mkdirSync(BUILD, { recursive: true })
  mkdirSync(RESOURCES, { recursive: true })

  console.log(`Source: ${LOGO_SOURCE}`)

  // 1024x1024 master into both build/ and resources/
  console.log('Generating icon.png (1024x1024)...')
  await (await renderFromLogo(1024)).toFile(resolve(BUILD, 'icon.png'))
  await (await renderFromLogo(1024)).toFile(resolve(RESOURCES, 'icon.png'))

  // 512x512 for dev / fallback uses
  await (await renderFromLogo(512)).toFile(resolve(RESOURCES, 'icon-512.png'))

  // iconset with all sizes for macOS .icns
  const iconsetDir = resolve(BUILD, 'icon.iconset')
  if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true })
  mkdirSync(iconsetDir, { recursive: true })

  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    console.log(`  ${size}x${size}...`)
    await (await renderFromLogo(size)).toFile(resolve(iconsetDir, `icon_${size}x${size}.png`))
    const size2x = size * 2
    if (size2x <= 1024) {
      console.log(`  ${size}x${size}@2x (${size2x}x${size2x})...`)
      await (await renderFromLogo(size2x)).toFile(resolve(iconsetDir, `icon_${size}x${size}@2x.png`))
    }
  }

  // Assemble .icns via iconutil (macOS).
  console.log('Creating icon.icns...')
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(BUILD, 'icon.icns')}"`)
    execSync(`cp "${resolve(BUILD, 'icon.icns')}" "${resolve(RESOURCES, 'icon.icns')}"`)
    console.log('icon.icns created successfully')
  } catch (e) {
    console.error('iconutil failed (may not be on macOS):', e.message)
  }

  console.log('Done! Icons generated in build/ and resources/.')
}

main().catch((err) => { console.error(err); process.exit(1) })
