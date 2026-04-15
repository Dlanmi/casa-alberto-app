import { useState, useEffect, useCallback, useRef } from 'react'
import type { IpcResult } from '@shared/types'

interface UseIpcReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPromise = Promise<any>

export function useIpc<T>(fetcher: () => AnyPromise, deps: unknown[] = []): UseIpcReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = (await fetcher()) as IpcResult<T>
      if (!mountedRef.current) return
      if (result.ok) {
        setData(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => {
      mountedRef.current = false
    }
  }, [execute])

  return { data, loading, error, refetch: execute }
}
