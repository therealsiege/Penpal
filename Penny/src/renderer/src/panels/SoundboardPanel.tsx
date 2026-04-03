import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SoundboardClip, SoundboardListing } from '../types'
import { PanelBackground } from '../components/PanelBackground'

const VOLUME_STORAGE_KEY = 'penny-soundboard-volume'

// ── helpers ──────────────────────────────────────────────────────────────────

function getIpcError(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error
  }
  return null
}

function categoryOf(clip: SoundboardClip): string {
  const parts = clip.relativePath.split('/')
  return parts.length > 1 ? parts[0] : 'General'
}

function loadStoredVolume(): number {
  try {
    const v = sessionStorage.getItem(VOLUME_STORAGE_KEY)
    if (v != null) {
      const n = parseFloat(v)
      if (!Number.isNaN(n) && n >= 0 && n <= 1) return n
    }
  } catch { /* ignore */ }
  return 0.9
}

/** Human label for listing source (where clips were discovered). */
function sourceLabel(source: SoundboardListing['source'] | undefined): string {
  switch (source) {
    case 'configured': return 'Configured path'
    case 'candidate': return 'Candidate scan'
    case 'fallback-scan': return 'Fallback scan'
    case 'default': return 'Default folder'
    default: return 'Unknown'
  }
}

// ── waveform ────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [5, 9, 12, 7, 4]
const BAR_DELAYS = ['0ms', '120ms', '60ms', '180ms', '90ms']

const WAVEFORM_STYLE = `
@keyframes soundbar {
  from { transform: scaleY(0.22); }
  to   { transform: scaleY(1); }
}
` as const

function useWaveformStyle() {
  useEffect(() => {
    const id = 'soundboard-waveform-keyframes'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = WAVEFORM_STYLE
    document.head.appendChild(el)
  }, [])
}

interface WaveformProps {
  playing: boolean
}

function Waveform({ playing }: WaveformProps) {
  return (
    <svg
      width="28"
      height="14"
      viewBox="0 0 28 14"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {BAR_HEIGHTS.map((h, i) => {
        const x = 2 + i * 6
        const y = (14 - h) / 2
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="3"
            height={h}
            rx="1.5"
            fill="currentColor"
            style={
              playing
                ? {
                    transformOrigin: `${x + 1.5}px 14px`,
                    animation: 'soundbar 0.7s ease-in-out infinite alternate',
                    animationDelay: BAR_DELAYS[i],
                  }
                : undefined
            }
          />
        )
      })}
    </svg>
  )
}

// ── clip card ───────────────────────────────────────────────────────────────

interface ClipCardProps {
  clip: SoundboardClip
  playing: boolean
  onPlay: (clip: SoundboardClip) => void
  showCategory?: boolean
}

function ClipCard({ clip, playing, onPlay, showCategory }: ClipCardProps) {
  const cat = categoryOf(clip)

  return (
    <button
      type="button"
      onClick={() => onPlay(clip)}
      title={clip.relativePath}
      aria-pressed={playing}
      aria-label={`Play ${clip.name}${playing ? ' (playing)' : ''}`}
      className={[
        'stagger-item',
        'group relative flex flex-col gap-2 px-3.5 py-3 rounded-xl text-sm text-left min-h-[5.5rem]',
        'border transition-all duration-200',
        'hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg-app)]',
        playing
          ? [
              'bg-[linear-gradient(145deg,rgba(0,255,136,0.14)_0%,rgba(12,18,26,0.95)_55%,rgba(8,12,18,0.98)_100%)]',
              'border-[color-mix(in_srgb,var(--c-accent)_45%,transparent)] text-[#e8f8f0]',
              'shadow-[0_0_32px_-10px_rgba(0,255,136,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)]',
            ].join(' ')
          : [
              'bg-[linear-gradient(165deg,rgba(12,18,26,0.92)_0%,rgba(8,11,16,0.96)_100%)]',
              'border-[color-mix(in_srgb,var(--c-border)_90%,transparent)] text-[var(--c-text-primary)]',
              'hover:border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.55)]',
            ].join(' '),
      ].join(' ')}
    >
      {playing && (
        <span
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--c-accent)] shadow-[0_0_10px_rgba(0,255,136,0.7)] animate-pulse"
          aria-hidden="true"
        />
      )}

      <div className="flex items-start justify-between gap-2 min-w-0 pr-5">
        <span className="truncate font-semibold leading-snug text-[13px]">{clip.name}</span>
      </div>

      {showCategory && cat && (
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--c-text-muted)] font-bold w-fit">
          {cat}
        </span>
      )}

      <span
        className={[
          'mt-auto flex items-center gap-2',
          playing ? 'text-[var(--c-accent-blue)]' : 'text-[var(--c-text-faint)] group-hover:text-[color-mix(in_srgb,var(--c-accent)_70%,transparent)]',
          'transition-colors duration-200',
        ].join(' ')}
      >
        <Waveform playing={playing} />
        {playing && (
          <span className="text-[10px] font-semibold tracking-wide uppercase text-[var(--c-accent)]">
            Live
          </span>
        )}
      </span>
    </button>
  )
}

