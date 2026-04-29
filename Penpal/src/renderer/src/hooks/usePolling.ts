import { useState, useEffect, useCallback, useRef } from 'react'

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): { data: T | null; loading: boolean; error: string | null; errorCount: number; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const fetcherRef = useRef(fetcher)
  const errorCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  fetcherRef.current = fetcher

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      if (result && typeof result === 'object' && 'error' in result) {
        setError((result as Record<string, string>).error)
        errorCountRef.current++
        setErrorCount(errorCountRef.current)
      } else {
        setData(result)
        setError(null)
        // Reset error count and interval on success
        if (errorCountRef.current > 0) {
          errorCountRef.current = 0
          setErrorCount(0)
        }
      }
    } catch (err) {
      setError((err as Error).message)
      errorCountRef.current++
      setErrorCount(errorCountRef.current)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    doFetch()

    // Adaptive interval: after 3 consecutive errors, double interval (max 30s)
    const getInterval = () => {
      if (errorCountRef.current >= 3) {
        return Math.min(intervalMs * Math.pow(2, Math.floor(errorCountRef.current / 3)), 30_000)
      }
      return intervalMs
    }

    // Use a self-scheduling timeout instead of fixed interval for adaptive backoff
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      timeoutId = setTimeout(async () => {
        await doFetch()
        schedule()
      }, getInterval())
    }
    schedule()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [doFetch, intervalMs])

  return { data, loading, error, errorCount, refresh: doFetch }
}
