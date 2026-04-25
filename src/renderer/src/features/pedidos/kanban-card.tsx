import { useState } from 'react'
import { AlertTriangle, Clock, Calendar, UserX, DollarSign } from 'lucide-react'
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
  // Saldo pagado. Si es undefined, la tarjeta NO muestra PagoBar (evita
  // el bug visual previo donde siempre se mostraba 0% aunque hubiera pagos
  // — el detail panel es quien muestra el dato real). Pasar 0 explícito
  // solo cuando realmente sepamos que no hay pagos.
  pagado?: number
  // Saldo pendiente calculado por el backend en una sola query. Cuando >0
  // mostramos badge rojo "Debe $XXX" para que el dueño vea de un vistazo
  // quién tiene cuentas pendientes sin abrir el detalle.
  saldoPendiente?: number
  onClick: () => void
  // Si true, renderiza un ring acento para destacar el pedido recién
  // creado tras auto-navegación desde el cotizador.
  highlighted?: boolean
}

// Días transcurridos desde una fecha ISO con o sin tiempo. Local a esta
// card porque no merece promoverlo a format.ts hasta que lo use otro lado.
function diasDesde(iso: string): number {
  const ahora = Date.now()
  const inicio = new Date(iso).getTime()
  if (!Number.isFinite(inicio)) return 0
  return Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
}

export function KanbanCard({
  pedido,
  clienteNombre,
  pagado,
  saldoPendiente,
  onClick,
  highlighted = false
}: KanbanCardProps) {
  const [dragging, setDragging] = useState(false)
  const dias = pedido.fechaEntrega ? diasRestantes(pedido.fechaEntrega) : null
  const atrasado = dias !== null && dias < 0
  const urgente = dias !== null && dias <= 2 && dias >= 0
  const TipoIcon = TIPO_TRABAJO_ICON[pedido.tipoTrabajo]
  // Si el cliente fue eliminado/desactivado, el clienteMap no lo trae.
  // Mostramos "Cliente eliminado" con tooltip explicativo en vez del
  // fallback silencioso "Cliente #N" que confunde al usuario.
  const clienteEliminado = !clienteNombre
  const displayName = clienteNombre ?? `Cliente #${pedido.clienteId}`

  const fechaIcon = atrasado ? AlertTriangle : urgente ? Clock : Calendar
  const FechaIcon = fechaIcon

  // Badge "hace N días" cuando el pedido lleva demasiado tiempo sin
  // moverse. Umbral más agresivo (>2) para estado `listo` porque ahí ya
  // debería estar llamando al cliente; >3 para el resto.
  const diasEnTablero =
    pedido.estado === 'confirmado' || pedido.estado === 'en_proceso' || pedido.estado === 'listo'
      ? diasDesde(pedido.updatedAt)
      : 0
  const umbralDias = pedido.estado === 'listo' ? 2 : 3
  const muestraDiasEstado = diasEnTablero > umbralDias

  return (
    // AGENT_UX: Card visual con avatar de iniciales, icono del tipo de
    // trabajo, fecha relativa con icono, PagoBar y badge de estado. Antes
    // era texto plano — ahora es escaneable en 1 segundo.
    <button
      onClick={onClick}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      className={cn(
        'w-full text-left p-4 bg-surface rounded-lg shadow-1',
        'transition-all hover:shadow-2 cursor-pointer card-hover',
        'border-2 border-transparent',
        atrasado && 'border-error/40',
        urgente && !atrasado && 'border-warning/40',
        highlighted && 'ring-4 ring-accent ring-offset-2 animate-pulse',
        dragging && 'opacity-60 scale-95'
      )}
    >
      {/* Header: avatar + client + number */}
      <div className="mb-3 flex items-start gap-2.5">
        <InitialsAvatar nombre={displayName} id={pedido.clienteId} size="sm" />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-semibold text-text flex items-center gap-1',
              clienteEliminado && 'text-text-muted italic'
            )}
            title={
              clienteEliminado
                ? 'Cliente eliminado o desactivado — solo queda referencia histórica'
                : undefined
            }
          >
            {clienteEliminado ? 'Cliente eliminado' : displayName}
            {clienteEliminado && <UserX size={12} className="shrink-0 text-warning-strong" />}
          </p>
          <p className="mt-0.5 text-xs font-medium tabular-nums text-text-muted">{pedido.numero}</p>
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

      {/* Payment progress — solo si tenemos data real de pagos cargada */}
      {pagado !== undefined && <PagoBar total={pedido.precioTotal} pagado={pagado} />}

      {/* Badge de saldo pendiente. Destacado en rojo solo cuando realmente
          hay deuda. El dueño lo ve sin abrir el detalle. */}
      {saldoPendiente !== undefined && saldoPendiente > 0 && (
        <div
          className="mt-2 flex items-center gap-1 rounded-sm bg-error-bg px-2 py-1 text-xs font-semibold text-error-strong"
          title={`Falta cobrar $${saldoPendiente.toLocaleString('es-CO')} de este pedido`}
        >
          <DollarSign size={11} className="shrink-0" />
          <span className="tabular-nums">Debe ${saldoPendiente.toLocaleString('es-CO')}</span>
        </div>
      )}

      {/* Footer: state badge + días en estado si lleva demasiado */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {muestraDiasEstado ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
              diasEnTablero > 7
                ? 'bg-warning-bg text-warning-strong'
                : 'bg-surface-muted text-text-muted'
            )}
            title={`Este pedido lleva ${diasEnTablero} días sin avanzar de estado.`}
          >
            <Clock size={11} className="shrink-0" />
            hace {diasEnTablero} días
          </span>
        ) : (
          <span />
        )}
        <EstadoPedidoBadge estado={pedido.estado} />
      </div>
    </button>
  )
}