// ── category section ────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  clips: SoundboardClip[]
  playingIds: Set<string>
  onPlay: (clip: SoundboardClip) => void
}

function CategorySection({ category, clips, playingIds, onPlay }: CategorySectionProps) {
  return (
    <section aria-label={`${category} sounds`}>
      <h2 className="animate-fade-slide-down flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-muted)] mb-2.5 px-0.5">
        <span className="h-px w-8 shrink-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--c-accent)_35%,transparent)] to-transparent rounded-full" aria-hidden />
        {category}
        <span className="text-[var(--c-border-hover)] font-mono tabular-nums font-semibold normal-case tracking-normal">
          {clips.length}
        </span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {clips.map(clip => (
          <ClipCard
            key={clip.id}
            clip={clip}
            playing={playingIds.has(clip.id)}
            onPlay={onPlay}
          />
        ))}
      </div>
    </section>
  )
}

// ── empty state ─────────────────────────────────────────────────────────────

function EmptyState({ directory }: { directory: string }) {
  return (
    <div className="animate-card-enter flex flex-col items-center justify-center gap-4 py-20 border border-dashed border-[color-mix(in_srgb,var(--c-border)_80%,transparent)] rounded-xl text-center bg-[color-mix(in_srgb,var(--c-bg-surface)_40%,transparent)] px-6">
      <svg
        className="w-12 h-12 text-[var(--c-border-hover)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
      <div className="space-y-1 max-w-md">
        <p className="text-[var(--c-text-primary)] font-medium">No sound effects found</p>
        <p className="text-[var(--c-text-muted)] text-xs leading-relaxed">
          Drop <code className="text-[var(--c-accent-blue)]">.mp3</code> files into{' '}
          <code className="text-[var(--c-text-secondary)] break-all">{directory || 'sound-effects/'}</code>
        </p>
      </div>
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function SoundboardPanel() {
  const [listing, setListing] = useState<SoundboardListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set())
  const [volume, setVolume] = useState(loadStoredVolume)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const audioMap = useRef<Map<string, HTMLAudioElement>>(new Map())
  const searchRef = useRef<HTMLInputElement>(null)

  useWaveformStyle()

  useEffect(() => {
    try {
      sessionStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
    } catch { /* ignore */ }
  }, [volume])

  useEffect(() => {
    for (const audio of audioMap.current.values()) {
      audio.volume = volume
    }
  }, [volume])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = document.activeElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const stopAll = useCallback(() => {
    for (const audio of audioMap.current.values()) {
      audio.pause()
      audio.currentTime = 0
    }
    audioMap.current.clear()
    setPlayingIds(new Set())
  }, [])

  const loadListing = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await window.api.soundboardList()
      const ipcError = getIpcError(payload)
      if (ipcError) throw new Error(ipcError)

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('clips' in payload) ||
        !Array.isArray((payload as { clips?: unknown }).clips)
      ) {
        throw new Error('Invalid soundboard payload from main process.')
      }

      setListing(payload as SoundboardListing)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadListing()
    const timer = setInterval(() => { void loadListing() }, 5000)
    return () => {
      clearInterval(timer)
      stopAll()
    }
  }, [loadListing, stopAll])

  const playClip = useCallback(
    (clip: SoundboardClip) => {
      const existing = audioMap.current.get(clip.id)
      if (existing) {
        existing.pause()
        existing.currentTime = 0
        audioMap.current.delete(clip.id)
        setPlayingIds(prev => {
          const next = new Set(prev)
          next.delete(clip.id)
          return next
        })
        return
      }

      const audio = new Audio(clip.url)
      audio.volume = volume
      audio.preload = 'auto'

      const cleanup = () => {
        audioMap.current.delete(clip.id)
        setPlayingIds(prev => {
          const next = new Set(prev)
          next.delete(clip.id)
          return next
        })
      }
      audio.addEventListener('ended', cleanup, { once: true })
      audio.addEventListener('error', cleanup, { once: true })

      audioMap.current.set(clip.id, audio)
      setPlayingIds(prev => new Set(prev).add(clip.id))

      audio.play().catch(err => {
        cleanup()
        setError(`Failed to play "${clip.name}": ${(err as Error).message}`)
      })
    },
    [volume],
  )

  const allClips = listing?.clips ?? []

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase()
    let clips = allClips
    if (q) {
      clips = clips.filter(
        c => c.name.toLowerCase().includes(q) || c.relativePath.toLowerCase().includes(q),
      )
    }
    if (categoryFilter) {
      clips = clips.filter(c => categoryOf(c) === categoryFilter)
    }
    return clips.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [allClips, search, categoryFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, SoundboardClip[]>()
    for (const clip of filteredClips) {
      const cat = categoryOf(clip)
      const arr = map.get(cat) ?? []
      arr.push(clip)
      map.set(cat, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    }
    return map
  }, [filteredClips])

  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set(allClips.map(categoryOf)),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [allClips],
  )

  const isMultiCategory = grouped.size > 1

  return (
    <PanelBackground>
      <div className="relative z-[1] h-full flex flex-col overflow-hidden min-h-0">
        {/* Header strip */}
        <div className="office-status-hud shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-[var(--c-border-subtle)] backdrop-blur-[2px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-[var(--c-text-heading)] tracking-tight">Soundboard</h1>
              {playingIds.size > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-accent)] bg-[color-mix(in_srgb,var(--c-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-accent)] shadow-[0_0_8px_rgba(0,255,136,0.6)] animate-pulse" />
                  {playingIds.size} active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--c-text-muted)] mt-0.5 truncate">
              {allClips.length} clip{allClips.length !== 1 ? 's' : ''}
              {listing?.directory && (
                <>
                  {' · '}
                  <span className="font-mono text-[var(--c-text-faint)]" title={listing.directory}>
                    {listing.directory.split('/').slice(-2).join('/')}
                  </span>
                </>
              )}
              {listing?.source && (
                <span className="text-[var(--c-border-hover)]"> · {sourceLabel(listing.source)}</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-[11px] text-[var(--c-text-dim)] cursor-pointer">
              <span className="whitespace-nowrap hidden sm:inline">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={e => setVolume(Number(e.target.value) / 100)}
                className="w-24 sm:w-28 h-1 accent-[var(--c-accent)] bg-[var(--c-bg-elevated)] rounded-full"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(volume * 100)}
                aria-label="Soundboard volume"
              />
              <span className="tabular-nums text-[var(--c-text-faint)] w-8 text-right">{Math.round(volume * 100)}%</span>
            </label>
            <button
              type="button"
              onClick={() => void loadListing()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--c-text-secondary)] bg-[var(--c-bg-elevated)] border border-[var(--c-border)] hover:border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] hover:text-[var(--c-text-primary)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-accent)_35%,transparent)]"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={stopAll}
              disabled={playingIds.size === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#fca5a5] bg-red-950/40 border border-red-500/25 hover:bg-red-900/35 transition-colors disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
            >
              Stop all
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-penpal">
          <div className="max-w-6xl mx-auto py-5 px-5 space-y-5 pb-8">

            {allClips.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-text-faint)] pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search clips…"
                    aria-label="Search sound clips"
                    className={[
                      'w-full pl-9 pr-3 py-2.5 rounded-xl text-sm',
                      'bg-[color-mix(in_srgb,var(--c-bg-chrome)_90%,transparent)] border border-[color-mix(in_srgb,var(--c-border)_90%,transparent)]',
                      'text-[var(--c-text-heading)] placeholder:text-[var(--c-text-faint)]',
                      'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] focus:border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)]',
                      'transition-all duration-200',
                    ].join(' ')}
                  />
                </div>
                <p className="text-[10px] text-[var(--c-border-hover)] pl-0.5">
                  Press <kbd className="px-1 py-0.5 rounded bg-[var(--c-bg-elevated)] border border-[var(--c-border)] font-mono text-[var(--c-text-muted)]">/</kbd>
                  {' '}to focus search
                </p>
              </div>
            )}

            {categoryNames.length > 1 && allClips.length > 0 && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by folder">
                <button
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === null}
                  onClick={() => setCategoryFilter(null)}
                  className={[
                    'text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors',
                    categoryFilter === null
                      ? 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent-blue)] border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)]'
                      : 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_80%,transparent)] text-[var(--c-text-dim)] border-[var(--c-border)] hover:border-[color-mix(in_srgb,var(--c-accent)_20%,transparent)]',
                  ].join(' ')}
                >
                  All
                </button>
                {categoryNames.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={categoryFilter === cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    className={[
                      'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                      categoryFilter === cat
                        ? 'bg-[color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent-blue)] border-[color-mix(in_srgb,var(--c-accent)_35%,transparent)]'
                        : 'bg-[color-mix(in_srgb,var(--c-bg-elevated)_80%,transparent)] text-[var(--c-text-secondary)] border-[var(--c-border)] hover:border-[color-mix(in_srgb,var(--c-accent)_20%,transparent)]',
                    ].join(' ')}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="text-xs text-red-300/95 bg-red-950/40 border border-red-500/25 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            {filteredClips.length === 0 ? (
              <EmptyState directory={listing?.directory ?? 'sound-effects'} />
            ) : isMultiCategory ? (
              <div className="space-y-8">
                {Array.from(grouped.entries())
                  .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                  .map(([cat, clips]) => (
                    <CategorySection
                      key={cat}
                      category={cat}
                      clips={clips}
                      playingIds={playingIds}
                      onPlay={playClip}
                    />
                  ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredClips.map(clip => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    playing={playingIds.has(clip.id)}
                    onPlay={playClip}
                    showCategory
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PanelBackground>
  )
}
