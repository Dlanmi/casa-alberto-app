import { useCallback, useState } from 'react'

/**
 * Hook para proteger cierres silenciosos de modales cuando hay cambios sin
 * guardar. Está pensado para la realidad del dueño de Casa Alberto: mano
 * grande, mouse lento, un click accidental en el backdrop no puede costarle
 * reescribir un contrato completo.
 *
 * Reemplaza al feo `window.confirm` nativo con el `ConfirmDialog` del design
 * system (AlertTriangle, botones 48px, idioma cálido).
 *
 * Uso típico:
 *
 * ```tsx
 * const dirty = nombre.trim().length > 2 || items.length > 1
 * const guard = useDirtyGuard(dirty, onClose)
 *
 * return (
 *   <>
 *     <Modal open onClose={guard.handleClose} onBeforeClose={guard.onBeforeClose} ...>
 *       ...
 *     </Modal>
 *     <ConfirmDialog
 *       open={guard.confirmOpen}
 *       onClose={guard.cancelClose}
 *       onConfirm={guard.confirmClose}
 *       title="¿Descartar cambios?"
 *       message="Tienes cambios sin guardar. Si sales ahora se perderán."
 *       confirmLabel="Sí, descartar"
 *       danger
 *     />
 *   </>
 * )
 * ```
 */
export type DirtyGuard = {
  /** Pasar a `Modal.onBeforeClose`. Retorna false y abre confirm si hay dirty. */
  onBeforeClose: () => boolean
  /** Pasar a `Modal.onClose`. Solo se dispara desde rutas NO-guardadas (ej. botón "Cancelar" propio). */
  handleClose: () => void
  /** Si el ConfirmDialog debe estar abierto. */
  confirmOpen: boolean
  /** El usuario canceló el cierre: oculta el confirm, el modal original queda abierto. */
  cancelClose: () => void
  /** El usuario confirmó el descarte: cierra todo. */
  confirmClose: () => void
}

export function useDirtyGuard(dirty: boolean, onClose: () => void): DirtyGuard {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const onBeforeClose = useCallback((): boolean => {
    if (!dirty) return true
    setConfirmOpen(true)
    return false
  }, [dirty])

  const handleClose = useCallback((): void => {
    onClose()
  }, [onClose])

  const cancelClose = useCallback((): void => {
    setConfirmOpen(false)
  }, [])

  const confirmClose = useCallback((): void => {
    setConfirmOpen(false)
    onClose()
  }, [onClose])

  return { onBeforeClose, handleClose, confirmOpen, cancelClose, confirmClose }
}
