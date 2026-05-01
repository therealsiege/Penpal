// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { OnboardingScreen } from '../../src/renderer/src/components/OnboardingScreen'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === text,
  ) ?? null
}

function getInput(container: HTMLElement, id: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(`#${id}`)
}

function fireClick(el: HTMLElement) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function fireInput(el: HTMLInputElement, value: string) {
  Object.defineProperty(el, 'value', { writable: true, value })
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// Simulate a React synthetic change event by setting value then dispatching change
function setInputValue(container: HTMLElement, input: HTMLInputElement, value: string) {
  // Use nativeInputValueSetter to trigger React's synthetic event
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value)
  } else {
    ;(input as unknown as { value: string }).value = value
  }
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── Setup ──────────────────────────────────────────────────────────────────────

let container: HTMLDivElement
let root: Root
const onComplete = vi.fn()

beforeEach(() => {
  // Reset window.api mock
  ;(window as unknown as Record<string, unknown>).api = {
    onboardingSave: vi.fn().mockResolvedValue({ ok: true }),
    onboardingStatus: vi.fn().mockResolvedValue({ complete: false }),
    onboardingSkip: vi.fn().mockResolvedValue(undefined),
    pickDirectory: vi.fn().mockResolvedValue('/some/path'),
  }

  onComplete.mockReset()

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

// ── Render helper ──────────────────────────────────────────────────────────────

async function render() {
  await act(async () => {
    root.render(<OnboardingScreen onComplete={onComplete} />)
  })
}

// Helper: advance to step 1 (Anthropic key)
async function goToStep1() {
  await render()
  await act(async () => {
    const btn = getButton(container, 'Get Started')!
    fireClick(btn)
  })
}

// Helper: advance to step 2 (GitHub token)
async function goToStep2(anthropicKey = 'sk-ant-valid-key') {
  await goToStep1()
  const input = getInput(container, 'anthropic-key')!
  await act(async () => {
    setInputValue(container, input, anthropicKey)
  })
  await act(async () => {
    const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'))[0]!
    fireClick(btn)
  })
}

// Helper: advance to step 3 (Linear)
async function goToStep3(githubToken = 'ghp_validtoken') {
  await goToStep2()
  const input = getInput(container, 'github-token')!
  await act(async () => {
    setInputValue(container, input, githubToken)
  })
  await act(async () => {
    const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="submit"]'))[0]!
    fireClick(btn)
  })
}

// ── Step 0 — Welcome ───────────────────────────────────────────────────────────

describe('Step 0 — Welcome', () => {
  it('renders "Welcome to Penpal" heading', async () => {
    await render()
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Welcome to Penpal')
  })

  it('"Get Started" button is present', async () => {
    await render()
    const btn = getButton(container, 'Get Started')
    expect(btn).not.toBeNull()
  })

  it('"Get Started" button has autoFocus set (React autoFocus prop)', async () => {
    await render()
    const btn = getButton(container, 'Get Started')!
    // React 18 renders autoFocus as the autofocus HTML attribute in jsdom
    // The attribute may appear as "autofocus" (present = truthy) or as the property
    expect(
      btn.hasAttribute('autofocus') || btn.getAttribute('autofocus') !== null || btn === document.activeElement,
    ).toBe(true)
  })

  it('clicking "Get Started" advances to step 1 (shows "Anthropic API Key" heading)', async () => {
    await render()
    await act(async () => {
      fireClick(getButton(container, 'Get Started')!)
    })
    const h2 = container.querySelector('h2')
    expect(h2?.textContent).toBe('Anthropic API Key')
  })
})

// ── Step 1 — Anthropic API Key ─────────────────────────────────────────────────

describe('Step 1 — Anthropic API Key', () => {
  it('shows "Anthropic API Key" heading', async () => {
    await goToStep1()
    expect(container.querySelector('h2')?.textContent).toBe('Anthropic API Key')
  })

  it('password input #anthropic-key is present', async () => {
    await goToStep1()
    expect(getInput(container, 'anthropic-key')).not.toBeNull()
  })

  it('"Next" button is disabled when input is empty', async () => {
    await goToStep1()
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(true)
  })

  it('"Next" button is enabled when input has content', async () => {
    await goToStep1()
    const input = getInput(container, 'anthropic-key')!
    await act(async () => {
      setInputValue(container, input, 'sk-ant-abc123')
    })
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(false)
  })

  it('shows validation error when key does not start with sk-ant-', async () => {
    await goToStep1()
    const input = getInput(container, 'anthropic-key')!
    await act(async () => {
      setInputValue(container, input, 'invalid-key')
    })
    await act(async () => {
      const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
      fireClick(btn)
    })
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('sk-ant-')
  })

  it('does NOT advance to step 2 when key is invalid', async () => {
    await goToStep1()
    const input = getInput(container, 'anthropic-key')!
    await act(async () => {
      setInputValue(container, input, 'bad-key-format')
    })
    await act(async () => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })
    // Still on step 1
    expect(container.querySelector('h2')?.textContent).toBe('Anthropic API Key')
  })

  it('advances to step 2 when valid key entered and Next clicked', async () => {
    await goToStep2()
    expect(container.querySelector('h2')?.textContent).toBe('GitHub Token')
  })

  it('"Back" button returns to step 0 (Welcome)', async () => {
    await goToStep1()
    await act(async () => {
      fireClick(getButton(container, 'Back')!)
    })
    expect(container.querySelector('h1')?.textContent).toBe('Welcome to Penpal')
  })
})

