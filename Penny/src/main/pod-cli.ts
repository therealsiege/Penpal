#!/usr/bin/env node
/**
 * Thin CLI wrapper around the pod creation logic.
 * Used by the MCP server (analytics/) to create pods without importing Electron.
 *
 * Usage:
 *   node --import tsx src/main/pod-cli.ts --task "Implement feature X" --preset frontend-feature --cwd /path/to/repo --priority high
 *
 * Outputs the created workflow JSON to stdout.
 * The workflow starts running asynchronously (headless agents) — this script
 * only returns the initial workflow state.
 */

import { createPod, type CreatePodOpts } from './pods'

function parseArgs(): { task: string; preset?: string; cwd?: string; priority?: string; candidates?: number; maxSelfFixes?: number } {
  const args = process.argv.slice(2)
  let task = ''
  let preset: string | undefined
  let cwd: string | undefined
  let priority: string | undefined
  let candidates: number | undefined
  let maxSelfFixes: number | undefined

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task':
        task = args[++i] || ''
        break
      case '--preset':
        preset = args[++i]
        break
      case '--cwd':
        cwd = args[++i]
        break
      case '--priority':
        priority = args[++i]
        break
      case '--candidates':
        candidates = parseInt(args[++i] || '1', 10)
        break
      case '--max-self-fixes':
        maxSelfFixes = parseInt(args[++i] || '0', 10)
        break
    }
  }

  if (!task) {
    console.error('Error: --task is required')
    process.exit(1)
  }

  return { task, preset, cwd, priority, candidates, maxSelfFixes }
}

async function main(): Promise<void> {
  const { task, preset, cwd, priority, candidates, maxSelfFixes } = parseArgs()

  const opts: CreatePodOpts = {}
  if (preset) opts.presetId = preset
  if (cwd) opts.cwd = cwd
  if (priority) opts.priority = priority
  if (candidates && candidates > 0) opts.solverCandidates = candidates
  if (maxSelfFixes != null) opts.maxSelfFixes = maxSelfFixes

  try {
    const workflow = createPod(task, opts)

    // Output the workflow state (before async execution completes)
    // Strip the output fields since they may be huge and aren't useful yet
    const output = {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      task: workflow.task,
      cwd: workflow.cwd,
      solver: { agentId: workflow.solver.agentId, status: workflow.solver.status },
      reviewer: { agentId: workflow.reviewer.agentId, status: workflow.reviewer.status },
      executor: { agentId: workflow.executor.agentId, status: workflow.executor.status },
      iteration: workflow.iteration,
      maxIterations: workflow.maxIterations,
      solverCandidateCount: workflow.solverCandidateCount,
      priority: workflow.priority,
      phaseConfig: workflow.phaseConfig,
      selfFixAttempts: workflow.selfFixAttempts,
      maxSelfFixes: workflow.maxSelfFixes,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }

    console.log(JSON.stringify(output))

    // Give the async workflow a moment to persist initial state, then exit
    // The headless agents will continue running in their own processes
    setTimeout(() => process.exit(0), 500)
  } catch (err) {
    console.error(JSON.stringify({ error: (err as Error).message }))
    process.exit(1)
  }
}

main()
