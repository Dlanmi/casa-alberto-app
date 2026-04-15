import { Modal } from '@renderer/components/ui/modal'
import { Button } from '@renderer/components/ui/button'
import { AlertTriangle } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  loading = false
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${danger ? 'bg-error-bg text-error-strong' : 'bg-warning-bg text-warning-strong'}`}
        >
          <AlertTriangle size={24} />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-text">{title}</h3>
        <p className="mb-3 text-sm text-text-muted">{message}</p>
        <p className="mb-6 text-xs text-text-soft">
          {danger
            ? 'Esta acción cambia el estado actual y no se puede recuperar automáticamente.'
            : 'Confirma solo si este es el siguiente paso correcto en el flujo.'}
        </p>
        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
