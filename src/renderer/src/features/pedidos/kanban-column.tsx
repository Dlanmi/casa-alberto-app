import { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { ESTADO_PEDIDO_LABEL, ESTADO_PEDIDO_COLOR, type StatusColor } from '@renderer/lib/constants'
import { EMOJI_ESTADO_PEDIDO } from '@renderer/lib/emojis'
import { useEmojis } from '@renderer/contexts/emojis-context'
import type { EstadoPedido, Pedido } from '@shared/types'
import { KanbanCard } from './kanban-card'

const bgClasses: Record<StatusColor, string> = {
  error: 'bg-error-bg',
  warning: 'bg-warning-bg',
  success: 'bg-success-bg',
  info: 'bg-info-bg',
  neutral: 'bg-neutral-bg'
}

// Umbrales de estancamiento por estado. Listo es más agresivo porque
// ahí ya tendrían que llamar al cliente; el resto acepta 3 días de holgura.
const UMBRAL_ESTANCADO: Partial<Record<EstadoPedido, number>> = {
  confirmado: 3,
  en_proceso: 3,
  listo: 2
}

function diasDesdeISO(iso: string): number {
  const ahora = Date.now()
  const inicio = new Date(iso).getTime()
  if (!Number.isFinite(inicio)) return 0
  return Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
}

type KanbanColumnProps = {
  estado: EstadoPedido
  pedidos: Pedido[]
  clienteMap: Map<number, string>
  // Map pedidoId → saldo pendiente. Vacío hasta que cargue el IPC.
  saldosMap?: Map<number, number>
  onCardClick: (pedido: Pedido) => void
  onDrop: (pedidoId: number) => void
  // SPEC-005 — comunicación con el KanbanBoard para mostrar compatibilidad.
  onDragStart?: (pedidoId: number, estadoOrigen: EstadoPedido) => void
  onDragEnd?: () => void
  dragActivePedidoId?: number | null
  dropKind?: 'none' | 'allowed' | 'disabled'
  highlightedId?: number | null
}

export function KanbanColumn({
  estado,
  pedidos,
  clienteMap,
  saldosMap,
  onCardClick,
  onDrop,
  onDragStart,
  onDragEnd,
  dragActivePedidoId = null,
  dropKind = 'none',
  highlightedId = null
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false)
  const color = ESTADO_PEDIDO_COLOR[estado]
  const { enabled: emojisEnabled } = useEmojis()

  // Cuenta pedidos estancados según el umbral del estado. Solo
  // aplica a confirmado/en_proceso/listo (UMBRAL_ESTANCADO devuelve undefined
  // para el resto y el count queda en 0).
  const estancadosCount = useMemo(() => {
    const umbral = UMBRAL_ESTANCADO[estado]
    if (umbral === undefined) return 0
    return pedidos.filter((p) => diasDesdeISO(p.updatedAt) > umbral).length
  }, [pedidos, estado])

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
        'flex flex-col min-w-65 w-65 shrink-0 transition-all duration-200',
        // Feedback más fuerte cuando la columna es destino inválido
        // durante un drag activo: opacidad baja + scale leve la "apaga"
        // visualmente sin romper clicks en sus cards.
        dropKind === 'disabled' && 'opacity-40 scale-[0.985]'
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Column header */}
      <div className={cn('px-3 py-2 rounded-t-lg', bgClasses[color])}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-text truncate">
            {emojisEnabled && (
              <span className="mr-1.5" aria-hidden="true">
                {EMOJI_ESTADO_PEDIDO[estado]}
              </span>
            )}
            {ESTADO_PEDIDO_LABEL[estado]}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Fase 4 — badge de estancamiento. Solo visible si hay >=1
                pedido pasado del umbral. Diseño compacto porque comparte fila
                con el contador de la columna. */}
            {estancadosCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-strong tabular-nums"
                title={`${estancadosCount} pedido${estancadosCount > 1 ? 's' : ''} lleva${estancadosCount > 1 ? 'n' : ''} demasiados días sin avanzar`}
              >
                <AlertCircle size={10} className="shrink-0" />
                {estancadosCount}
              </span>
            )}
            <span className="text-xs font-medium tabular-nums text-text-muted bg-surface/70 px-2 py-0.5 rounded-full">
              {pedidos.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div
        className={cn(
          'flex-1 flex flex-col gap-2 p-2 bg-surface-muted/50 rounded-b-lg min-h-50 overflow-y-auto transition-all',
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
              saldoPendiente={saldosMap?.get(pedido.id)}
              onClick={() => onCardClick(pedido)}
              highlighted={highlightedId === pedido.id}
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
