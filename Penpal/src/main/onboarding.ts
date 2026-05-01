/**
 * Onboarding module — reads/writes ~/.penpal/config.json and Penpal/.env
 * to track first-run state and persist API keys.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'

function isGitRepo(dirPath: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: dirPath, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// ELECTRON_ROOT is two levels up from src/main (or out/main in production)
const ELECTRON_ROOT = path.resolve(__dirname, '..', '..')
const ENV_PATH = path.join(ELECTRON_ROOT, '.env')
const CONFIG_PATH = path.join(os.homedir(), '.penpal', 'config.json')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnboardingStatus {
  complete: boolean
  hasAnthropicKey: boolean
  hasGithubToken: boolean
  hasLinearKey: boolean
}

export interface OnboardingSavePayload {
  anthropicKey: string
  githubToken: string
  linearKey: string
  addGithubRepo?: { owner: string; repo: string; localPath: string }
}

// ── Config helpers ────────────────────────────────────────────────────────────

function readConfig(): Record<string, unknown> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
    }
  } catch { /* ignore parse errors */ }
  return {}
}

function writeConfig(data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// ── .env helpers ──────────────────────────────────────────────────────────────

/**
 * Parse existing .env file into a key-order-preserving map.
 * Lines that are not KEY=VALUE (blanks, comments) are preserved verbatim.
 */
function readEnvLines(): string[] {
  try {
    if (fs.existsSync(ENV_PATH)) {
      return fs.readFileSync(ENV_PATH, 'utf-8').split('\n')
    }
  } catch { /* file missing or unreadable */ }
  return []
}

function mergeEnvLines(existing: string[], updates: Record<string, string>): string[] {
  const remaining = { ...updates }
  const merged: string[] = []

  for (const line of existing) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      const key = match[1]
      if (key in remaining) {
        // Replace the existing line with the updated value
        merged.push(`${key}=${remaining[key]}`)
        delete remaining[key]
      } else {
        merged.push(line)
      }
    } else {
      merged.push(line)
    }
  }

  // Append any keys that were not already present
  for (const [key, value] of Object.entries(remaining)) {
    merged.push(`${key}=${value}`)
  }

  return merged
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getOnboardingStatus(): OnboardingStatus {
  const config = readConfig()
  const onboardingComplete = config.onboardingComplete === true

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const hasGithubToken = !!process.env.GITHUB_PERSONAL_ACCESS_TOKEN
  const hasLinearKey = !!process.env.LINEAR_API_KEY

  // Mark complete if the config flag is set OR all required keys are already present
  const complete = onboardingComplete || (hasAnthropicKey && hasGithubToken)

  return { complete, hasAnthropicKey, hasGithubToken, hasLinearKey }
}

export async function saveOnboarding(payload: OnboardingSavePayload): Promise<{ ok: boolean; error?: string }> {
  const { anthropicKey, githubToken, linearKey, addGithubRepo: repoToAdd } = payload

  // Validate required keys
  if (!anthropicKey || !anthropicKey.startsWith('sk-ant-')) {
    return { ok: false, error: 'Anthropic API key must start with sk-ant-' }
  }
  if (!githubToken) {
    return { ok: false, error: 'GitHub personal access token is required' }
  }

  // Reject values that contain newline characters — they would corrupt the .env file
  for (const [field, val] of [['anthropicKey', anthropicKey], ['githubToken', githubToken], ['linearKey', linearKey]] as const) {
    if (val.includes('\n') || val.includes('\r')) {
      return { ok: false, error: `${field} must not contain newline characters` }
    }
  }

  // Build the update map
  const updates: Record<string, string> = {
    ANTHROPIC_API_KEY: anthropicKey,
    GITHUB_PERSONAL_ACCESS_TOKEN: githubToken,
  }
  if (linearKey) {
    updates.LINEAR_API_KEY = linearKey
  }

  // Read existing .env, merge in new values, write back
  const existingLines = readEnvLines()
  const merged = mergeEnvLines(existingLines, updates)

  // Ensure the directory exists (it should, but be safe)
  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true })
  const tmpPath = ENV_PATH + '.tmp'
  fs.writeFileSync(tmpPath, merged.join('\n'), 'utf-8')
  fs.renameSync(tmpPath, ENV_PATH)

  // Load new values into process.env immediately so they take effect without restart
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value
  }

  // Optionally add the first GitHub repo to the watcher
  if (repoToAdd) {
    const localPath = repoToAdd.localPath
    if (!path.isAbsolute(localPath)) {
      return { ok: false, error: `Local path is not a git repository: ${localPath}` }
    }
    if (!fs.existsSync(localPath)) {
      return { ok: false, error: `Local path is not a git repository: ${localPath}` }
    }
    if (!isGitRepo(localPath)) {
      return { ok: false, error: `Local path is not a git repository: ${localPath}` }
    }
    const m = await import('./github-issues')
    m.addWatchedRepo(repoToAdd.owner, repoToAdd.repo, localPath)
  }

  // Mark onboarding complete in config
  const config = readConfig()
  writeConfig({ ...config, onboardingComplete: true })

  return { ok: true }
}

export async function skipOnboarding(): Promise<void> {
  const config = readConfig()
  writeConfig({ ...config, onboardingComplete: true })
}
