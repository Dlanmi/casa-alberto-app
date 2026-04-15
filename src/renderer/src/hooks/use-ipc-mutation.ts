import { useState, useCallback } from 'react'
import type { IpcResult } from '@shared/types'

interface UseIpcMutationReturn<TArgs extends unknown[], TResult> {
  execute: (...args: TArgs) => Promise<TResult>
  loading: boolean
  error: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutator = (...args: any[]) => Promise<any>

export function useIpcMutation<TArgs extends unknown[], TResult>(
  mutator: AnyMutator
): UseIpcMutationReturn<TArgs, TResult> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setLoading(true)
      setError(null)
      try {
        const result = (await mutator(...args)) as IpcResult<TResult>
        if (result.ok) {
          return result.data
        }
        throw new Error(result.error)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [mutator]
  )

  return { execute, loading, error }
}
