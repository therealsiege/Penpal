/**
 * merge-queue.ts — Sequential rebase-test-merge pipeline (Refinery).
 *
 * Pod PRs enqueue here after completion. The queue processes one at a time:
 * rebase onto latest main, type-check, fast-forward merge, push.
 * Prevents the conflict cascade from concurrent pod PRs.
 *
 * Inspired by gastown's "Refinery" (Bors-style merge queue).
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getDataDir } from './data-paths'

// ── Types ───────────────────────────────────────────────────────────────────

export type MergeQueueStatus = 'queued' | 'testing' | 'merging' | 'merged' | 'failed' | 'skipped'

export interface MergeQueueEntry {
  prNumber: number
  branch: string
  priority: number // Lower = merge first
  addedAt: number
  status: MergeQueueStatus
  failReason?: string
  mergedAt?: number
}

// ── Persistence ─────────────────────────────────────────────────────────────

const PERSIST_PATH = path.join(getDataDir(), 'merge-queue.json')

function loadQueue(): MergeQueueEntry[] {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, 'utf-8').trim()
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    }
  } catch (err) {
    console.warn('[merge-queue] Failed to load:', err)
  }
  return []
}

function saveQueue(entries: MergeQueueEntry[]): void {
  try {
    const dir = path.dirname(PERSIST_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // Only keep last 50 entries (merged/failed/skipped included for history)
    const trimmed = entries.slice(-50)
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(trimmed, null, 2))
  } catch (err) {
    console.error('[merge-queue] Failed to save:', err)
  }
}

// ── Git Helpers ─────────────────────────────────────────────────────────────

const GIT_TIMEOUT = 60_000

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: GIT_TIMEOUT,
  }).trim()
}

function gh(args: string[], cwd: string): string {
  return execFileSync('gh', args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: GIT_TIMEOUT,
  }).trim()
}

// ── MergeQueue Class ────────────────────────────────────────────────────────

export class MergeQueue {
  private entries: MergeQueueEntry[]
  private repoCwd: string

  constructor(repoCwd: string) {
    this.repoCwd = repoCwd
    this.entries = loadQueue()
  }

  add(entry: Pick<MergeQueueEntry, 'prNumber' | 'branch' | 'priority'>): MergeQueueEntry {
    // Deduplicate by PR number
    const existing = this.entries.find(e => e.prNumber === entry.prNumber && e.status === 'queued')
    if (existing) {
      console.log(`[merge-queue] PR #${entry.prNumber} already queued`)
      return existing
    }

    const full: MergeQueueEntry = {
      ...entry,
      addedAt: Date.now(),
      status: 'queued',
    }
    this.entries.push(full)
    saveQueue(this.entries)
    console.log(`[merge-queue] Queued PR #${entry.prNumber} (branch: ${entry.branch}, priority: ${entry.priority})`)
    return full
  }

  remove(prNumber: number): boolean {
    const idx = this.entries.findIndex(e => e.prNumber === prNumber && e.status === 'queued')
    if (idx === -1) return false
    this.entries.splice(idx, 1)
    saveQueue(this.entries)
    return true
  }

  list(): MergeQueueEntry[] {
    return [...this.entries]
  }

  pending(): MergeQueueEntry[] {
    return this.entries
      .filter(e => e.status === 'queued')
      .sort((a, b) => a.priority - b.priority || a.addedAt - b.addedAt)
  }

  /**
   * Process the next queued entry: rebase, type-check, merge, push.
   * Returns the processed entry, or null if queue is empty.
   */
  processNext(): MergeQueueEntry | null {
    const next = this.pending()[0]
    if (!next) return null

    console.log(`[merge-queue] Processing PR #${next.prNumber} (branch: ${next.branch})`)
    next.status = 'testing'
    saveQueue(this.entries)

    try {
      // 1. Fetch latest
      git(['fetch', 'origin', 'main', next.branch], this.repoCwd)

      // 2. Check out the branch
      git(['checkout', next.branch], this.repoCwd)

      // 3. Rebase onto latest main
      try {
        git(['rebase', 'origin/main'], this.repoCwd)
      } catch {
        try { git(['rebase', '--abort'], this.repoCwd) } catch { /* */ }
        next.status = 'failed'
        next.failReason = 'Rebase conflict onto main'
        saveQueue(this.entries)
        git(['checkout', 'main'], this.repoCwd)
        console.warn(`[merge-queue] PR #${next.prNumber} failed: rebase conflict`)
        return next
      }

      // 4. Type-check
      try {
        execFileSync('npx', ['tsc', '--noEmit'], {
          cwd: this.repoCwd,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 120_000,
        })
      } catch (err) {
        next.status = 'failed'
        next.failReason = `TypeScript compilation failed: ${(err as Error).message?.slice(0, 200)}`
        saveQueue(this.entries)
        git(['checkout', 'main'], this.repoCwd)
        console.warn(`[merge-queue] PR #${next.prNumber} failed: tsc error`)
        return next
      }

      // 4b. Scan for duplicate class members (catches squash-merge artifacts)
      const dupeIssues = detectDuplicateMembers(this.repoCwd, next.branch)
      if (dupeIssues.length > 0) {
        next.status = 'failed'
        next.failReason = `Duplicate class members detected: ${dupeIssues.slice(0, 3).join('; ')}`
        saveQueue(this.entries)
        git(['checkout', 'main'], this.repoCwd)
        console.warn(`[merge-queue] PR #${next.prNumber} failed: duplicate members — ${dupeIssues.join(', ')}`)
        return next
      }

      // 5. Switch to main, merge with fast-forward
      next.status = 'merging'
      saveQueue(this.entries)

      git(['checkout', 'main'], this.repoCwd)
      try {
        git(['merge', '--ff-only', next.branch], this.repoCwd)
      } catch {
        // ff-only failed — try regular merge
        try {
          git(['merge', '--no-edit', next.branch], this.repoCwd)
        } catch {
          next.status = 'failed'
          next.failReason = 'Merge failed (not fast-forwardable and has conflicts)'
          saveQueue(this.entries)
          console.warn(`[merge-queue] PR #${next.prNumber} failed: merge conflict`)
          return next
        }
      }

      // 6. Push main
      git(['push', 'origin', 'main'], this.repoCwd)

      // 7. Close PR with comment
      try {
        gh(['pr', 'close', String(next.prNumber), '--comment', 'Merged via refinery merge queue'], this.repoCwd)
      } catch {
        // Non-fatal — PR may already be closed by GitHub's branch merge detection
      }

      // 8. Clean up remote branch
      try {
        git(['push', 'origin', '--delete', next.branch], this.repoCwd)
      } catch { /* non-fatal */ }

      next.status = 'merged'
      next.mergedAt = Date.now()
      saveQueue(this.entries)
      console.log(`[merge-queue] PR #${next.prNumber} merged successfully`)
      return next
    } catch (err) {
      next.status = 'failed'
      next.failReason = `Unexpected error: ${(err as Error).message?.slice(0, 200)}`
      saveQueue(this.entries)
      // Ensure we're back on main
      try { git(['checkout', 'main'], this.repoCwd) } catch { /* */ }
      console.error(`[merge-queue] PR #${next.prNumber} failed:`, err)
      return next
    }
  }

  /**
   * Drain the entire queue, processing entries sequentially.
   * Returns array of all processed entries.
   */
  processAll(): MergeQueueEntry[] {
    const results: MergeQueueEntry[] = []
    let entry: MergeQueueEntry | null

    while ((entry = this.processNext()) !== null) {
      results.push(entry)
      if (entry.status === 'failed') {
        console.warn(`[merge-queue] Skipping remaining entries after failure on PR #${entry.prNumber}`)
        // Don't stop — continue with next entry. Failures are isolated.
      }
    }

    if (results.length === 0) {
      console.log('[merge-queue] Queue empty — nothing to process')
    } else {
      const merged = results.filter(e => e.status === 'merged').length
      const failed = results.filter(e => e.status === 'failed').length
      console.log(`[merge-queue] Done: ${merged} merged, ${failed} failed out of ${results.length} total`)
    }

    return results
  }

  /**
   * Get queue statistics.
   */
  stats(): { queued: number; merged: number; failed: number } {
    return {
      queued: this.entries.filter(e => e.status === 'queued').length,
      merged: this.entries.filter(e => e.status === 'merged').length,
      failed: this.entries.filter(e => e.status === 'failed').length,
    }
  }
}

