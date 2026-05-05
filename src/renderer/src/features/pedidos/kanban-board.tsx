import { useRef, useCallback, useEffect, useState } from 'react'
import { Banknote } from 'lucide-react'
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
  // Map global pedidoId → saldo pendiente. El board lo pasa a las columnas
  // para que cada card pueda mostrar el badge rojo "Debe $XXX".
  saldosMap?: Map<number, number>
  // Map paralelo con info completa de la factura (total + pagado). Necesario
  // para construir el contexto del modal QuickPay sin pegarle a otro IPC.
  saldosInfoMap?: Map<number, { total: number; pagado: number }>
  onCardClick: (pedido: Pedido) => void
  onChangeEstado: (pedidoId: number, nuevoEstado: EstadoPedido) => void
  // Quick-pay: abre modal de cobrar abono (sin cambiar estado) cuando se
  // suelta una card con saldo en la drop zone flotante.
  onCobrarAbono?: (pedido: Pedido, saldoPendiente: number, totalFactura: number) => void
  highlightedId?: number | null
}

export function KanbanBoard({
  pedidos,
  clienteMap,
  saldosMap,
  saldosInfoMap,
  onCardClick,
  onChangeEstado,
  onCobrarAbono,
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
  // ID del pedido que acaba de aterrizar en una nueva columna. Se limpia
  // 800ms después para retirar la animación de halo accent (landed-flash).
  const [recentDropId, setRecentDropId] = useState<number | null>(null)
  const recentDropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (recentDropTimerRef.current) clearTimeout(recentDropTimerRef.current)
    }
  }, [])

  const handleChangeEstado = useCallback(
    (pedidoId: number, nuevoEstado: EstadoPedido): void => {
      setRecentDropId(pedidoId)
      if (recentDropTimerRef.current) clearTimeout(recentDropTimerRef.current)
      recentDropTimerRef.current = setTimeout(() => setRecentDropId(null), 800)
      onChangeEstado(pedidoId, nuevoEstado)
    },
    [onChangeEstado]
  )

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

  // Si el usuario suelta la tarjeta fuera del browser (ej. sobre otra
  // app) el dragend de la tarjeta se dispara pero a veces el setState
  // queda pendiente. Un listener global a nivel window garantiza que
  // SIEMPRE se limpie el dragState aunque la interacción termine fuera
  // del árbol de eventos — previene el "estado fantasma" que dejaba
  // columnas atenuadas sin drag activo.
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

  // Drop zone flotante "Cobrar abono": solo visible cuando se está
  // arrastrando una card con saldo pendiente Y la página tiene un handler
  // para procesar el cobro. La zona acepta drop, lee el pedidoId del
  // dataTransfer y llama al callback con el contexto necesario.
  const dragSaldo =
    dragState !== null ? (saldosMap?.get(dragState.pedidoId) ?? 0) : 0
  const dragInfo =
    dragState !== null ? saldosInfoMap?.get(dragState.pedidoId) : undefined
  const dragPedido =
    dragState !== null ? pedidos.find((p) => p.id === dragState.pedidoId) : null
  const mostrarDropZoneCobro =
    !!onCobrarAbono && dragState !== null && dragSaldo > 0 && !!dragInfo && !!dragPedido

  const [dropZoneActive, setDropZoneActive] = useState(false)
  const handleDropZoneOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropZoneActive(true)
  }
  const handleDropZoneLeave = (): void => setDropZoneActive(false)
  const handleDropZoneDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDropZoneActive(false)
    if (!onCobrarAbono || !dragPedido || !dragInfo) return
    const pedidoId = Number(e.dataTransfer.getData('text/plain'))
    if (pedidoId !== dragPedido.id) return
    onCobrarAbono(dragPedido, dragSaldo, dragInfo.total)
  }

  return (
    <div className="relative">
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
            onDrop={(pedidoId) => handleChangeEstado(pedidoId, estado)}
            onDragStart={(pedidoId, estadoOrigen) => setDragState({ pedidoId, estadoOrigen })}
            onDragEnd={() => setDragState(null)}
            dragActivePedidoId={dragState?.pedidoId ?? null}
            dropKind={dropKind}
            highlightedId={highlightedId}
            recentDropId={recentDropId}
          />
        )
      })}
    </div>

    {/* Drop zone flotante "Cobrar abono". Aparece solo durante drag de
        cards con saldo > 0. Posicionada absoluta abajo del board para
        no empujar contenido cuando aparece/desaparece. */}
    {mostrarDropZoneCobro && (
      <div
        className={cn(
          'absolute bottom-2 left-1/2 z-30 -translate-x-1/2 transition-all duration-base',
          'pointer-events-auto'
        )}
        onDragOver={handleDropZoneOver}
        onDragLeave={handleDropZoneLeave}
        onDrop={handleDropZoneDrop}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-full border-2 border-dashed px-6 py-3 text-sm font-semibold shadow-2 transition-all',
            dropZoneActive
              ? 'border-success bg-success-bg text-success-strong scale-105'
              : 'border-warning/60 bg-warning-bg text-warning-strong'
          )}
        >
          <Banknote
            size={20}
            className={cn(
              'shrink-0',
              dropZoneActive ? 'text-success-strong' : 'text-warning-strong'
            )}
          />
          {dropZoneActive ? 'Suelta aquí para cobrar' : 'Soltar aquí para cobrar abono'}
        </div>
      </div>
    )}
    </div>
  )
}