// ── Step 2 — GitHub Token ─────────────────────────────────────────────────────

describe('Step 2 — GitHub Token', () => {
  it('shows "GitHub Token" heading', async () => {
    await goToStep2()
    expect(container.querySelector('h2')?.textContent).toBe('GitHub Token')
  })

  it('"Add a GitHub repo to watch" section is collapsed by default', async () => {
    await goToStep2()
    expect(container.querySelector('#repo-owner')).toBeNull()
  })

  it('clicking "Add a GitHub repo to watch" expands the section', async () => {
    await goToStep2()
    await act(async () => {
      const expandBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.includes('Add a GitHub repo'),
      )!
      fireClick(expandBtn)
    })
    expect(container.querySelector('#repo-owner')).not.toBeNull()
  })

  it('shows validation error when repo section is partially filled (owner set, repo empty)', async () => {
    await goToStep2()

    // Expand repo section
    await act(async () => {
      const expandBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.includes('Add a GitHub repo'),
      )!
      fireClick(expandBtn)
    })

    // Fill owner only
    const ownerInput = container.querySelector<HTMLInputElement>('#repo-owner')!
    await act(async () => {
      setInputValue(container, ownerInput, 'my-org')
    })

    // Fill github token so Next is enabled
    const tokenInput = getInput(container, 'github-token')!
    await act(async () => {
      setInputValue(container, tokenInput, 'ghp_token')
    })

    // Try to submit
    await act(async () => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })

    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Fill in all three fields')
  })

  it('"Next" button is disabled when GitHub token is empty', async () => {
    // Navigate to step 2 without setting a token — use render() fresh then navigate manually
    await render()
    // Step 0 → 1
    await act(async () => { fireClick(getButton(container, 'Get Started')!) })
    // Step 1: enter anthropic key, advance to step 2
    const anthropicInput = getInput(container, 'anthropic-key')!
    await act(async () => { setInputValue(container, anthropicInput, 'sk-ant-test') })
    await act(async () => { fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!) })

    // Now on step 2 with empty github token
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(true)
  })

  it('advances to step 3 when valid token entered and Next clicked', async () => {
    await goToStep3()
    expect(container.querySelector('h2')?.textContent).toBe('Linear')
  })

  it('"Back" returns to step 1', async () => {
    await goToStep2()
    await act(async () => {
      fireClick(getButton(container, 'Back')!)
    })
    expect(container.querySelector('h2')?.textContent).toBe('Anthropic API Key')
  })
})

// ── Step 3 — Linear ───────────────────────────────────────────────────────────

