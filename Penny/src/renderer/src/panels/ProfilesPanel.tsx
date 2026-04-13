import { useState, useEffect, useCallback } from 'react'
import { useAppearanceStore } from '../stores/appearance-store'
import type { RuntimeProfile, ProfilesData } from '../types'

const MODEL_OPTIONS = ['opus', 'sonnet', 'haiku', 'ollama:qwen3-coder:30b']
const PHASES = ['plan', 'execute', 'validate'] as const

const PHASE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  plan: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  execute: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  validate: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-400' },
}

function emptyProfile(): RuntimeProfile {
  return {
    phases: {
      plan: { model: 'opus' },
      execute: { model: 'opus' },
      validate: { model: 'sonnet' },
    },
    timeoutMultiplier: 1,
    description: '',
  }
}

export function ProfilesPanel() {
  const uiTheme = useAppearanceStore((s) => s.theme)
  const [data, setData] = useState<ProfilesData | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<RuntimeProfile>(emptyProfile())
  const [draftName, setDraftName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await window.api.podProfiles()
      if (d && typeof d === 'object' && d.profiles) setData(d)
    } catch { /* */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async (name: string, profile: RuntimeProfile) => {
    await window.api.podSaveProfile(name, profile)
    setEditing(null)
    setCreating(false)
    void load()
  }

  const handleDelete = async (name: string) => {
    await window.api.podDeleteProfile(name)
    void load()
  }

  const handleSetDefault = async (name: string) => {
    await window.api.podSetDefaultProfile(name)
    void load()
  }

  const startEdit = (name: string, profile: RuntimeProfile) => {
    setEditing(name)
    setDraft({ ...profile, phases: { ...profile.phases } })
    setDraftName(name)
    setCreating(false)
  }

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setDraft(emptyProfile())
    setDraftName('')
  }

  if (!data) return null

  const profileEntries = Object.entries(data.profiles)

  return (
    <div className="relative h-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: uiTheme === 'light' ? 'url(light-1.jpg)' : 'url(tasks-bg.jpeg)' }}
      />
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-bg-app)_94%,transparent)]" />

      <div className="relative h-full flex flex-col text-[var(--c-text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)] shrink-0">
          <div>
            <h1 className="text-[22px] font-semibold">Pod Profiles</h1>
            <p className="text-[14px] text-[var(--c-text-muted)] mt-1">
              Configure models and timeouts for each phase. Set a default — every new pod uses it.
            </p>
          </div>
          <button
            onClick={startCreate}
            className="px-4 py-2 text-[14px] bg-[var(--c-accent)] hover:bg-[#00cc6e] text-[var(--c-bg-chrome)] font-medium rounded-lg transition-colors"
          >
            + New Profile
          </button>
        </div>

        {/* Profile list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Create form */}
          {creating && (
            <ProfileEditor
              name={draftName}
              profile={draft}
              isNew
              onNameChange={setDraftName}
              onProfileChange={setDraft}
              onSave={() => { if (draftName.trim()) void handleSave(draftName.trim(), draft) }}
              onCancel={() => setCreating(false)}
            />
          )}

          {profileEntries.map(([name, profile]) => (
            <div key={name}>
              {editing === name ? (
                <ProfileEditor
                  name={draftName}
                  profile={draft}
                  isNew={false}
                  onNameChange={setDraftName}
                  onProfileChange={setDraft}
                  onSave={() => void handleSave(draftName, draft)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <ProfileCard
                  name={name}
                  profile={profile}
                  isDefault={name === data.defaultProfile}
                  isBuiltIn={data.builtInNames?.includes(name) ?? false}
                  onEdit={() => startEdit(name, profile)}
                  onDelete={() => void handleDelete(name)}
                  onSetDefault={() => void handleSetDefault(name)}
                />
              )}
            </div>
          ))}

          {profileEntries.length === 0 && !creating && (
            <div className="text-center text-[var(--c-text-faint)] py-16 text-[16px]">
              No profiles configured. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Profile Card (read-only) ────────────────────────────────────────────────

function ProfileCard({
  name, profile, isDefault, isBuiltIn, onEdit, onDelete, onSetDefault,
}: {
  name: string
  profile: RuntimeProfile
  isDefault: boolean
  isBuiltIn: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  return (
    <div className={`rounded-xl border ${isDefault ? 'border-[var(--c-accent)]/40 bg-[var(--c-accent)]/5' : 'border-[var(--c-border)] bg-[var(--c-bg-surface)]'} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[18px] font-semibold text-[var(--c-text-heading)]">{name}</h3>
          {isDefault && (
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--c-accent)]/15 text-[var(--c-accent)] border border-[var(--c-accent)]/25 font-medium">
              Default
            </span>
          )}
          {isBuiltIn && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--c-bg-elevated)] text-[var(--c-text-faint)] border border-[var(--c-border)]">
              Built-in
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button onClick={onSetDefault} className="text-[13px] px-3 py-1.5 rounded-lg bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors">
              Set Default
            </button>
          )}
          <button onClick={onEdit} className="text-[13px] px-3 py-1.5 rounded-lg bg-[var(--c-bg-elevated)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[var(--c-text-secondary)] transition-colors">
            Edit
          </button>
          {!isBuiltIn && (
            <button onClick={onDelete} className="text-[13px] px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-[14px] text-[var(--c-text-muted)] mb-4">{profile.description}</p>
      )}

      {/* Phase pipeline */}
      <div className="flex items-center gap-3">
        {PHASES.map((phase, i) => {
          const colors = PHASE_COLORS[phase]
          return (
            <div key={phase} className="flex items-center gap-3">
              {i > 0 && (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--c-border-hover)]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
              <div className={`flex-1 min-w-[160px] rounded-xl border ${colors.border} ${colors.bg} px-4 py-3`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-[14px] font-semibold text-[var(--c-text-heading)] capitalize">{phase}</span>
                </div>
                <div className="text-[15px] font-mono text-[var(--c-text-primary)]">{profile.phases[phase].model}</div>
                <div className="text-[12px] text-[var(--c-text-faint)] mt-1">Timeout: {profile.timeoutMultiplier}x</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quality knobs */}
      <div className="flex items-center gap-4 mt-3 text-[13px] text-[var(--c-text-muted)]">
        <span>Max iterations: <strong className="text-[var(--c-text-primary)]">{profile.maxIterations ?? 3}</strong></span>
        <span>Self-fix attempts: <strong className="text-[var(--c-text-primary)]">{profile.maxSelfFixes ?? 1}</strong></span>
        <span>Timeout: <strong className="text-[var(--c-text-primary)]">{profile.timeoutMultiplier}x</strong></span>
      </div>
    </div>
  )
}

// ── Profile Editor (inline edit/create) ─────────────────────────────────────

function ProfileEditor({
  name, profile, isNew, onNameChange, onProfileChange, onSave, onCancel,
}: {
  name: string
  profile: RuntimeProfile
  isNew: boolean
  onNameChange: (name: string) => void
  onProfileChange: (profile: RuntimeProfile) => void
  onSave: () => void
  onCancel: () => void
}) {
  const updatePhaseModel = (phase: typeof PHASES[number], model: string) => {
    onProfileChange({
      ...profile,
      phases: { ...profile.phases, [phase]: { model } },
    })
  }

  return (
    <div className="rounded-xl border border-[var(--c-accent-blue)]/40 bg-[var(--c-bg-surface)] p-5">
      {/* Name + description */}
      <div className="space-y-3 mb-5">
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Profile name (e.g. balanced)"
          disabled={!isNew}
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[16px] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-[var(--c-accent-blue)] disabled:opacity-60"
        />
        <input
          value={profile.description}
          onChange={e => onProfileChange({ ...profile, description: e.target.value })}
          placeholder="Description (optional)"
          className="w-full px-3 py-2 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[14px] text-[var(--c-text-primary)] placeholder-[var(--c-border)] focus:outline-none focus:border-[var(--c-accent-blue)]"
        />
      </div>

      {/* Phase config */}
      <div className="flex items-start gap-3 mb-5">
        {PHASES.map((phase, i) => {
          const colors = PHASE_COLORS[phase]
          return (
            <div key={phase} className="flex items-start gap-3">
              {i > 0 && (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--c-border-hover)] mt-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
              <div className={`flex-1 min-w-[160px] rounded-xl border ${colors.border} ${colors.bg} px-4 py-3`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-[14px] font-semibold text-[var(--c-text-heading)] capitalize">{phase}</span>
                </div>
                <select
                  value={profile.phases[phase].model}
                  onChange={e => updatePhaseModel(phase, e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--c-bg-surface)] border border-[var(--c-border)] rounded-lg text-[14px] text-[var(--c-text-primary)] focus:outline-none mb-2"
                >
                  {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quality + timeout knobs */}
      <div className="flex items-center gap-6 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-[var(--c-text-secondary)]">Timeout:</span>
          <input type="number" min={0.5} max={10} step={0.5}
            value={profile.timeoutMultiplier}
            onChange={e => onProfileChange({ ...profile, timeoutMultiplier: Number(e.target.value) || 1 })}
            className="w-16 px-2 py-1.5 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[14px] text-[var(--c-text-primary)] focus:outline-none focus:border-[var(--c-accent-blue)] text-center"
          />
          <span className="text-[13px] text-[var(--c-text-faint)]">x</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-[var(--c-text-secondary)]">Max iterations:</span>
          <input type="number" min={1} max={10} step={1}
            value={profile.maxIterations ?? 3}
            onChange={e => onProfileChange({ ...profile, maxIterations: Number(e.target.value) || 3 })}
            className="w-16 px-2 py-1.5 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[14px] text-[var(--c-text-primary)] focus:outline-none focus:border-[var(--c-accent-blue)] text-center"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-[var(--c-text-secondary)]">Self-fixes:</span>
          <input type="number" min={0} max={5} step={1}
            value={profile.maxSelfFixes ?? 1}
            onChange={e => onProfileChange({ ...profile, maxSelfFixes: Number(e.target.value) || 0 })}
            className="w-16 px-2 py-1.5 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-lg text-[14px] text-[var(--c-text-primary)] focus:outline-none focus:border-[var(--c-accent-blue)] text-center"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={isNew && !name.trim()}
          className="px-4 py-2 text-[14px] bg-[var(--c-accent)] hover:bg-[#00cc6e] disabled:opacity-40 text-[var(--c-bg-chrome)] font-medium rounded-lg transition-colors"
        >
          {isNew ? 'Create Profile' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[14px] text-[var(--c-text-muted)] hover:text-[var(--c-text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
