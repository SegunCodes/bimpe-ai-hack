import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/api'

/**
 * Fetches data now and then every `interval` ms.
 * - Keeps showing the last good data if a refresh fails (no flicker, no blank screen).
 * - Skips re-rendering when the response hasn't changed.
 * - Changing `key` resets and starts polling the new thing (e.g. a different order id).
 */
export function usePolling<T>(fetcher: () => Promise<T>, key: string, interval = 3000) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  const tickRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let active = true
    let busy = false
    let lastJson = ''

    const tick = async () => {
      if (busy) return
      busy = true
      try {
        const result = await fetcherRef.current()
        if (!active) return
        const json = JSON.stringify(result)
        if (json !== lastJson) {
          lastJson = json
          setData(result)
        }
        setError(null)
      } catch (err) {
        if (active) setError(errorMessage(err))
      } finally {
        busy = false
        if (active) setLoading(false)
      }
    }

    tickRef.current = tick
    setData(null)
    setError(null)
    setLoading(true)
    tick()
    const timer = setInterval(tick, interval)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [key, interval])

  const refresh = useCallback(() => tickRef.current(), [])

  return { data, error, loading, refresh }
}
