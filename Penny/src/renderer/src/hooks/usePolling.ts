import { useState, useEffect, useCallback, useRef } from 'react'

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      if (result && typeof result === 'object' && 'error' in result) {
        setError((result as Record<string, string>).error)
      } else {
        setData(result)
        setError(null)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    doFetch()
    const id = setInterval(doFetch, intervalMs)
    return () => clearInterval(id)
  }, [doFetch, intervalMs])

  return { data, loading, error, refresh: doFetch }
}
