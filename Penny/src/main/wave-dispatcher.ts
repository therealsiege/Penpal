/**
 * Wave Dispatcher — automatically promotes issue waves for overnight pod runs.
 *
 * Issues are labeled wave-1, wave-2, etc. When all issues in wave N are done
 * (labeled agent-done or pr-ready, or closed), the dispatcher adds agent-ready
 * to all wave N+1 issues to kick off the next batch.
 *
 * Runs on the same 15s sync interval as drivePipeline.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

interface WaveIssue {
  number: number
  wave: number
  labels: string[]
  state: string
}

let lastPromotedWave = 0
let enabled = false
let repo = ''

export function startWaveDispatcher(repoSlug: string): void {
  repo = repoSlug
  enabled = true
  lastPromotedWave = 0
  console.log(`[wave-dispatcher] Started for ${repo}`)
}

export function stopWaveDispatcher(): void {
  enabled = false
  console.log('[wave-dispatcher] Stopped')
}

export function isWaveDispatcherEnabled(): boolean {
  return enabled
}

/** Called every 15s from the github-issues sync loop. */
export async function driveWaves(): Promise<void> {
  if (!enabled || !repo) return

  try {
    // Fetch all issues with any wave-* label.
    // `--label` uses AND logic (all labels must match), so we use `--search`
    // with GitHub's comma-separated label syntax which is OR.
    const { stdout } = await execFileAsync('gh', [
      'issue', 'list',
      '--repo', repo,
      '--state', 'all',
      '--search', 'label:wave-1,wave-2,wave-3,wave-4,wave-5',
      '--json', 'number,labels,state',
      '--limit', '200',
    ], { encoding: 'utf-8', timeout: 30_000 })

    const issues: { number: number; labels: { name: string }[]; state: string }[] = JSON.parse(stdout || '[]')

    // Parse wave numbers
    const waveIssues: WaveIssue[] = issues.map(i => {
      const waveLabel = i.labels.find(l => /^wave-\d+$/.test(l.name))
      const wave = waveLabel ? parseInt(waveLabel.name.split('-')[1], 10) : 0
      return {
        number: i.number,
        wave,
        labels: i.labels.map(l => l.name),
        state: i.state,
      }
    }).filter(i => i.wave > 0)

    if (waveIssues.length === 0) return

    // Group by wave
    const waves = new Map<number, WaveIssue[]>()
    for (const issue of waveIssues) {
      const list = waves.get(issue.wave) || []
      list.push(issue)
      waves.set(issue.wave, list)
    }

    // Find the highest wave where ALL issues are done
    const maxWave = Math.max(...waves.keys())
    let highestCompletedWave = 0

    for (let w = 1; w <= maxWave; w++) {
      const waveGroup = waves.get(w)
      if (!waveGroup) continue

      const allDone = waveGroup.every(i =>
        i.state === 'CLOSED' ||
        i.labels.includes('agent-done') ||
        i.labels.includes('pr-ready')
      )

      if (allDone) {
        highestCompletedWave = w
      } else {
        break // waves must complete in order
      }
    }

    // Promote the next wave if it hasn't been promoted yet
    const nextWave = highestCompletedWave + 1
    if (highestCompletedWave > lastPromotedWave && waves.has(nextWave)) {
      const nextGroup = waves.get(nextWave)!
      const toPromote = nextGroup.filter(i =>
        i.state === 'OPEN' &&
        !i.labels.includes('agent-ready') &&
        !i.labels.includes('agent-executing') &&
        !i.labels.includes('agent-done')
      )

      for (const issue of toPromote) {
        console.log(`[wave-dispatcher] Promoting #${issue.number} (wave-${nextWave}) → agent-ready`)
        await execFileAsync('gh', [
          'issue', 'edit', String(issue.number),
          '--repo', repo,
          '--add-label', 'agent-ready',
        ], { encoding: 'utf-8', timeout: 10_000 }).catch(err => {
          console.error(`[wave-dispatcher] Failed to promote #${issue.number}:`, err)
        })
      }

      lastPromotedWave = highestCompletedWave
      console.log(`[wave-dispatcher] Wave ${highestCompletedWave} complete → promoted wave ${nextWave} (${toPromote.length} issues)`)
    }
  } catch (err) {
    console.error('[wave-dispatcher] Error:', err)
  }
}
