import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Duración por defecto del keyframe `animate-slide-out-right`. Se exporta
 *  para que los consumidores que activen el modo animado mantengan sincronía
 *  entre el CSS y el delay del unmount. */
export const SLIDE_PANEL_EXIT_MS = 200

type UseSlidePanelOptions = {
  onClose: () => void
  closeRef: RefObject<HTMLButtonElement | null>
  /** Si se define (>0), el cierre se retrasa esta cantidad de ms para dejar
   *  correr una animación de salida. Si se omite o es 0, el comportamiento
   *  equivale al original (Escape cierra de inmediato). */
  exitDurationMs?: number
}

type UseSlidePanelReturn = {
  /** true cuando se solicitó cerrar y aún no se desmonta el panel.
   *  Úsalo para aplicar la clase `animate-slide-out-right` al contenedor. */
  closing: boolean
  /** Llamar para iniciar el cierre animado. Si `exitDurationMs` está omitido
   *  llama a `onClose` de inmediato; si está definido, dispara la animación
   *  y retrasa la llamada al `onClose` real. */
  requestClose: () => void
}

export function useSlidePanel({
  onClose,
  closeRef,
  exitDurationMs = 0
}: UseSlidePanelOptions): UseSlidePanelReturn {
  const [closing, setClosing] = useState(false)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestClose = useCallback(() => {
    if (exitDurationMs <= 0) {
      onClose()
      return
    }
    if (closing) return
    setClosing(true)
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    closingTimerRef.current = setTimeout(onClose, exitDurationMs)
  }, [closing, exitDurationMs, onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [requestClose])

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      previousFocusRef.current?.focus()
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    }
  }, [closeRef])

  return { closing, requestClose }
}
