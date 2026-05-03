import { useCallback, useRef } from 'react'

/**
 * useErrorShake — dispara la animación `error-shake` del CSS sobre un elemento
 * cuando se invoca `shake()`. Usa classList imperativo (no setState) para no
 * forzar re-renders del componente que la usa.
 *
 * Uso típico:
 *   const { ref, shake } = useErrorShake<HTMLFormElement>()
 *   <form ref={ref} onSubmit={(e) => {
 *     e.preventDefault()
 *     if (!validate()) { shake(); return }
 *     await save()
 *   }}>...</form>
 */
export function useErrorShake<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>
  shake: () => void
} {
  const ref = useRef<T | null>(null)

  const shake = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.classList.remove('animate-error-shake')
    // Force reflow para reiniciar la animación si dispara durante una activa.
    void el.offsetWidth
    el.classList.add('animate-error-shake')
  }, [])

  return { ref, shake }
}
