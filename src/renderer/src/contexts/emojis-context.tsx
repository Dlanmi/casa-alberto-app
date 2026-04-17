/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { IpcResult } from '@shared/types'

type EmojisContextValue = {
  enabled: boolean
  setEnabled: (value: boolean) => Promise<void>
  emoji: (char: string) => string
}

const EmojisContext = createContext<EmojisContextValue | null>(null)

export function useEmojis(): EmojisContextValue {
  const ctx = useContext(EmojisContext)
  if (!ctx) throw new Error('useEmojis must be used inside EmojisProvider')
  return ctx
}

export function EmojisProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [enabled, setEnabledState] = useState(true)

  useEffect(() => {
    let mounted = true
    window.api.configuracion
      .get('emojis_habilitados')
      .then((res: IpcResult<string | null>) => {
        if (!mounted) return
        if (res.ok) {
          setEnabledState(res.data !== '0')
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const setEnabled = useCallback(async (value: boolean): Promise<void> => {
    await window.api.configuracion.set('emojis_habilitados', value ? '1' : '0')
    setEnabledState(value)
  }, [])

  const emoji = useCallback(
    (char: string): string => (enabled ? char : ''),
    [enabled]
  )

  const value = useMemo<EmojisContextValue>(
    () => ({ enabled, setEnabled, emoji }),
    [enabled, setEnabled, emoji]
  )

  return <EmojisContext.Provider value={value}>{children}</EmojisContext.Provider>
}
