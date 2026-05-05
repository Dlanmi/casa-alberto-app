import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { getMotionDurationMs } from '@renderer/lib/motion'

/** Helper para obtener la duración actual de salida del panel. Lee del
 *  CSS al momento de invocarse — uso preferido en código nuevo. */
export function getSlidePanelExitMs(): number {
  return getMotionDurationMs('base')
}

/** @deprecated — usa el default del hook (omitir `exitDurationMs`) o
 *  `getSlidePanelExitMs()`. Esta constante se evalúa en module-load y
 *  puede tomar el fallback estático si el CSS aún no está parseado. */
export const SLIDE_PANEL_EXIT_MS = getMotionDurationMs('base')

type UseSlidePanelOptions = {
  onClose: () => void
  closeRef: RefObject<HTMLButtonElement | null>
  /** Si se define (>0), el cierre se retrasa esta cantidad de ms para dejar
   *  correr una animación de salida. Si se omite, el hook usa la duración
   *  del token `--duration-base`. Pasa 0 explícitamente para deshabilitar
   *  la animación (cierre inmediato). */
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
  exitDurationMs
}: UseSlidePanelOptions): UseSlidePanelReturn {
  const [closing, setClosing] = useState(false)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestClose = useCallback(() => {
    // Si el caller pasa 0 explícitamente, deshabilita la animación. Si pasa
    // un número >0 lo respetamos. Si omite, leemos lazy del CSS — esto
    // resuelve el caso edge donde la duración cambia o donde el module-load
    // del export estático devolvió fallback.
    const ms = exitDurationMs ?? getSlidePanelExitMs()
    if (ms <= 0) {
      onClose()
      return
    }
    if (closing) return
    setClosing(true)
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    closingTimerRef.current = setTimeout(onClose, ms)
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
