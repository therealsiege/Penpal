import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const workflowPath = resolve(__dirname, '../../../.github/workflows/test.yml')
const workflowContent = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf-8') : ''

describe('CI workflow (.github/workflows/test.yml)', () => {
  it('exists', () => {
    expect(existsSync(workflowPath)).toBe(true)
  })

  it('triggers on pull_request to main', () => {
    expect(workflowContent).toContain('pull_request')
    expect(workflowContent).toContain('branches: [main]')
  })

  it('sets working-directory to Penpal', () => {
    expect(workflowContent).toContain('working-directory: Penpal')
  })

  it('uses Node.js 22', () => {
    expect(workflowContent).toContain("node-version: '22'")
  })

  it('caches npm with Penpal/package-lock.json', () => {
    expect(workflowContent).toContain("cache: 'npm'")
    expect(workflowContent).toContain('cache-dependency-path: Penpal/package-lock.json')
  })

  it('runs npm ci', () => {
    expect(workflowContent).toContain('run: npm ci')
  })

  it('runs typecheck', () => {
    expect(workflowContent).toContain('npm run typecheck')
  })

  it('runs unit tests via npm test', () => {
    expect(workflowContent).toContain('run: npm test')
  })

  it('installs playwright chromium with system deps', () => {
    expect(workflowContent).toContain('npx playwright install --with-deps chromium')
  })

  it('wraps E2E tests with xvfb-run --auto-servernum', () => {
    expect(workflowContent).toContain('xvfb-run --auto-servernum npx playwright test --project=e2e')
  })

  it('uploads playwright-report artifact on failure', () => {
    expect(workflowContent).toContain("if: failure()")
    expect(workflowContent).toContain('name: playwright-report')
    expect(workflowContent).toContain('path: Penpal/playwright-report/')
    expect(workflowContent).toContain("if-no-files-found: ignore")
  })

  it('uses pinned action versions (v4)', () => {
    expect(workflowContent).toContain('actions/checkout@v4')
    expect(workflowContent).toContain('actions/setup-node@v4')
    expect(workflowContent).toContain('actions/upload-artifact@v4')
  })

  it('runs on ubuntu-latest', () => {
    expect(workflowContent).toContain('runs-on: ubuntu-latest')
  })
})
