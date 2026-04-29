/**
 * Resolve short project labels (atlas, sidekick, …) and ~ paths to absolute filesystem paths.
 * Used by orchestrator cwd, pod defaults, and agent affinity scoring.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

function expandHomePath(p: string): string {
  const t = p.trim()
  if (t === '~') return os.homedir()
  if (t.startsWith('~/')) return path.join(os.homedir(), t.slice(2))
  return t
}

/** Atlas clone (same rules as github-issues REPOS). */
export function getAtlasRoot(): string {
  const env = process.env.PENNY_ATLAS_ROOT?.trim()
  if (env) return expandHomePath(env)
  return path.resolve(process.env.HOME || os.homedir(), 'ComSci', 'Workspace', 'graphiteatlas', 'atlas')
}

/** Penny / sidekick repo root. */
export function getSidekickRoot(): string {
  const env = process.env.PENNY_SIDEKICK_ROOT?.trim()
  if (env) return expandHomePath(env)
  return path.join(os.homedir(), 'sidekick')
}

function tryAlias(raw: string): string | null {
  const k = raw.trim().toLowerCase().replace(/\\/g, '/')
  if (k === 'atlas') return getAtlasRoot()
  if (k === 'graphiteatlas/atlas') return getAtlasRoot()
  if (k === 'penny' || k === 'sidekick') return getSidekickRoot()
  return null
}

/**
 * Turn a user or config string into an absolute path.
 * - `atlas`, `graphiteatlas/atlas` → `PENNY_ATLAS_ROOT` or default ComSci/…/atlas
 * - `penny`, `sidekick` → `PENNY_SIDEKICK_ROOT` or ~/sidekick
 * - `~/…` expanded; relative paths resolved from HOME
 */
export function resolveProjectPath(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  const aliased = tryAlias(t)
  if (aliased) return path.normalize(aliased)

  let p = expandHomePath(t)
  if (!path.isAbsolute(p)) {
    p = path.resolve(os.homedir(), p)
  }
  return path.normalize(p)
}

/** Whether two paths point at the same directory (normalized; optional realpath). */
export function pathsReferToSameRepo(a: string, b: string): boolean {
  const na = path.normalize(resolveProjectPath(a))
  const nb = path.normalize(resolveProjectPath(b))
  if (na === nb) return true
  try {
    if (fs.existsSync(na) && fs.existsSync(nb)) {
      return fs.realpathSync(na) === fs.realpathSync(nb)
    }
  } catch { /* ignore */ }
  return false
}

/** Legacy queue rows: empty project → atlas (explicit board default). */
export function migratePersistedProject(p: string | undefined): string {
  const t = (p ?? '').trim()
  if (!t) return getAtlasRoot()
  return resolveProjectPath(t)
}

/** New enqueues must not use an empty label. */
export function normalizeEnqueueProject(raw: string): string {
  const t = raw.trim()
  if (!t) {
    throw new Error(
      'Project path is required — use a label like `atlas` or `sidekick`, or an absolute path (e.g. ~/ComSci/.../atlas).',
    )
  }
  return resolveProjectPath(t)
}
