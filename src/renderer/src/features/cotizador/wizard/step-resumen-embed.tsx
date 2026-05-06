// Versión embed del resumen — usada cuando el wizard se invoca como sub-flujo
// dentro del wizard padre multi-trabajo. Muestra solo el desglose del trabajo
// y un botón "Agregar al pedido". Cliente, descuento global, abono y notas
// del pedido viven en el wizard padre.
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { conceptoIcon, TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { formatCOP } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import type { TipoTrabajo, ResultadoCotizacion } from '@shared/types'
import type { WizardData } from './wizard-shell'

type Props = {
  data: WizardData
  cotizacion: ResultadoCotizacion | null
  tipoTrabajo: TipoTrabajo
  onConfirmar: () => void
  onCancelar: () => void
  /** Texto del botón principal — default "Agregar al pedido". */
  textoConfirmar?: string
}

export function StepResumenEmbed({
  data,
  cotizacion,
  tipoTrabajo,
  onConfirmar,
  onCancelar,
  textoConfirmar = 'Agregar al pedido'
}: Props): React.JSX.Element {
  const Icono = TIPO_TRABAJO_ICON[tipoTrabajo]

  if (!cotizacion) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p className="text-sm">Termina los pasos anteriores para ver el resumen del trabajo.</p>
      </div>
    )
  }

  const tieneMedidas = data.anchoCm > 0 && data.altoCm > 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text mb-1">Resumen del trabajo</h2>
        <p className="text-sm text-text-muted">
          Verifica el desglose y agrega este trabajo al pedido.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-strong">
            <Icono size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">{TIPO_TRABAJO_LABEL[tipoTrabajo]}</p>
            {tieneMedidas && (
              <p className="text-xs text-text-muted mt-0.5">
                {data.anchoCm} × {data.altoCm} cm
                {data.muestraMarco && ` · Marco ${data.muestraMarco.referencia}`}
                {data.conPaspartu && ` · Paspartú ${data.anchoPaspartuCm}cm`}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-1.5">
          {cotizacion.items.map((item, idx) => {
            const Icon = conceptoIcon(item.tipoItem)
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  item.tipoItem === 'descuento' && 'text-red-600'
                )}
              >
                <Icon size={14} className="text-text-muted shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate">{item.descripcion}</span>
                <span className="font-mono tabular-nums">{formatCOP(item.subtotal)}</span>
              </div>
            )
          })}
        </div>

        <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
          <span className="text-sm font-medium text-text">Subtotal del trabajo</span>
          <PrecioDisplay value={cotizacion.precioLista} size="lg" />
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button size="lg" onClick={onConfirmar}>
          {textoConfirmar}
        </Button>
      </div>
    </div>
  )
}
