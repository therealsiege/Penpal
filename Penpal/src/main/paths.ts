import fs from 'fs'
import os from 'os'
import path from 'path'

export const HOME_DIR = os.homedir()

let cachedDevCheckout: string | null | undefined = undefined

/**
 * Detects a developer checkout of Penpal at SIDEKICK_ROOT/Penpal/.
 * Used by the packaged .app to pick up the user's existing data/, .env,
 * and analytics/ from their `npm run dev` tree — Penpal is internal
 * tooling, so "compiled .app + dev analytics service" is the canonical
 * runtime for the maintainer.
 *
 * Returns the absolute path to the Penpal/ dir, or null if no valid
 * checkout exists at that location.
 */
export function findDevCheckout(): string | null {
  if (cachedDevCheckout !== undefined) return cachedDevCheckout
  const root = process.env.SIDEKICK_ROOT
    ? path.resolve(process.env.SIDEKICK_ROOT)
    : path.join(HOME_DIR, 'sidekick')
  const candidate = path.join(root, 'Penpal')
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'), 'utf-8'))
    if (pkg?.name === 'penpal') {
      cachedDevCheckout = candidate
      return cachedDevCheckout
    }
  } catch {
    /* not a valid checkout */
  }
  cachedDevCheckout = null
  return null
}

export function resolveUserPath(input: string): string {
  const value = input.trim()
  if (!value) return value

  if (value === '~') return HOME_DIR
  if (value.startsWith('~/')) {
    return path.join(HOME_DIR, value.slice(2))
  }

  const usersPrefixMatch = value.match(/^\/Users\/[^/]+(\/.*)?$/)
  if (usersPrefixMatch) {
    const suffix = (usersPrefixMatch[1] || '').replace(/^\/+/, '')
    return suffix ? path.join(HOME_DIR, suffix) : HOME_DIR
  }

  return value
}

const configuredSidekickRoot = process.env.SIDEKICK_ROOT
  ? resolveUserPath(process.env.SIDEKICK_ROOT)
  : path.join(HOME_DIR, 'sidekick')

const vaultRoot = process.env.VAULT_PATH
  ? resolveUserPath(process.env.VAULT_PATH)
  : path.join(HOME_DIR, 'Documents', 'Vault')

const configuredDocsRoot = process.env.SIDEKICK_DOCS_ROOT
  ? resolveUserPath(process.env.SIDEKICK_DOCS_ROOT)
  : vaultRoot

export const SIDEKICK_ROOT = path.resolve(configuredSidekickRoot)
export const DOCS_ROOT = path.resolve(configuredDocsRoot)

export interface SystemPaths {
  homeDir: string
  sidekickRoot: string
  docsRoot: string
}

export function getSystemPaths(): SystemPaths {
  return {
    homeDir: HOME_DIR,
    sidekickRoot: SIDEKICK_ROOT,
    docsRoot: DOCS_ROOT,
  }
}
