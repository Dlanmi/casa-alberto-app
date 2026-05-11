// Lista de trabajos cotizados dentro del pedido multi-trabajo. Cada card
// resume las medidas + marco + paspartú + precio. Botones para editar
// (re-abrir modal con datos precargados) y eliminar.
import { Pencil, Trash2, Plus, Frame } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import { formatCOP } from '@renderer/lib/format'
import type { TrabajoEnSesion } from './types'

type Props = {
  trabajos: TrabajoEnSesion[]
  onAgregar: () => void
  onEditar: (idLocal: string) => void
  onEliminar: (idLocal: string) => void
}

export function ListaTrabajos({
  trabajos,
  onAgregar,
  onEditar,
  onEliminar
}: Props): React.JSX.Element {
  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">Trabajos en este pedido</h3>
          <p className="text-xs text-text-muted">
            {trabajos.length === 0
              ? 'Aún no has agregado ningún trabajo.'
              : `${trabajos.length} ${trabajos.length === 1 ? 'trabajo' : 'trabajos'} cotizados.`}
          </p>
        </div>
        <Button onClick={onAgregar} variant="primary" size="sm">
          <Plus size={16} />
          Agregar trabajo
        </Button>
      </div>

      {trabajos.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-border bg-surface-muted/40 px-6 py-10 text-center">
          <p className="text-sm text-text-muted">
            Empieza agregando el primer trabajo del cliente. Cada cuadro o pieza
            se cotiza por separado y se suma al pedido.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {trabajos.map((trabajo, idx) => {
            // Defense in depth: validarEstadoMultiTrabajo descarta drafts
            // con tipoTrabajo desconocido, pero si por mutación interna
            // llega un valor fuera del map, evitamos `<undefined />` que
            // crashea React.
            const Icono = TIPO_TRABAJO_ICON[trabajo.tipoTrabajo] ?? Frame
            const labelTrabajo = TIPO_TRABAJO_LABEL[trabajo.tipoTrabajo] ?? 'Trabajo'
            return (
              <li
                key={trabajo.idLocal}
                className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-strong">
                  <Icono size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-text-muted tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-text">
                      {labelTrabajo}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 truncate">
                    {resumirTrabajo(trabajo)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono tabular-nums text-sm font-semibold text-text">
                    {formatCOP(trabajo.cotizacion.precioLista)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditar(trabajo.idLocal)}
                    aria-label={`Editar trabajo ${idx + 1}`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEliminar(trabajo.idLocal)}
                    aria-label={`Eliminar trabajo ${idx + 1}`}
                    className="text-error hover:text-error-strong hover:bg-error-bg"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function resumirTrabajo(trabajo: TrabajoEnSesion): string {
  const partes: string[] = []
  if (trabajo.tipoTrabajo === 'restauracion') {
    if (trabajo.data.descripcionManual) partes.push(trabajo.data.descripcionManual)
    else partes.push('Restauración manual')
  } else {
    if (trabajo.data.anchoCm > 0 && trabajo.data.altoCm > 0) {
      partes.push(`${trabajo.data.anchoCm} × ${trabajo.data.altoCm} cm`)
    }
    if (trabajo.data.muestraMarco) {
      partes.push(`Marco ${trabajo.data.muestraMarco.referencia}`)
    }
    if (trabajo.data.conPaspartu) {
      partes.push(`paspartú ${trabajo.data.anchoPaspartuCm} cm`)
    }
    if (trabajo.data.conVidrio && trabajo.data.tipoVidrio) {
      partes.push(`vidrio ${trabajo.data.tipoVidrio}`)
    }
  }
  return partes.length > 0 ? partes.join(' · ') : 'Sin detalles'
}
