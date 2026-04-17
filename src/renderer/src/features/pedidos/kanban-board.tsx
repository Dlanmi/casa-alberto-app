import { useRef, useCallback, useEffect, useState } from 'react'
import type { EstadoPedido, Pedido } from '@shared/types'
import { cn } from '@renderer/lib/cn'
import { KanbanColumn } from './kanban-column'

const VISIBLE_ESTADOS: EstadoPedido[] = [
  'cotizado',
  'confirmado',
  'en_proceso',
  'listo',
  'entregado',
  'sin_reclamar'
]

// SPEC-005 — mismo diccionario que `TRANSICIONES_VALIDAS` en backend (pedidos.ts).
// Lo mantenemos sincronizado aquí para dar feedback visual instantáneo al
// arrastrar una tarjeta: resaltamos los destinos válidos y apagamos los inválidos.
const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  cotizado: ['confirmado', 'cancelado'],
  confirmado: ['en_proceso', 'cancelado'],
  en_proceso: ['listo', 'cancelado'],
  listo: ['entregado', 'sin_reclamar', 'cancelado'],
  entregado: [],
  sin_reclamar: ['entregado', 'cancelado'],
  cancelado: []
}

type KanbanBoardProps = {
  pedidos: Pedido[]
  clienteMap: Map<number, string>
  onCardClick: (pedido: Pedido) => void
  onChangeEstado: (pedidoId: number, nuevoEstado: EstadoPedido) => void
  highlightedId?: number | null
}

export function KanbanBoard({
  pedidos,
  clienteMap,
  onCardClick,
  onChangeEstado,
  highlightedId = null
}: KanbanBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })
  // SPEC-005 — estado del drag activo (ID + estado origen) para resaltar
  // columnas compatibles en tiempo real.
  const [dragState, setDragState] = useState<{
    pedidoId: number
    estadoOrigen: EstadoPedido
  } | null>(null)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollState({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8
    })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollState)
      ro.observe(el)
    }
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro?.disconnect()
    }
  }, [updateScrollState])

  const grouped = VISIBLE_ESTADOS.reduce(
    (acc, estado) => {
      acc[estado] = pedidos.filter((p) => p.estado === estado)
      return acc
    },
    {} as Record<EstadoPedido, Pedido[]>
  )

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-4 overflow-x-auto pb-4 scroll-fade',
        scrollState.left && 'scroll-fade--left',
        scrollState.right && 'scroll-fade--right'
      )}
    >
      {VISIBLE_ESTADOS.map((estado) => {
        let dropKind: 'none' | 'allowed' | 'disabled' = 'none'
        if (dragState) {
          if (dragState.estadoOrigen === estado) {
            dropKind = 'disabled' // misma columna de origen
          } else {
            const permitidos = TRANSICIONES_VALIDAS[dragState.estadoOrigen] ?? []
            dropKind = permitidos.includes(estado) ? 'allowed' : 'disabled'
          }
        }
        return (
          <KanbanColumn
            key={estado}
            estado={estado}
            pedidos={grouped[estado] ?? []}
            clienteMap={clienteMap}
            onCardClick={onCardClick}
            onDrop={(pedidoId) => onChangeEstado(pedidoId, estado)}
            onDragStart={(pedidoId, estadoOrigen) => setDragState({ pedidoId, estadoOrigen })}
            onDragEnd={() => setDragState(null)}
            dragActivePedidoId={dragState?.pedidoId ?? null}
            dropKind={dropKind}
            highlightedId={highlightedId}
          />
        )
      })}
    </div>
  )
}
