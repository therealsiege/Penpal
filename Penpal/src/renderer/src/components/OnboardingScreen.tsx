import { useState, useRef, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void
}

interface RepoFields {
  owner: string
  repo: string
  localPath: string
}

// ── Eye Icons ──────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeSlashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ── Shared input style ─────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded px-3 py-2 text-[var(--c-text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] text-sm'

const PRIMARY_BTN =
  'bg-[var(--c-accent)] hover:opacity-90 text-white rounded px-4 py-2 font-medium transition-opacity text-sm'

const DISABLED_BTN =
  'opacity-40 cursor-not-allowed bg-[var(--c-accent)] text-white rounded px-4 py-2 font-medium text-sm'

// ── PasswordField ──────────────────────────────────────────────────────────────

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  error,
  inputRef,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`${INPUT_CLASS} pr-10`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide value' : 'Show value'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors"
        >
          {visible ? <EyeSlashIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Progress Dots ──────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-200"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            background:
              i < current
                ? 'var(--c-accent)'
                : i === current
                  ? 'var(--c-accent)'
                  : 'var(--c-border)',
            opacity: i < current ? 0.55 : 1,
          }}
        />
      ))}
    </div>
  )
}

// ── Field Group ────────────────────────────────────────────────────────────────

function FieldGroup({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-[var(--c-text-primary)]">{label}</label>
        <p className="text-xs text-[var(--c-text-muted)] mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  )
}

// ── Step 0 — Welcome ───────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--c-text-heading)]">Welcome to Penpal</h1>
        <p className="text-sm text-[var(--c-text-secondary)]">AI-powered dispatch for your dev team</p>
      </div>
      <p className="text-sm text-[var(--c-text-muted)] leading-relaxed max-w-sm">
        Penpal manages Claude Code pod agents that write code, review PRs, and close issues automatically.
        Let's connect your accounts to get started.
      </p>
      <button autoFocus onClick={onNext} className={PRIMARY_BTN}>
        Get Started
      </button>
    </div>
  )
}

// ── Step 1 — Anthropic ─────────────────────────────────────────────────────────

function StepAnthropic({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const [error, setError] = useState<string | undefined>()
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const handleNext = () => {
    if (value && !value.startsWith('sk-ant-')) {
      setError('Key must start with sk-ant-')
      return
    }
    if (!value.trim()) {
      setError('Anthropic API key is required')
      return
    }
    setError(undefined)
    onNext()
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleNext() }} className="space-y-6" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-[var(--c-text-heading)]">Anthropic API Key</h2>
        <p className="text-xs text-[var(--c-text-muted)] mt-1">Step 1 of 3</p>
      </div>
      <FieldGroup
        label="Anthropic API Key"
        description="Required for Claude Code pod agents to run"
      >
        <PasswordField
          id="anthropic-key"
          value={value}
          onChange={v => { onChange(v); if (error) setError(undefined) }}
          placeholder="sk-ant-api..."
          error={error}
          inputRef={firstInputRef}
        />
      </FieldGroup>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-disabled={!value.trim()}
          className={value.trim() ? PRIMARY_BTN : DISABLED_BTN}
        >
          Next
        </button>
      </div>
    </form>
  )
}

// ── Step 2 — GitHub ────────────────────────────────────────────────────────────

