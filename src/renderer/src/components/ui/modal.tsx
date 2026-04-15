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
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = 'md',
  initialFocusRef
}: ModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const lastFocusedRef = useRef<HTMLElement | null>(null)

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
      event.preventDefault()
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
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={title ? titleId : undefined}
      aria-modal="true"
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
      <div className="p-4 sm:p-6 lg:p-8">
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 id={titleId} className="text-xl font-semibold text-text">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-sm hover:bg-surface-muted text-text-soft hover:text-text-muted cursor-pointer transition-colors"
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
