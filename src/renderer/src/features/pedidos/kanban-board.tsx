import { useRef, useCallback, useEffect, useState } from 'react'
import type { EstadoPedido, Pedido } from '@shared/types'
import { TRANSICIONES_VALIDAS } from '@shared/pedido-transitions'
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

type KanbanBoardProps = {
  pedidos: Pedido[]
  clienteMap: Map<number, string>
  // Fase 2 — map global pedidoId → saldo pendiente. El board lo pasa a las
  // columnas para que cada card pueda mostrar el badge rojo "Debe $XXX".
  saldosMap?: Map<number, number>
  onCardClick: (pedido: Pedido) => void
  onChangeEstado: (pedidoId: number, nuevoEstado: EstadoPedido) => void
  highlightedId?: number | null
}

export function KanbanBoard({
  pedidos,
  clienteMap,
  saldosMap,
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

  // Fase 10 — si el usuario suelta la tarjeta fuera del browser (ej. sobre
  // otra app) el dragend de la tarjeta se dispara pero a veces el setState
  // queda pendiente. Un listener global a nivel window garantiza que
  // SIEMPRE se limpie el dragState aunque la interacción termine fuera de
  // nuestro árbol de eventos — previene el "estado fantasma" que dejaba
  // columnas atenuadas cuando ya no había drag activo.
  useEffect(() => {
    const handleWindowDragEnd = (): void => setDragState(null)
    window.addEventListener('dragend', handleWindowDragEnd)
    window.addEventListener('drop', handleWindowDragEnd)
    return () => {
      window.removeEventListener('dragend', handleWindowDragEnd)
      window.removeEventListener('drop', handleWindowDragEnd)
    }
  }, [])

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
            saldosMap={saldosMap}
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