function StepGitHub({
  value,
  onChange,
  repo,
  onRepoChange,
  onNext,
  onBack,
}: {
  value: string
  onChange: (v: string) => void
  repo: RepoFields
  onRepoChange: (r: RepoFields) => void
  onNext: () => void
  onBack: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [repoError, setRepoError] = useState<string | undefined>()
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const handleNext = () => {
    const { owner, repo: repoName, localPath } = repo
    const filled = [owner.trim(), repoName.trim(), localPath.trim()].filter(Boolean).length
    if (filled > 0 && filled < 3) {
      setRepoError('Fill in all three fields or leave all empty')
      return
    }
    setRepoError(undefined)
    onNext()
  }

  const handleBrowse = async () => {
    const result = await window.api.pickDirectory()
    if (result) {
      onRepoChange({ ...repo, localPath: result })
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleNext() }} className="space-y-6" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-[var(--c-text-heading)]">GitHub Token</h2>
        <p className="text-xs text-[var(--c-text-muted)] mt-1">Step 2 of 3</p>
      </div>
      <FieldGroup
        label="GitHub Personal Access Token"
        description="Required to poll issues and open pull requests. Needs repo + workflow scopes."
      >
        <PasswordField
          id="github-token"
          value={value}
          onChange={onChange}
          placeholder="ghp_..."
          inputRef={firstInputRef}
        />
      </FieldGroup>

      {/* Collapsible repo section */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors"
          aria-expanded={expanded}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Add a GitHub repo to watch
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pl-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="repo-owner" className="text-xs text-[var(--c-text-muted)]">Owner</label>
                <input
                  id="repo-owner"
                  type="text"
                  value={repo.owner}
                  onChange={e => onRepoChange({ ...repo, owner: e.target.value })}
                  placeholder="owner"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="repo-name" className="text-xs text-[var(--c-text-muted)]">Repo</label>
                <input
                  id="repo-name"
                  type="text"
                  value={repo.repo}
                  onChange={e => onRepoChange({ ...repo, repo: e.target.value })}
                  placeholder="repo"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="repo-path" className="text-xs text-[var(--c-text-muted)]">Local path</label>
              <div className="flex gap-2">
                <input
                  id="repo-path"
                  type="text"
                  value={repo.localPath}
                  onChange={e => onRepoChange({ ...repo, localPath: e.target.value })}
                  placeholder="/path/to/local/clone"
                  className={`${INPUT_CLASS} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="shrink-0 px-3 py-2 text-xs rounded bg-[var(--c-bg-elevated)] border border-[var(--c-border)] text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-hover)] transition-colors"
                >
                  Browse...
                </button>
              </div>
            </div>
            {repoError && (
              <p role="alert" className="text-xs text-red-400">{repoError}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-disabled={!value.trim()}
          className={value.trim() ? PRIMARY_BTN : DISABLED_BTN}
        >
          Next
        </button>
      </div>
    </form>
  )
}

// ── Step 3 — Linear ────────────────────────────────────────────────────────────

function StepLinear({
  value,
  onChange,
  onFinish,
  onSkip,
  onBack,
  saving,
  saveError,
}: {
  value: string
  onChange: (v: string) => void
  onFinish: () => void
  onSkip: () => void
  onBack: () => void
  saving: boolean
  saveError?: string
}) {
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  return (
    <form onSubmit={e => { e.preventDefault(); if (!saving) onFinish() }} className="space-y-6" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-[var(--c-text-heading)]">Linear</h2>
        <p className="text-xs text-[var(--c-text-muted)] mt-1">Step 3 of 3</p>
      </div>
      <FieldGroup
        label="Linear API Key (Optional)"
        description="Connect Linear to dispatch work from Linear issues directly"
      >
        <PasswordField
          id="linear-key"
          value={value}
          onChange={onChange}
          placeholder="lin_api_..."
          inputRef={firstInputRef}
        />
      </FieldGroup>
      <p className="text-xs text-[var(--c-text-muted)]">
        Skip this for now — you can add it later in Settings.
      </p>

      {saveError && (
        <p role="alert" className="text-xs text-red-400">{saveError}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)] transition-colors disabled:opacity-40"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={saving}
            className={saving ? DISABLED_BTN : PRIMARY_BTN}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              'Finish'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0)

  // Step 1
  const [anthropicKey, setAnthropicKey] = useState('')
  // Step 2
  const [githubToken, setGithubToken] = useState('')
  const [repo, setRepo] = useState<RepoFields>({ owner: '', repo: '', localPath: '' })
  // Step 3
  const [linearKey, setLinearKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()

  const submit = async (skipLinear: boolean) => {
    setSaving(true)
    setSaveError(undefined)
    try {
      const hasAllRepo = repo.owner.trim() && repo.repo.trim() && repo.localPath.trim()
      const payload = {
        anthropicKey,
        githubToken,
        linearKey: skipLinear ? '' : linearKey,
        ...(hasAllRepo
          ? { addGithubRepo: { owner: repo.owner.trim(), repo: repo.repo.trim(), localPath: repo.localPath.trim() } }
          : {}),
      }
      const result = await window.api.onboardingSave(payload)
      if (result.ok) {
        setSaving(false)
        onComplete()
      } else {
        setSaveError(result.error ?? 'An unexpected error occurred. Please try again.')
        setSaving(false)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setSaving(false)
    }
  }

  const handleFinish = () => { void submit(false) }
  const handleSkip = () => { void submit(true) }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#020617]"
      style={{ backgroundColor: 'var(--c-bg-app, #020617)' }}
    >
      <style>{`
        @keyframes onboarding-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .onboarding-step {
          animation: onboarding-fade-in 0.15s ease-out both;
        }
      `}</style>
      <div
        className="w-full max-w-[480px] mx-4 rounded-lg border border-[var(--c-border)] p-8"
        style={{ background: 'color-mix(in srgb, var(--c-bg-surface, #0f172a) 85%, transparent)' }}
      >
        {step > 0 && <ProgressDots total={4} current={step} />}

        <div key={step} className="onboarding-step">
          {step === 0 && (
            <StepWelcome onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepAnthropic
              value={anthropicKey}
              onChange={setAnthropicKey}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepGitHub
              value={githubToken}
              onChange={setGithubToken}
              repo={repo}
              onRepoChange={setRepo}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepLinear
              value={linearKey}
              onChange={setLinearKey}
              onFinish={handleFinish}
              onSkip={handleSkip}
              onBack={() => setStep(2)}
              saving={saving}
              saveError={saveError}
            />
          )}
        </div>
      </div>
    </div>
  )
}
