import { useState } from 'react'
import { AlertTriangle, Clock, Calendar } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { EstadoPedidoBadge } from '@renderer/components/shared/estado-badge'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { InitialsAvatar } from '@renderer/components/shared/initials-avatar'
import { formatFechaRelativa, diasRestantes } from '@renderer/lib/format'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import type { Pedido } from '@shared/types'

type KanbanCardProps = {
  pedido: Pedido
  clienteNombre?: string
  pagado?: number
  onClick: () => void
}

export function KanbanCard({ pedido, clienteNombre, pagado = 0, onClick }: KanbanCardProps) {
  const [dragging, setDragging] = useState(false)
  const dias = pedido.fechaEntrega ? diasRestantes(pedido.fechaEntrega) : null
  const atrasado = dias !== null && dias < 0
  const urgente = dias !== null && dias <= 2 && dias >= 0
  const TipoIcon = TIPO_TRABAJO_ICON[pedido.tipoTrabajo]
  const displayName = clienteNombre ?? `Cliente #${pedido.clienteId}`

  const fechaIcon = atrasado ? AlertTriangle : urgente ? Clock : Calendar
  const FechaIcon = fechaIcon

  return (
    // AGENT_UX: Card visual con avatar de iniciales, icono del tipo de
    // trabajo, fecha relativa con icono, PagoBar y badge de estado. Antes
    // era texto plano — ahora es escaneable en 1 segundo.
    <button
      onClick={onClick}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      className={cn(
        'w-full text-left p-4 bg-white rounded-lg shadow-1',
        'transition-all hover:shadow-2 cursor-pointer card-hover',
        'border-2 border-transparent',
        atrasado && 'border-error/40',
        urgente && !atrasado && 'border-warning/40',
        dragging && 'opacity-60 scale-95'
      )}
    >
      {/* Header: avatar + client + number */}
      <div className="mb-3 flex items-start gap-2.5">
        <InitialsAvatar nombre={displayName} id={pedido.clienteId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{displayName}</p>
          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-text-soft">
            {pedido.numero}
          </p>
        </div>
      </div>

      {/* Work type with icon */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-text-muted">
        <TipoIcon size={14} className="shrink-0 text-accent-strong" />
        <span className="truncate">
          {TIPO_TRABAJO_LABEL[pedido.tipoTrabajo]}
          {pedido.anchoCm && pedido.altoCm && (
            <span className="tabular-nums">
              {' '}
              · {pedido.anchoCm}×{pedido.altoCm}
            </span>
          )}
        </span>
      </div>

      {/* Delivery date */}
      {pedido.fechaEntrega && (
        <div
          className={cn(
            'mb-3 flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium',
            atrasado
              ? 'bg-error-bg text-error-strong'
              : urgente
                ? 'bg-warning-bg text-warning-strong'
                : 'bg-surface-muted text-text-muted'
          )}
        >
          <FechaIcon size={12} className="shrink-0" />
          <span className="truncate">
            {atrasado
              ? `Atrasado ${Math.abs(dias!)} día${Math.abs(dias!) > 1 ? 's' : ''}`
              : `${formatFechaRelativa(pedido.fechaEntrega)}${
                  dias !== null && dias > 1 ? ` (en ${dias} días)` : ''
                }`}
          </span>
        </div>
      )}

      {/* Payment progress */}
      <PagoBar total={pedido.precioTotal} pagado={pagado} />

      {/* Footer: state badge */}
      <div className="mt-3 flex items-center justify-end">
        <EstadoPedidoBadge estado={pedido.estado} />
      </div>
    </button>
  )
}
