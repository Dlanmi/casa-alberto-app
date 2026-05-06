// Modal que envuelve el WizardShell en modo embed para agregar (o editar)
// un trabajo dentro del pedido multi-trabajo. Cuando el usuario confirma
// en el último paso, el padre recibe el trabajo cotizado via `onConfirmar`.
//
// El selector de tipoTrabajo se muestra DENTRO del modal cuando el usuario
// no ha elegido aún (primer paso). Una vez elegido, se renderiza el wizard.
import { useState } from 'react'
import { Modal } from '@renderer/components/ui/modal'
import { TipoTrabajoGrid } from '../tipo-trabajo-grid'
import { WizardShell } from '../wizard/wizard-shell'
import type { WizardData, TrabajoConfirmadoEmbed } from '../wizard/wizard-shell'
import type { TipoTrabajoConcreto } from '@shared/types'
import type { TrabajoEnSesion } from './types'

type Props = {
  open: boolean
  onClose: () => void
  onConfirmar: (trabajo: TrabajoEnSesion) => void
  /** Si se pasa, modo edición: precarga el wizard con los datos del trabajo
   *  y reemplaza la entrada existente al confirmar (mismo idLocal). */
  trabajoEditando: TrabajoEnSesion | null
}

export function AgregarTrabajoModal({
  open,
  onClose,
  onConfirmar,
  trabajoEditando
}: Props): React.JSX.Element {
  const [tipoTrabajo, setTipoTrabajo] = useState<TipoTrabajoConcreto | null>(
    trabajoEditando?.tipoTrabajo ?? null
  )

  // Cuando se cierra el modal, reseteamos el selector. El próximo open empieza
  // limpio (a menos que sea edición — en cuyo caso la prop `trabajoEditando`
  // re-fuerza el tipo en el useState inicial al re-mount).
  function handleClose(): void {
    setTipoTrabajo(null)
    onClose()
  }

  function handleConfirmEmbed(trabajo: TrabajoConfirmadoEmbed): void {
    const idLocal = trabajoEditando?.idLocal ?? crypto.randomUUID()
    onConfirmar({
      idLocal,
      tipoTrabajo: trabajo.tipoTrabajo,
      data: trabajo.data,
      cotizacion: trabajo.cotizacion
    })
    setTipoTrabajo(null)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="full"
      title={
        trabajoEditando
          ? `Editar trabajo #${trabajoEditando.idLocal.slice(0, 4)}`
          : tipoTrabajo
            ? 'Configurar trabajo'
            : 'Tipo de trabajo'
      }
    >
      {!tipoTrabajo ? (
        <div className="p-2">
          <p className="text-sm text-text-muted mb-4">
            Elige qué tipo de trabajo trae el cliente para este cuadro o pieza.
          </p>
          <TipoTrabajoGrid
            onSelect={(t) => {
              if (t === 'mixto') return
              setTipoTrabajo(t as TipoTrabajoConcreto)
            }}
            onManagePrecios={() => {
              /* desde el modal no salimos a listas — el usuario puede ir desde el cotizador clásico */
            }}
          />
        </div>
      ) : (
        <WizardShell
          tipoTrabajo={tipoTrabajo}
          modo="embed"
          onBack={handleClose}
          cliente={null}
          onClienteChange={() => undefined}
          initialData={trabajoEditando?.data as Partial<WizardData> | undefined}
          onConfirmarEmbed={handleConfirmEmbed}
        />
      )}
    </Modal>
  )
}
