/**
 * Pixel-based visual regression: compare canvas PNG buffers to committed baselines.
 *
 * - Compare mode (default): pixelmatch + threshold from VISUAL_DIFF_THRESHOLD (default 0.01 = 1%).
 * - Update mode: VISUAL_UPDATE=1 writes baselines and skips comparison.
 */

import fs from 'fs'
import path from 'path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const BASELINE_DIR = path.join(__dirname, 'screenshots', 'baselines')
const DIFF_DIR = path.join(__dirname, 'screenshots', 'diffs')

const PIXELMATCH_THRESHOLD = 0.1

export interface VisualCompareResult {
  ok: boolean
  message: string
  diffRatio: number
  diffPixels: number
  diffPath?: string
}

function parseDiffThreshold(): number {
  const raw = process.env.VISUAL_DIFF_THRESHOLD
  if (raw === undefined || raw === '') return 0.01
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`VISUAL_DIFF_THRESHOLD must be a number in [0, 1], got: ${raw}`)
  }
  return n
}

let _loggedThreshold = false

export function logVisualThresholdOnce(): void {
  if (_loggedThreshold) return
  _loggedThreshold = true
  const t = parseDiffThreshold()
  const mode = process.env.VISUAL_UPDATE === '1' ? 'UPDATE (write baselines)' : 'COMPARE'
  console.log(`[visual-diff] mode=${mode} VISUAL_DIFF_THRESHOLD=${t} pixelmatchThreshold=${PIXELMATCH_THRESHOLD}`)
}

export function isVisualUpdateMode(): boolean {
  return process.env.VISUAL_UPDATE === '1'
}

function baselinePathFor(name: string): string {
  const safe = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return path.join(BASELINE_DIR, `${safe}.png`)
}

function diffPathFor(name: string): string {
  const safe = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return path.join(DIFF_DIR, `${safe}.png`)
}

export function compareOrUpdateVisual(name: string, current: Buffer): VisualCompareResult {
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  fs.mkdirSync(DIFF_DIR, { recursive: true })

  const baselineFile = baselinePathFor(name)
  const diffFile = diffPathFor(name)

  if (isVisualUpdateMode()) {
    fs.writeFileSync(baselineFile, current)
    if (fs.existsSync(diffFile)) {
      try {
        fs.unlinkSync(diffFile)
      } catch {
        /* ignore */
      }
    }
    return {
      ok: true,
      message: `Baseline written: ${baselineFile}`,
      diffRatio: 0,
      diffPixels: 0,
    }
  }

  if (!fs.existsSync(baselineFile)) {
    return {
      ok: false,
      message: `Missing baseline ${baselineFile}. Run: npm run test:visual:update`,
      diffRatio: 1,
      diffPixels: -1,
    }
  }

  let baselinePng: PNG
  let currentPng: PNG
  try {
    baselinePng = PNG.sync.read(fs.readFileSync(baselineFile))
    currentPng = PNG.sync.read(current)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      message: `PNG decode failed: ${msg}`,
      diffRatio: 1,
      diffPixels: -1,
    }
  }

  const { width: w1, height: h1 } = baselinePng
  const { width: w2, height: h2 } = currentPng
  if (w1 !== w2 || h1 !== h2) {
    return {
      ok: false,
      message: `Dimension mismatch baseline ${w1}x${h1} vs current ${w2}x${h2} (viewport or DPR changed). Baseline: ${baselineFile}`,
      diffRatio: 1,
      diffPixels: -1,
    }
  }

  const width = w1
  const height = h1
  const totalPixels = width * height

  const diffPng = new PNG({ width, height })
  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    width,
    height,
    { threshold: PIXELMATCH_THRESHOLD, diffMask: true },
  )

  const diffRatio = diffPixels / totalPixels
  const maxRatio = parseDiffThreshold()

  if (diffRatio <= maxRatio) {
    if (fs.existsSync(diffFile)) {
      try {
        fs.unlinkSync(diffFile)
      } catch {
        /* ignore */
      }
    }
    return {
      ok: true,
      message: `Within threshold (diffRatio=${diffRatio.toFixed(5)}, max=${maxRatio})`,
      diffRatio,
      diffPixels,
    }
  }

  fs.writeFileSync(diffFile, PNG.sync.write(diffPng))
  return {
    ok: false,
    message: `Visual diff exceeded threshold: diffRatio=${diffRatio.toFixed(5)} > ${maxRatio} (${diffPixels}/${totalPixels} pixels). Diff image: ${diffFile}`,
    diffRatio,
    diffPixels,
    diffPath: diffFile,
  }
}
