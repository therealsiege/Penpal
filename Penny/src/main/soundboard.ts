import fs from 'fs'
import path from 'path'
import { protocol } from 'electron'
import { resolveUserPath, SIDEKICK_ROOT, HOME_DIR } from './paths'

const PENNY_ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_SFX_DIR = path.join(PENNY_ROOT, 'sound-effects')
const SUPPORTED_EXTENSIONS = new Set(['.mp3'])
const IGNORED_DIRS = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'out',
  'dist',
  'coverage',
])

/** Absolute paths checked before relative candidates. */
const VAULT_SFX_DIR = path.join(HOME_DIR, 'Documents', 'Sound Effects')

const CANDIDATE_DIRS = [
  'sound-effects',
  'sound effects',
  'Sound Effects',
  'sound_effects',
  'sounds',
  'sfx',
  'assets/sound effects',
  'assets/sound-effects',
  'assets/sound_effects',
  'assets/sfx',
  'resources/sound effects',
  'resources/sound-effects',
  'resources/sound_effects',
  'resources/sfx',
  'src/renderer/public/sound effects',
  'src/renderer/public/sound-effects',
  'src/renderer/public/sound_effects',
  'src/renderer/public/sounds',
  'src/renderer/public/sfx',
]

export interface SoundboardClip {
  id: string
  name: string
  relativePath: string
  absolutePath: string
  url: string
}

export interface SoundboardListing {
  directory: string
  clips: SoundboardClip[]
  source: 'configured' | 'candidate' | 'fallback-scan' | 'default'
}

function normalizeDirectory(input: string): string {
  const resolved = resolveUserPath(input)
  if (path.isAbsolute(resolved)) return path.normalize(resolved)
  return path.resolve(PENNY_ROOT, resolved)
}

function getRootCandidates(): string[] {
  const candidates = [
    PENNY_ROOT,
    process.cwd(),
    path.join(process.cwd(), 'Penny'),
    SIDEKICK_ROOT,
    path.join(SIDEKICK_ROOT, 'Penny'),
    path.join(HOME_DIR, 'sidekick'),
    path.join(HOME_DIR, 'sidekick', 'Penny'),
  ]

  const unique = new Set<string>()
  for (const value of candidates) {
    if (!value) continue
    unique.add(path.normalize(value))
  }
  return Array.from(unique).filter(isDirectory)
}

function isDirectory(fullPath: string): boolean {
  try {
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()
  } catch {
    return false
  }
}

function getConfiguredSfxDir(): string | null {
  const raw =
    process.env.PENNY_SFX_DIR ||
    process.env.PENNY_SOUND_EFFECTS_DIR ||
    process.env.PENNY_SOUNDBOARD_DIR
  if (!raw || !raw.trim()) return null
  return normalizeDirectory(raw.trim())
}

function walkAudioFiles(baseDir: string): string[] {
  const files: string[] = []
  const stack = [baseDir]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        stack.push(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function formatClipName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveScanRoot(): { directory: string; source: SoundboardListing['source'] } {
  const configured = getConfiguredSfxDir()
  if (configured && isDirectory(configured)) {
    return { directory: configured, source: 'configured' }
  }

  // Vault location (iCloud synced) — check before relative candidates
  if (isDirectory(VAULT_SFX_DIR) && walkAudioFiles(VAULT_SFX_DIR).length > 0) {
    return { directory: VAULT_SFX_DIR, source: 'candidate' }
  }

  const roots = getRootCandidates()
  const existingCandidates = roots.flatMap(root =>
    CANDIDATE_DIRS.map((candidate) => path.join(root, candidate)).filter(isDirectory),
  )

  let bestCandidateWithClips: { directory: string; clipCount: number } | null = null
  for (const candidateDir of existingCandidates) {
    const clipCount = walkAudioFiles(candidateDir).length
    if (clipCount === 0) continue
    if (!bestCandidateWithClips || clipCount > bestCandidateWithClips.clipCount) {
      bestCandidateWithClips = { directory: candidateDir, clipCount }
    }
  }
  if (bestCandidateWithClips) {
    return { directory: bestCandidateWithClips.directory, source: 'candidate' }
  }

  for (const root of roots) {
    const fallbackFiles = walkAudioFiles(root)
    if (fallbackFiles.length > 0) {
      return { directory: root, source: 'fallback-scan' }
    }
  }

  if (existingCandidates.length > 0) {
    return { directory: existingCandidates[0], source: 'candidate' }
  }

  const defaultDirs = [
    path.join(PENNY_ROOT, 'sound_effects'),
    path.join(PENNY_ROOT, 'sound-effects'),
    path.join(SIDEKICK_ROOT, 'Penny', 'sound_effects'),
    DEFAULT_SFX_DIR,
  ]

  for (const defaultDir of defaultDirs) {
    if (isDirectory(defaultDir)) {
      return { directory: defaultDir, source: 'default' }
    }
    try {
      fs.mkdirSync(defaultDir, { recursive: true })
      return { directory: defaultDir, source: 'default' }
    } catch {
      // try next candidate
    }
  }

  return { directory: PENNY_ROOT, source: 'fallback-scan' }
}

export function listSoundboardClips(): SoundboardListing {
  const { directory, source } = resolveScanRoot()
  const clips = walkAudioFiles(directory)
    .map((absolutePath) => {
      const relativePath = path.relative(directory, absolutePath) || path.basename(absolutePath)
      return {
        id: relativePath.toLowerCase(),
        name: formatClipName(path.basename(absolutePath)),
        relativePath,
        absolutePath,
        url: `penny-sfx://clip/${encodeURIComponent(path.basename(absolutePath))}`,
      }
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  return {
    directory,
    source,
    clips,
  }
}

export function registerSoundboardProtocol() {
  protocol.handle('penny-sfx', (request) => {
    const url = new URL(request.url)
    // penny-sfx://clip/laugh.mp3 → pathname = /laugh.mp3
    const filename = decodeURIComponent(path.basename(url.pathname))
    if (!filename || filename.includes('..') || filename.startsWith('.')) {
      return new Response('Forbidden', { status: 403 })
    }
    const { directory } = resolveScanRoot()
    const files = walkAudioFiles(directory)
    const match = files.find(f => path.basename(f) === filename)
    if (!match) {
      return new Response('Not found', { status: 404 })
    }
    const data = fs.readFileSync(match)
    return new Response(data, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  })
}