describe('Step 3 — Linear', () => {
  it('shows "Linear" heading and "Optional" text in field label', async () => {
    await goToStep3()
    expect(container.querySelector('h2')?.textContent).toBe('Linear')
    expect(container.textContent).toContain('Optional')
  })

  it('"Skip" button calls window.api.onboardingSave with linearKey: ""', async () => {
    await goToStep3()
    await act(async () => {
      fireClick(getButton(container, 'Skip')!)
    })
    // Allow async save to complete
    await act(async () => {
      await Promise.resolve()
    })
    const saveMock = (window as unknown as { api: { onboardingSave: ReturnType<typeof vi.fn> } }).api.onboardingSave
    expect(saveMock).toHaveBeenCalledOnce()
    const callArg = saveMock.mock.calls[0][0]
    expect(callArg.linearKey).toBe('')
  })

  it('"Finish" button calls window.api.onboardingSave with all collected data', async () => {
    await goToStep3()
    // Enter a linear key
    const linearInput = getInput(container, 'linear-key')!
    await act(async () => {
      setInputValue(container, linearInput, 'lin_api_test')
    })
    await act(async () => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })
    await act(async () => {
      await Promise.resolve()
    })
    const saveMock = (window as unknown as { api: { onboardingSave: ReturnType<typeof vi.fn> } }).api.onboardingSave
    expect(saveMock).toHaveBeenCalledOnce()
    const callArg = saveMock.mock.calls[0][0]
    expect(callArg).toMatchObject({
      anthropicKey: 'sk-ant-valid-key',
      githubToken: 'ghp_validtoken',
      linearKey: 'lin_api_test',
    })
  })

  it('shows loading spinner (Saving...) on Finish while saving', async () => {
    // Make onboardingSave hang until we resolve
    let resolvePromise!: (v: { ok: boolean }) => void
    const hanging = new Promise<{ ok: boolean }>((res) => { resolvePromise = res })
    ;(window as unknown as { api: { onboardingSave: ReturnType<typeof vi.fn> } }).api.onboardingSave =
      vi.fn().mockReturnValue(hanging)

    await goToStep3()

    // Click Finish — this starts the save (async, won't settle yet)
    act(() => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })

    // Flush synchronous React updates without resolving the promise
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Saving...')

    // Resolve to avoid open handle
    resolvePromise({ ok: true })
    await act(async () => { await Promise.resolve() })
  })

  it('calls onComplete when save returns { ok: true }', async () => {
    await goToStep3()
    await act(async () => {
      fireClick(getButton(container, 'Skip')!)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('shows error message when save returns { ok: false, error: "some error" }', async () => {
    ;(window as unknown as { api: { onboardingSave: ReturnType<typeof vi.fn> } }).api.onboardingSave =
      vi.fn().mockResolvedValue({ ok: false, error: 'some error' })

    await goToStep3()
    await act(async () => {
      fireClick(getButton(container, 'Skip')!)
    })
    await act(async () => {
      await Promise.resolve()
    })

    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('some error')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('"Back" returns to step 2', async () => {
    await goToStep3()
    await act(async () => {
      fireClick(getButton(container, 'Back')!)
    })
    expect(container.querySelector('h2')?.textContent).toBe('GitHub Token')
  })
})

// ── Full Flow ─────────────────────────────────────────────────────────────────

describe('Full flow', () => {
  it('welcome → valid anthropic key → valid github token → skip linear → calls onComplete', async () => {
    await render()

    // Step 0: click Get Started
    await act(async () => { fireClick(getButton(container, 'Get Started')!) })
    expect(container.querySelector('h2')?.textContent).toBe('Anthropic API Key')

    // Step 1: enter valid key
    const anthropicInput = getInput(container, 'anthropic-key')!
    await act(async () => { setInputValue(container, anthropicInput, 'sk-ant-full-flow-key') })
    await act(async () => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })
    expect(container.querySelector('h2')?.textContent).toBe('GitHub Token')

    // Step 2: enter github token
    const githubInput = getInput(container, 'github-token')!
    await act(async () => { setInputValue(container, githubInput, 'ghp_fullflowtoken') })
    await act(async () => {
      fireClick(container.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    })
    expect(container.querySelector('h2')?.textContent).toBe('Linear')

    // Step 3: skip linear
    await act(async () => { fireClick(getButton(container, 'Skip')!) })
    await act(async () => { await Promise.resolve() })

    const saveMock = (window as unknown as { api: { onboardingSave: ReturnType<typeof vi.fn> } }).api.onboardingSave
    expect(saveMock).toHaveBeenCalledOnce()
    const callArg = saveMock.mock.calls[0][0]
    expect(callArg.anthropicKey).toBe('sk-ant-full-flow-key')
    expect(callArg.githubToken).toBe('ghp_fullflowtoken')
    expect(callArg.linearKey).toBe('')
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
