import { useEffect, useRef, type RefObject } from 'react'

export function useSlidePanel({
  onClose,
  closeRef
}: {
  onClose: () => void
  closeRef: RefObject<HTMLButtonElement | null>
}): void {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [closeRef])
}