// ── Post-merge validation ─────────────────────────────────────────────────

/**
 * Scan TypeScript files changed on `branch` (vs main) for duplicate class
 * members. Returns an array of human-readable issue strings, empty if clean.
 *
 * Catches the squash-merge artifact pattern where both the original and
 * merged version of a method/field end up in the same class body.
 */
function detectDuplicateMembers(repoCwd: string, branch: string): string[] {
  const issues: string[] = []

  // Get list of .ts files changed on this branch vs main
  let changedFiles: string[]
  try {
    const diff = execFileSync('git', ['diff', '--name-only', 'main', branch, '--', '*.ts'], {
      cwd: repoCwd, encoding: 'utf-8', stdio: 'pipe',
    }).trim()
    changedFiles = diff ? diff.split('\n').filter(f => f.endsWith('.ts')) : []
  } catch {
    return [] // can't diff — skip check
  }

  for (const file of changedFiles) {
    let content: string
    try {
      content = execFileSync('git', ['show', `${branch}:${file}`], {
        cwd: repoCwd, encoding: 'utf-8', stdio: 'pipe',
      })
    } catch { continue }

    // Find class method/field declarations and check for duplicates
    const members = new Map<string, number>()
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      // Match: optional access modifier + optional async/static + method name + ( or :
      const m = lines[i].match(/^\s{2,4}(?:private |public |protected )?(?:readonly )?(?:async |static |get |set )?([a-zA-Z_]\w*)\s*[\(:<]/)
      if (!m) continue
      const name = m[1]
      // Skip keywords that look like method names
      if (['if', 'for', 'while', 'switch', 'return', 'throw', 'new', 'const', 'let', 'var', 'else', 'catch', 'try', 'import', 'export', 'class', 'interface', 'type', 'function', 'constructor'].includes(name)) continue

      const prev = members.get(name)
      if (prev !== undefined) {
        issues.push(`${file}: duplicate "${name}" at lines ${prev + 1} and ${i + 1}`)
      } else {
        members.set(name, i)
      }
    }
  }

  return issues
}
