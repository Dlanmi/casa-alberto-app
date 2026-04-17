import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  initialFocusRef?: RefObject<HTMLElement | null>
  /**
   * Callback opcional que se ejecuta ANTES de cerrar. Si retorna `false`, el
   * cierre se bloquea (útil para formularios con cambios sin guardar que
   * necesitan confirmación). Si retorna `true` o nada, el cierre procede.
   *
   * Se consulta en: click en backdrop, tecla Escape, y click en el botón X.
   * NO afecta a los llamados a `onClose` hechos desde el propio contenido
   * (ej. "Guardar" que luego llama onClose manualmente).
   */
  onBeforeClose?: () => boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = 'md',
  initialFocusRef,
  onBeforeClose
}: ModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const onBeforeCloseRef = useRef<typeof onBeforeClose>(onBeforeClose)
  // useEffect (no durante render) mantiene el ref alineado con la prop más
  // reciente — los handlers de click/Escape se ejecutan después del commit,
  // así que ven siempre la versión actualizada.
  useEffect(() => {
    onBeforeCloseRef.current = onBeforeClose
  }, [onBeforeClose])

  // Consulta al callback si existe; retorna true si se permite cerrar.
  const canClose = (): boolean => onBeforeCloseRef.current?.() !== false

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      lastFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (!dialog.open) {
        dialog.showModal()
      }

      const focusTarget = initialFocusRef?.current ?? closeButtonRef.current ?? dialog
      queueMicrotask(() => focusTarget?.focus())
    } else if (dialog.open) {
      dialog.close()
    }
  }, [initialFocusRef, open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose(): void {
      onClose()
      lastFocusedRef.current?.focus()
    }

    function handleCancel(event: Event): void {
      // Escape dispara 'cancel'. Bloqueamos el cierre si onBeforeClose lo niega.
      event.preventDefault()
      if (!canClose()) return
      onClose()
    }

    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('cancel', handleCancel)

    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('cancel', handleCancel)
    }
  }, [onClose])

  function handleBackdropClick(event: React.MouseEvent): void {
    if (event.target === dialogRef.current) {
      if (!canClose()) return
      onClose()
    }
  }

  function handleCloseButton(): void {
    if (!canClose()) return
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={title ? titleId : undefined}
      aria-modal="true"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={cn(
        'rounded-xl shadow-4 bg-surface p-0 border border-border',
        'max-h-[85vh] overflow-y-auto',
        size === 'sm' && 'w-100 max-w-[90vw]',
        size === 'md' && 'w-140 max-w-[90vw]',
        size === 'lg' && 'w-180 max-w-[90vw]',
        className
      )}
      onClick={handleBackdropClick}
    >
      <div className="p-4 sm:p-6 md:p-8">
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 id={titleId} className="text-xl font-bold tracking-tight text-text">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={handleCloseButton}
              className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-surface-muted text-text-muted hover:text-text cursor-pointer transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  )
}
