import { useState } from 'react'
import { cn } from '@renderer/lib/cn'
import { ESTADO_PEDIDO_LABEL, ESTADO_PEDIDO_COLOR, type StatusColor } from '@renderer/lib/constants'
import type { EstadoPedido, Pedido } from '@shared/types'
import { KanbanCard } from './kanban-card'

const bgClasses: Record<StatusColor, string> = {
  error: 'bg-error-bg',
  warning: 'bg-warning-bg',
  success: 'bg-success-bg',
  info: 'bg-info-bg',
  neutral: 'bg-neutral-bg'
}

type KanbanColumnProps = {
  estado: EstadoPedido
  pedidos: Pedido[]
  clienteMap: Map<number, string>
  onCardClick: (pedido: Pedido) => void
  onDrop: (pedidoId: number) => void
  // SPEC-005 — comunicación con el KanbanBoard para mostrar compatibilidad.
  onDragStart?: (pedidoId: number, estadoOrigen: EstadoPedido) => void
  onDragEnd?: () => void
  dragActivePedidoId?: number | null
  dropKind?: 'none' | 'allowed' | 'disabled'
}

export function KanbanColumn({
  estado,
  pedidos,
  clienteMap,
  onCardClick,
  onDrop,
  onDragStart,
  onDragEnd,
  dragActivePedidoId = null,
  dropKind = 'none'
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false)
  const color = ESTADO_PEDIDO_COLOR[estado]

  function handleDragOver(e: React.DragEvent) {
    if (dropKind === 'disabled') {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (dropKind === 'disabled') return
    const pedidoId = Number(e.dataTransfer.getData('text/plain'))
    if (pedidoId) onDrop(pedidoId)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only set false if leaving the column itself, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col min-w-65 w-65 shrink-0 transition-opacity',
        dropKind === 'disabled' && 'opacity-50'
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Column header */}
      <div className={cn('px-3 py-2 rounded-t-[var(--radius-lg)]', bgClasses[color])}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text">{ESTADO_PEDIDO_LABEL[estado]}</span>
          <span className="text-xs font-medium tabular-nums text-text-muted bg-white/70 px-2 py-0.5 rounded-full">
            {pedidos.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        className={cn(
          'flex-1 flex flex-col gap-2 p-2 bg-surface-muted/50 rounded-b-[var(--radius-lg)] min-h-50 overflow-y-auto transition-all',
          dragOver && dropKind !== 'disabled' && 'bg-accent/5 ring-2 ring-accent/40',
          dropKind === 'allowed' && 'ring-1 ring-success/30'
        )}
      >
        {pedidos.map((pedido) => (
          <div
            key={pedido.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(pedido.id))
              e.dataTransfer.effectAllowed = 'move'
              onDragStart?.(pedido.id, estado)
            }}
            onDragEnd={() => onDragEnd?.()}
            className={cn(
              'cursor-grab active:cursor-grabbing transition-opacity',
              dragActivePedidoId === pedido.id && 'opacity-40'
            )}
          >
            <KanbanCard
              pedido={pedido}
              clienteNombre={clienteMap.get(pedido.clienteId)}
              onClick={() => onCardClick(pedido)}
            />
          </div>
        ))}
        {pedidos.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">Sin pedidos</p>
        )}
      </div>
    </div>
  )
}
