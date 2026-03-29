import type { PodFailureCategory } from '../types'

export function podFailureCategoryFromError(error: string | undefined): PodFailureCategory {
  if (!error) return 'unknown'
  if (error.startsWith('Solver failed:')) return 'headless-solver'
  if (error.startsWith('Reviewer failed:')) return 'headless-reviewer'
  if (error.startsWith('Executor failed:')) return 'headless-executor'
  if (error === 'All solver candidates failed') return 'all-candidates-failed'
  if (error.startsWith('Reviewer rejected:')) return 'reviewer-reject'
  if (error.includes('no solver iterations remain') || error.includes('no iterations remain')) {
    return 'reviewer-feedback-no-iterations'
  }
  if (error.startsWith('Exhausted ') && error.includes('iterations without passing')) return 'exhausted-iterations'
  if (error.startsWith('Working directory') || error.includes('working directory')) return 'invalid-cwd'
  if (error === 'Cancelled by user') return 'cancelled'
  return 'unknown'
}

export function podFailureCategoryLabel(cat: PodFailureCategory): string {
  switch (cat) {
    case 'headless-solver':
      return 'Solver (headless)'
    case 'headless-reviewer':
      return 'Reviewer (headless)'
    case 'headless-executor':
      return 'Executor (headless)'
    case 'all-candidates-failed':
      return 'All candidates failed'
    case 'reviewer-reject':
      return 'Reviewer rejected'
    case 'reviewer-feedback-no-iterations':
      return 'No iterations left'
    case 'exhausted-iterations':
      return 'Iterations exhausted'
    case 'invalid-cwd':
      return 'Invalid cwd'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Other'
  }
}

export function podFailureHint(cat: PodFailureCategory): string {
  switch (cat) {
    case 'headless-solver':
    case 'headless-reviewer':
    case 'headless-executor':
      return 'Check PENNY_TASK_RUNNER, PATH, and auth (e.g. CURSOR_API_KEY for Cursor agent). See main logs for stderr.'
    case 'all-candidates-failed':
      return 'Every parallel solver run failed; inspect logs for spawn timeouts or auth errors.'
    case 'reviewer-reject':
      return 'Reviewer returned reject; adjust task or reviewer agent.'
    case 'reviewer-feedback-no-iterations':
      return 'Increase max iterations or relax reviewer so it approves on the first pass.'
    case 'exhausted-iterations':
      return 'Executor never reported QA pass. Inspect output below; ensure RESULT: PASS appears and no stray FAIL.'
    case 'invalid-cwd':
      return 'Pick a folder that exists on disk and matches the repo you intend to edit.'
    case 'cancelled':
      return 'Workflow was cancelled by user.'
    default:
      return 'See error message below.'
  }
}
