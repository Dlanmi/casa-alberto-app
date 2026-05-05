import { useEffect } from 'react'

type KeyCombo = {
  /** Tecla esperada — comparada con `e.key` (case-insensitive). Para teclas
   *  cuya posición varía con el layout (ej. `/`, `?`), considera definir
   *  `code` también para que matchee por posición física de la tecla. */
  key: string
  /** Opcional: `e.code` (KeyboardEvent.code) — la posición física de la tecla
   *  independiente del layout. Si está definido, `matches` lo verifica
   *  prioritariamente, cayendo al `key` si no se reportó code (env legacy). */
  code?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  /** Permite ignorar el modificador `shift` al matchear. Útil para atajos
   *  cuya tecla cambia con shift dependiendo del layout (ej. `/` en US es
   *  directo pero en es-LA requiere Shift+7, produciendo `e.shiftKey=true`
   *  en el evento). Si `ignoreShift=true`, `e.shiftKey` no se compara. */
  ignoreShift?: boolean
}

type Shortcut = {
  combo: KeyCombo
  handler: (e: KeyboardEvent) => void
}

function matches(e: KeyboardEvent, combo: KeyCombo): boolean {
  // 1. Tecla. Si el combo trae `code`, lo usamos como criterio primario
  //    (más estable entre layouts). Si no, comparamos por `key` lowercase
  //    para que mayúscula vs minúscula no rompa el match.
  const teclaOk = combo.code
    ? e.code === combo.code
    : e.key.toLowerCase() === combo.key.toLowerCase()
  if (!teclaOk) return false
  if (!!e.ctrlKey !== !!combo.ctrl) return false
  if (!!e.altKey !== !!combo.alt) return false
  if (!combo.ignoreShift && !!e.shiftKey !== !!combo.shift) return false
  if (!!e.metaKey !== !!combo.meta) return false
  return true
}

export function useKeyboard(shortcuts: Shortcut[]): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      for (const { combo, handler } of shortcuts) {
        if (matches(e, combo)) {
          // Globales: funcionan incluso si el foco está en un input/textarea.
          //   - Búsqueda y help (modificador primario sin shift)
          //   - Atajos directos de creación (modificador primario + shift)
          //   - Escape (cerrar modales/overlays)
          // El resto se inhibe dentro de campos de texto para no robar
          // combinaciones que el usuario espera (ej. Alt+1 al editar).
          const usaPrimario = combo.ctrl || combo.meta
          const isPrimaryGlobal =
            usaPrimario &&
            (combo.key.toLowerCase() === 'k' ||
              combo.key === '/' ||
              !!combo.shift) // Ctrl+Shift+X (atajos creación)
          const isGlobal = isPrimaryGlobal || combo.key === 'Escape'
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
