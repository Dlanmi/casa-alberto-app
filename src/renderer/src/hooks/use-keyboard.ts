import { useEffect } from 'react'

type KeyCombo = {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}

type Shortcut = {
  combo: KeyCombo
  handler: (e: KeyboardEvent) => void
}

function matches(e: KeyboardEvent, combo: KeyCombo): boolean {
  return (
    e.key.toLowerCase() === combo.key.toLowerCase() &&
    !!e.ctrlKey === !!combo.ctrl &&
    !!e.altKey === !!combo.alt &&
    !!e.shiftKey === !!combo.shift &&
    !!e.metaKey === !!combo.meta
  )
}

export function useKeyboard(shortcuts: Shortcut[]): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      for (const { combo, handler } of shortcuts) {
        if (matches(e, combo)) {
          // Allow primary search shortcut and Escape even in inputs
          const isSearchShortcut = (combo.ctrl || combo.meta) && combo.key.toLowerCase() === 'k'
          const isGlobal = isSearchShortcut || combo.key === 'Escape'
          if (isInput && !isGlobal) continue

          e.preventDefault()
          handler(e)
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts])
}
