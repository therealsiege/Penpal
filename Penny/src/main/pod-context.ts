/**
 * pod-context.ts — Scoped context injection for pods.
 *
 * Instead of injecting the full CLAUDE.md blob, this module builds
 * task-specific context: only relevant files, their recent git history,
 * and matching CLAUDE.md sections.
 *
 * Inspired by Dossier's "feature card" approach — agents get exactly
 * what they need, nothing more.
 */

import { execFileSync, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface ScopedContext {
  relevantFiles: string[]
  recentChanges: string
  architectureNotes: string
  activeConflicts: string
}

// ── File Detection ──────────────────────────────────────────────────────────

const FILE_EXTENSIONS = /\.(ts|tsx|js|jsx|json|yaml|yml|md|css)$/
const PATH_LIKE = /(?:src\/|public\/|tests\/|agents\/|data\/|scripts\/)[\w/.-]+\.\w+/g
const MODULE_KEYWORDS = /\b([\w-]+)\.(ts|tsx)\b/g

/**
 * Extract likely-relevant file paths from a task description.
 * Looks for explicit paths, module names, and infers from keywords.
 */
export function detectRelevantFiles(task: string, cwd: string): string[] {
  const files = new Set<string>()

  // 1. Explicit paths (src/main/pods.ts, etc.)
  let match: RegExpExecArray | null
  const pathRe = new RegExp(PATH_LIKE.source, 'g')
  while ((match = pathRe.exec(task)) !== null) {
    files.add(match[0])
  }

  // 2. Module references (e.g., "audio-manager.ts", "path-walker.ts")
  const modRe = new RegExp(MODULE_KEYWORDS.source, 'g')
  while ((match = modRe.exec(task)) !== null) {
    const candidate = match[0]
    if (FILE_EXTENSIONS.test(candidate)) {
      files.add(candidate)
    }
  }

  // 3. Keyword-based inference for well-known modules
  const moduleMap: Record<string, string[]> = {
    'tween': ['workstation-animation.ts', 'office-types.ts'],
    'audio': ['audio-manager.ts', 'sound-engine.ts'],
    'particle': ['office-particles.ts', 'particles-weather.ts', 'particles-ambient.ts'],
    'walk': ['path-walker.ts', 'nav-mesh.ts'],
    'pod': ['pods.ts', 'pod-cli.ts'],
    'celebration': ['celebrations.ts'],
    'workstation': ['workstation-animation.ts', 'workstation-creation.ts', 'office-workstation.ts'],
    'theme': ['office-theme.ts'],
    'camera': ['camera-cinematics.ts', 'office-camera.ts'],
    'quest': ['quest-system.ts'],
    'season': ['seasons.ts', 'season-hud.ts'],
    'leaderboard': ['leaderboard.ts'],
    'credit': ['credits.ts'],
    'room': ['office-rooms.ts', 'office-background.ts'],
    'cafe': ['penny-cafe.ts', 'cafe-coffee-run.ts'],
    'settings': ['office-settings.ts'],
    'replay': ['session-replay.ts'],
    'player': ['player-controller.ts'],
    'dialog': ['npc-dialog.ts', 'npc-interaction.ts'],
  }

  const taskLower = task.toLowerCase()
  for (const [keyword, modules] of Object.entries(moduleMap)) {
    if (taskLower.includes(keyword)) {
      for (const mod of modules) files.add(mod)
    }
  }

  return Array.from(files).slice(0, 15)
}

// ── CLAUDE.md Section Scoring ───────────────────────────────────────────────

interface Section {
  header: string
  content: string
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { header: line.replace(/^## /, ''), content: '' }
    } else if (current) {
      current.content += line + '\n'
    }
  }
  if (current) sections.push(current)
  return sections
}

function scoreSection(section: Section, task: string, files: string[]): number {
  const text = (section.header + ' ' + section.content).toLowerCase()
  const taskWords = task.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  let score = 0

  // Keyword overlap with task
  for (const word of taskWords) {
    if (text.includes(word)) score += 2
  }

  // File name overlap
  for (const file of files) {
    const base = path.basename(file, path.extname(file))
    if (text.includes(base.toLowerCase())) score += 5
  }

  return score
}

/**
 * Extract only the relevant sections from CLAUDE.md for a given task.
 * Returns top N sections by relevance score.
 */
export function extractRelevantSections(claudeMdContent: string, task: string, files: string[], maxSections = 4): string {
  const sections = parseSections(claudeMdContent)
  if (sections.length === 0) return claudeMdContent

  // Always include Stack and Directory Structure (tiny, always useful)
  const alwaysInclude = new Set(['Stack', 'Directory Structure'])

  const scored = sections
    .map(s => ({ section: s, score: scoreSection(s, task, files) }))
    .sort((a, b) => b.score - a.score)

  const included: Section[] = []
  const includedHeaders = new Set<string>()

  // Add always-include first
  for (const s of sections) {
    if (alwaysInclude.has(s.header)) {
      included.push(s)
      includedHeaders.add(s.header)
    }
  }

  // Add top scored sections
  for (const { section, score } of scored) {
    if (included.length >= maxSections) break
    if (includedHeaders.has(section.header)) continue
    if (score === 0) continue
    included.push(section)
    includedHeaders.add(section.header)
  }

  // If nothing scored, include first 3 sections as fallback
  if (included.length <= 2) {
    for (const s of sections.slice(0, 3)) {
      if (!includedHeaders.has(s.header)) {
        included.push(s)
        includedHeaders.add(s.header)
      }
    }
  }

  return included.map(s => `## ${s.header}\n${s.content.trim()}`).join('\n\n')
}

// ── Git Context (file-specific) ─────────────────────────────────────────────

function getFileSpecificHistory(files: string[], cwd: string): string {
  if (files.length === 0) return ''
  const gitOpts = { cwd, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 10_000 }

  try {
    // Use execFileSync to avoid shell injection from task-derived file paths
    const args = ['log', '--oneline', '-10', '--', ...files]
    const log = execFileSync('git', args, gitOpts).toString().trim()
    return log || '(no history)'
  } catch {
    return ''
  }
}

function getActivePodBranches(cwd: string): string {
  try {
    const gitOpts = { cwd, encoding: 'utf-8' as const, stdio: 'pipe' as const, timeout: 10_000 }
    return execFileSync('git', ['branch', '-r', '--list', 'origin/pod-*'], gitOpts).toString().trim() || '(none)'
  } catch {
    return ''
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build scoped context for a pod task.
 * Returns structured context with only relevant information.
 */
export function buildScopedContext(task: string, cwd: string, claudeMdPath?: string): ScopedContext {
  const relevantFiles = detectRelevantFiles(task, cwd)

  // Load and filter CLAUDE.md
  let architectureNotes = ''
  const mdPath = claudeMdPath ?? findClaudeMd(cwd)
  if (mdPath && fs.existsSync(mdPath)) {
    const fullContent = fs.readFileSync(mdPath, 'utf-8')
    architectureNotes = extractRelevantSections(fullContent, task, relevantFiles)
  }

  const recentChanges = getFileSpecificHistory(relevantFiles, cwd)
  const activeConflicts = getActivePodBranches(cwd)

  return { relevantFiles, recentChanges, architectureNotes, activeConflicts }
}

/**
 * Format scoped context as markdown for injection into a worktree CLAUDE.md.
 */
export function formatScopedContext(ctx: ScopedContext, task: string): string {
  const sections: string[] = []

  sections.push('# Pod Task Context (auto-scoped)')
  sections.push('')
  sections.push(`**Task**: ${task}`)
  sections.push('')

  if (ctx.architectureNotes) {
    sections.push(ctx.architectureNotes)
    sections.push('')
  }

  if (ctx.relevantFiles.length > 0) {
    sections.push('## Relevant Files')
    sections.push('```')
    sections.push(ctx.relevantFiles.join('\n'))
    sections.push('```')
    sections.push('')
  }

  if (ctx.recentChanges) {
    sections.push('## Recent Changes to These Files')
    sections.push('```')
    sections.push(ctx.recentChanges)
    sections.push('```')
    sections.push('')
  }

  if (ctx.activeConflicts && ctx.activeConflicts !== '(none)') {
    sections.push('## Active Pod Branches (avoid conflicting)')
    sections.push('```')
    sections.push(ctx.activeConflicts)
    sections.push('```')
    sections.push('')
  }

  return sections.join('\n')
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function findClaudeMd(cwd: string): string | null {
  const candidates = [
    path.join(cwd, 'CLAUDE.md'),
    path.join(cwd, 'agents', 'CLAUDE.md'),
    path.join(cwd, 'Penny', 'CLAUDE.md'),
    path.join(cwd, 'Penny', 'agents', 'CLAUDE.md'),
  ]
  return candidates.find(p => fs.existsSync(p)) ?? null
}
