import { useCallback, useEffect, useRef, useState } from 'react'
import type { SoundboardClip, SoundboardListing } from '../types'

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

export function SoundboardPanel() {
  const [listing, setListing] = useState<SoundboardListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeAudio = useRef<Set<HTMLAudioElement>>(new Set())

  const stopAll = useCallback(() => {
    for (const audio of activeAudio.current) {
      audio.pause()
      audio.currentTime = 0
    }
    activeAudio.current.clear()
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

  const clips = listing?.clips || []

  const playClip = useCallback((clip: SoundboardClip) => {
    const audio = new Audio(clip.url)
    audio.volume = 0.9
    audio.preload = 'auto'

    const cleanup = () => {
      activeAudio.current.delete(audio)
    }
    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', cleanup, { once: true })

    activeAudio.current.add(audio)
    audio.play().catch(err => {
      cleanup()
      setError(`Failed to play "${clip.name}": ${(err as Error).message}`)
    })
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-8 px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-200">Soundboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadListing()}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={stopAll}
              className="px-3 py-1.5 rounded bg-red-700/80 hover:bg-red-600 text-xs text-white transition-colors"
            >
              Stop All
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}

        {clips.length === 0 ? (
          <div className="text-center text-slate-500 py-14 border border-dashed border-slate-800 rounded-lg">
            No `.mp3` clips found in `{listing?.directory || 'sound_effects'}`.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {clips.map(clip => (
              <button
                key={clip.id}
                onClick={() => playClip(clip)}
                className="px-3 py-3 rounded-lg bg-violet-700/80 hover:bg-violet-600 text-sm text-white text-left transition-colors truncate"
                title={clip.relativePath}
              >
                {clip.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
