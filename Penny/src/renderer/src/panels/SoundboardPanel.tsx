import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SoundboardClip, SoundboardListing } from '../types'
import { PanelBackground } from '../components/PanelBackground'

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

/** Derive a human-readable category from the clip's relative path. */
function categoryOf(clip: SoundboardClip): string {
  const parts = clip.relativePath.split('/')
  return parts.length > 1 ? parts[0] : 'General'
}

// ── waveform bars ─────────────────────────────────────────────────────────────

/** Static heights (px) for the 5 waveform bars — varied to look organic. */
const BAR_HEIGHTS = [5, 9, 12, 7, 4]

/** Keyframe animation delays per bar so they feel staggered when playing. */
const BAR_DELAYS = ['0ms', '120ms', '60ms', '180ms', '90ms']

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
            y={playing ? undefined : y}
            width="3"
            height={playing ? undefined : h}
            rx="1.5"
            fill="currentColor"
            style={
              playing
                ? {
                    // animate from bottom-center of SVG
                    transformOrigin: `${x + 1.5}px 7px`,
                    animation: `soundbar 0.7s ease-in-out infinite alternate`,
                    animationDelay: BAR_DELAYS[i],
                    // keep it centered via transform instead of y/height so we can animate
                    transform: `scaleY(${h / 14})`,
                  }
                : undefined
            }
          />
        )
      })}
    </svg>
  )
}

// ── inline keyframes injected once ───────────────────────────────────────────

const WAVEFORM_STYLE = `
@keyframes soundbar {
  from { transform: scaleY(0.2); }
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

// ── clip card ─────────────────────────────────────────────────────────────────

interface ClipCardProps {
  clip: SoundboardClip
  playing: boolean
  onPlay: (clip: SoundboardClip) => void
}

function ClipCard({ clip, playing, onPlay }: ClipCardProps) {
  return (
    <button
      onClick={() => onPlay(clip)}
      title={clip.relativePath}
      aria-label={`Play ${clip.name}${playing ? ' (playing)' : ''}`}
      className={[
        'stagger-item',
        'group relative flex flex-col gap-2 px-3 py-3 rounded-lg text-sm text-left',
        'transition-all duration-150',
        'hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
        playing
          ? 'animate-breathe-glow bg-violet-500/90 text-white ring-1 ring-violet-400/40'
          : 'bg-violet-700/70 hover:bg-violet-600/90 text-white',
      ].join(' ')}
    >
      {/* playing indicator dot */}
      {playing && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* clip name */}
      <span className="truncate font-medium leading-snug pr-4">{clip.name}</span>

      {/* waveform row */}
      <span
        className={[
          'flex items-center gap-1.5',
          playing ? 'text-green-300' : 'text-violet-300/60 group-hover:text-violet-200/80',
          'transition-colors duration-200',
        ].join(' ')}
      >
        <Waveform playing={playing} />
        {playing && (
          <span className="text-[10px] text-green-300 font-medium tracking-wide uppercase">
            playing
          </span>
        )}
      </span>
    </button>
  )
}

// ── category section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  clips: SoundboardClip[]
  playingIds: Set<string>
  onPlay: (clip: SoundboardClip) => void
}

function CategorySection({ category, clips, playingIds, onPlay }: CategorySectionProps) {
  return (
    <section aria-label={`${category} sounds`}>
      <h2 className="animate-fade-slide-down text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-0.5">
        {category}
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

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState({ directory }: { directory: string }) {
  return (
    <div className="animate-card-enter flex flex-col items-center justify-center gap-4 py-20 border border-dashed border-slate-700/60 rounded-xl text-center">
      {/* speaker icon */}
      <svg
        className="w-12 h-12 text-slate-600"
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
      <div className="space-y-1">
        <p className="text-slate-300 font-medium">No sound effects found</p>
        <p className="text-slate-500 text-xs">
          Drop <code className="text-violet-400">.mp3</code> files into{' '}
          <code className="text-slate-400">{directory || 'sound-effects/'}</code>
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

  // Keep a ref map of audio elements so we can stop them
  const audioMap = useRef<Map<string, HTMLAudioElement>>(new Map())

  useWaveformStyle()

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

  const playClip = useCallback((clip: SoundboardClip) => {
    // If already playing, stop it (toggle)
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
    audio.volume = 0.9
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
  }, [])

  // ── derived state ──────────────────────────────────────────────────────────

  const allClips = listing?.clips ?? []

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allClips
    return allClips.filter(c =>
      c.name.toLowerCase().includes(q) || c.relativePath.toLowerCase().includes(q)
    )
  }, [allClips, search])

  /** Group by category (top-level folder or "General"). */
  const grouped = useMemo(() => {
    const map = new Map<string, SoundboardClip[]>()
    for (const clip of filteredClips) {
      const cat = categoryOf(clip)
      const arr = map.get(cat) ?? []
      arr.push(clip)
      map.set(cat, arr)
    }
    return map
  }, [filteredClips])

  const isMultiCategory = grouped.size > 1

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <PanelBackground>
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">

        {/* header row */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            Soundboard
            {playingIds.size > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                {playingIds.size} playing
              </span>
            )}
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadListing()}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={stopAll}
              disabled={playingIds.size === 0}
              className="px-3 py-1.5 rounded bg-red-700/80 hover:bg-red-600 text-xs text-white transition-colors disabled:opacity-40"
            >
              Stop All
            </button>
          </div>
        </div>

        {/* search */}
        {allClips.length > 0 && (
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
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
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clips..."
              aria-label="Search sound clips"
              className={[
                'w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-slate-800/60 border border-slate-700/50',
                'text-slate-200 placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-slate-600',
                'transition-all duration-200',
              ].join(' ')}
            />
          </div>
        )}

        {/* error banner */}
        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* content */}
        {filteredClips.length === 0 ? (
          <EmptyState directory={listing?.directory ?? 'sound-effects'} />
        ) : isMultiCategory ? (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([cat, clips]) => (
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </PanelBackground>
  )
}
