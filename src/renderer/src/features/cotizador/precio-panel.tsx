import { useState } from 'react'
import { Card } from '@renderer/components/ui/card'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { conceptoIcon } from '@renderer/lib/iconography'
import { formatCOP } from '@renderer/lib/format'

type CotizacionItem = {
  tipoItem: string
  descripcion: string
  subtotal: number
  referencia?: string
  precioUnitario?: number | null
  cantidad?: number
  metadata?: {
    metros?: number
    areaM2?: number
    perimetroCm?: number
    colillaCm?: number
    anchoRedondeado?: number
    altoRedondeado?: number
    anchoExteriorCm?: number
    altoExteriorCm?: number
  }
}

type PrecioPanelProps = {
  items: CotizacionItem[]
  subtotal: number
  totalMateriales: number
  precioTotal: number
  porcentajeMateriales: number
}

export function PrecioPanel({
  items,
  subtotal,
  totalMateriales,
  precioTotal,
  porcentajeMateriales
}: PrecioPanelProps): React.JSX.Element {
  const [showDetail, setShowDetail] = useState(false)
  // AGENT_UX: Price-flash — al cambiar el total, el bloque se re-monta
  // usando precioTotal como key, lo que re-aplica la animación CSS
  // 'price-flash' (ya definida en main.css). Evita setState en effect.

  return (
    <Card padding="md" className="sticky top-0 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
          Resumen fijo
        </p>
        <h3 className="mt-1 text-base font-semibold text-text">Desglose del precio</h3>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md bg-surface-muted px-4 py-6 text-center">
          <p className="text-sm font-medium text-text">Aún no hay total calculado</p>
          <p className="mt-1 text-sm text-text-muted">
            Completa medidas, acabados o materiales y aquí verás el impacto inmediato.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-md bg-surface-muted p-4">
            {items.map((item, i) => {
              const Icon = conceptoIcon(item.tipoItem)
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon size={14} className="shrink-0 text-accent-strong" />
                    <span className="mr-2 min-w-0 flex-1 truncate font-medium text-text">
                      {item.descripcion}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-text">
                      {formatCOP(item.subtotal)}
                    </span>
                  </div>
                  {showDetail && (
                    <div className="pl-6">
                      {item.metadata?.metros && item.precioUnitario && (
                        <p className="mt-0.5 text-xs tabular-nums text-text-muted">
                          {item.metadata.metros.toFixed(2)}m x {formatCOP(item.precioUnitario)}/m
                        </p>
                      )}
                      {item.metadata?.areaM2 && item.precioUnitario && (
                        <p className="mt-0.5 text-xs tabular-nums text-text-muted">
                          {item.metadata.anchoRedondeado}x{item.metadata.altoRedondeado}cm ={' '}
                          {item.metadata.areaM2.toFixed(2)}m2 x {formatCOP(item.precioUnitario)}/m2
                        </p>
                      )}
                      {item.metadata?.anchoExteriorCm && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          Medida exterior: {item.metadata.anchoExteriorCm}x
                          {item.metadata.altoExteriorCm}cm
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowDetail((prev) => !prev)}
            className="text-xs font-medium text-accent-strong hover:text-accent cursor-pointer"
          >
            {showDetail ? 'Ocultar detalle' : 'Ver detalle'}
          </button>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="tabular-nums text-text">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Materiales ({porcentajeMateriales}%)</span>
              <span className="tabular-nums text-text">{formatCOP(totalMateriales)}</span>
            </div>
            <div
              key={precioTotal}
              className="flex items-center justify-between rounded-md border-t border-border pt-3 px-2 -mx-2 animate-price-flash"
            >
              <span className="font-semibold text-text">Total sugerido</span>
              <PrecioDisplay value={precioTotal} size="lg" className="text-accent" />
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
