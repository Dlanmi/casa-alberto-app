import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, ClipboardList, Calculator, Archive } from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { SearchInput } from '@renderer/components/ui/search-input'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useToast } from '@renderer/contexts/toast-context'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { EMOJI_TOAST, EMOJI_ESTADO_PEDIDO } from '@renderer/lib/emojis'
import { PageLoader } from '@renderer/components/ui/spinner'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { FrameIllustration } from '@renderer/components/illustrations'
import { cn } from '@renderer/lib/cn'
import { extractPedidoIds, type PedidoAlertaRow } from '@renderer/lib/pedidos-alertas'
import { KanbanBoard } from './kanban-board'
import { PedidoListView } from './pedido-list-view'
import { PedidoDetailPanel } from './pedido-detail-panel'
import type { Pedido, EstadoPedido, IpcResult, Cliente } from '@shared/types'

type SaldoPedido = { pedidoId: number; total: number; pagado: number; saldo: number }

type FocusKey =
  | 'todos'
  | 'requiere_accion'
  | 'atrasados'
  | 'proximos'
  | 'sin_abono'
  | 'urgente_sin_abono'
  | 'listos'

const FOCUS_LABEL: Record<FocusKey, string> = {
  todos: 'Todos',
  requiere_accion: 'Requiere acción',
  atrasados: 'Atrasados',
  proximos: 'Próximos',
  sin_abono: 'Sin abono',
  urgente_sin_abono: 'Urgente sin abono',
  listos: 'Listos'
}

export default function PedidosPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { emoji } = useEmojis()
  const [selected, setSelected] = useState<Pedido | null>(null)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  // Fase 6 — toggle "Ver archivados". Por defecto oculta entregados de hace
  // más de 30 días para no inflar el kanban con histórico; papá puede
  // habilitarlo cuando necesita revisar o reimprimir facturas viejas.
  const [incluirArchivados, setIncluirArchivados] = useState(false)

  // Fase 3 — highlight: tras crear un pedido en el cotizador, la URL trae
  // ?highlight=ID. Resaltamos la tarjeta/fila correspondiente por 3s para que
  // papá vea con claridad dónde quedó su nuevo pedido.
  const highlightParam = searchParams.get('highlight')
  const highlightedId = highlightParam ? Number(highlightParam) : null

  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('highlight')
          return next
        },
        { replace: true }
      )
    }, 3000)
    return () => clearTimeout(timer)
  }, [highlightedId, setSearchParams])

  const currentFocus = (() => {
    const focus = searchParams.get('focus')
    if (
      focus === 'todos' ||
      focus === 'requiere_accion' ||
      focus === 'atrasados' ||
      focus === 'proximos' ||
      focus === 'sin_abono' ||
      focus === 'urgente_sin_abono' ||
      focus === 'listos'
    ) {
      return focus
    }
    return 'todos'
  })() as FocusKey

  const {
    data: pedidos,
    loading,
    refetch
  } = useIpc<Pedido[]>(
    () => window.api.pedidos.listar({ incluirArchivados }),
    [incluirArchivados]
  )

  const { data: clientes } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  // Fase 2 — saldos por pedido. Se refetchan junto con pedidos para que el
  // badge "Debe $XXX" refleje abonos hechos desde el detail panel o en el
  // módulo de facturas.
  const { data: saldos, refetch: refetchSaldos } = useIpc<SaldoPedido[]>(
    () => window.api.pedidos.saldos(),
    []
  )

  const { data: atrasados } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.atrasados(),
    []
  )

  const { data: proximos } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.entregaProxima(2),
    []
  )

  const { data: sinAbono } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.sinAbono(),
    []
  )

  const clienteMap = useMemo(() => {
    const map = new Map<number, string>()
    clientes?.forEach((cliente) => map.set(cliente.id, cliente.nombre))
    return map
  }, [clientes])

  const saldosMap = useMemo(() => {
    const map = new Map<number, number>()
    saldos?.forEach((s) => map.set(s.pedidoId, s.saldo))
    return map
  }, [saldos])

  // Map paralelo con {total, pagado} para que la vista lista pueda pintar
  // la PagoBar con proporciones reales (el total puede venir de la factura
  // activa, no necesariamente de precioTotal).
  const saldosInfoMap = useMemo(() => {
    const map = new Map<number, { total: number; pagado: number }>()
    saldos?.forEach((s) => map.set(s.pedidoId, { total: s.total, pagado: s.pagado }))
    return map
  }, [saldos])

  const atrasadosIds = useMemo(() => extractPedidoIds(atrasados), [atrasados])
  const proximosIds = useMemo(() => extractPedidoIds(proximos), [proximos])
  const sinAbonoIds = useMemo(() => extractPedidoIds(sinAbono), [sinAbono])

  const filteredPedidos = useMemo(() => {
    const base = pedidos ?? []
    const focused = base.filter((pedido) => {
      if (currentFocus === 'todos') return true
      if (currentFocus === 'listos') return pedido.estado === 'listo'
      if (currentFocus === 'atrasados') return atrasadosIds.has(pedido.id)
      if (currentFocus === 'proximos') return proximosIds.has(pedido.id)
      if (currentFocus === 'sin_abono') return sinAbonoIds.has(pedido.id)
      // BR-001: intersección urgente (≤2 días) ∩ sin abono. Cuadrante crítico
      // del dashboard: lo que hay que atender primero.
      if (currentFocus === 'urgente_sin_abono')
        return proximosIds.has(pedido.id) && sinAbonoIds.has(pedido.id)
      return ['confirmado', 'en_proceso', 'listo'].includes(pedido.estado)
    })

    const q = search.trim().toLowerCase()
    if (!q) return focused

    return focused.filter((pedido) => {
      const clienteNombre = clienteMap.get(pedido.clienteId)?.toLowerCase() ?? ''
      return (
        pedido.numero.toLowerCase().includes(q) ||
        (pedido.descripcion ?? '').toLowerCase().includes(q) ||
        clienteNombre.includes(q)
      )
    })
  }, [atrasadosIds, clienteMap, currentFocus, pedidos, proximosIds, search, sinAbonoIds])

  const focusCounts = useMemo(() => {
    const base = pedidos ?? []
    let urgenteSinAbonoCount = 0
    for (const id of proximosIds) {
      if (sinAbonoIds.has(id)) urgenteSinAbonoCount++
    }
    return {
      todos: base.length,
      requiere_accion: base.filter((pedido) =>
        ['confirmado', 'en_proceso', 'listo'].includes(pedido.estado)
      ).length,
      atrasados: atrasadosIds.size,
      proximos: proximosIds.size,
      sin_abono: sinAbonoIds.size,
      urgente_sin_abono: urgenteSinAbonoCount,
      listos: base.filter((pedido) => pedido.estado === 'listo').length
    }
  }, [atrasadosIds.size, pedidos, proximosIds, sinAbonoIds])

  const handleChangeEstado = useCallback(
    async (pedidoId: number, nuevoEstado: EstadoPedido) => {
      const oldPedido = pedidos?.find((p) => p.id === pedidoId)
      if (!oldPedido) return

      // Fase 3 — bloqueo duro: no permitir mover a "entregado" si la factura
      // todavía tiene saldo pendiente. Evita que papá entregue un cuadro
      // sin haber terminado de cobrarlo. Si no hay factura aún, saldo es
      // `undefined` y no bloqueamos (ese caso es escalamiento normal).
      if (nuevoEstado === 'entregado') {
        const saldoPendiente = saldosMap.get(pedidoId)
        if (saldoPendiente !== undefined && saldoPendiente > 0) {
          showToast({
            tone: 'error',
            title: 'No se puede entregar sin cobrar el saldo',
            message: `Falta cobrar $${saldoPendiente.toLocaleString('es-CO')} del pedido ${oldPedido.numero}. Registra el abono antes de marcar entregado.`
          })
          return
        }
      }

      if (
        sinAbonoIds.has(pedidoId) &&
        ['confirmado', 'en_proceso', 'listo'].includes(nuevoEstado)
      ) {
        showToast({
          tone: 'warning',
          title: 'Pedido sin abono',
          message: `El pedido ${oldPedido.numero} no tiene abono registrado. Considera cobrar antes de avanzar.`
        })
      }

      const result = (await window.api.pedidos.cambiarEstado(
        pedidoId,
        nuevoEstado
      )) as IpcResult<Pedido>

      if (result.ok) {
        // Fase 8 — si el pedido movido ya no encaja en el filtro activo,
        // mostramos acción "Ver todos" para que papá no piense que
        // "desapareció". Ej: estaba en "Listos" y lo marca Entregado.
        const saleDelFoco = !pedidoCumpleFoco(result.data, currentFocus, {
          atrasadosIds,
          proximosIds,
          sinAbonoIds
        })
        const titleEmoji =
          nuevoEstado === 'entregado'
            ? EMOJI_TOAST.pedido_entregado
            : EMOJI_ESTADO_PEDIDO[nuevoEstado]
        showToast({
          tone: 'success',
          title: `${emoji(titleEmoji)} Pedido ${oldPedido.numero} actualizado`.trim(),
          message: saleDelFoco
            ? `Ya no aparece en "${FOCUS_LABEL[currentFocus]}" porque cambió de estado. ${getEstadoMessage(nuevoEstado)}`
            : getEstadoMessage(nuevoEstado),
          actionLabel: saleDelFoco ? 'Ver todos' : getEstadoActionLabel(nuevoEstado),
          onAction: () => {
            if (saleDelFoco) {
              setSearchParams({})
              return
            }
            if (nuevoEstado === 'listo') {
              navigate('/facturas')
              return
            }
            // Deshacer: devolver al estado anterior. El refetch se hace en
            // .then() para que el kanban se resincronice con el backend.
            window.api.pedidos
              .cambiarEstado(pedidoId, oldPedido.estado)
              .then(() => {
                refetch()
                refetchSaldos()
              })
              .catch(() => {})
          }
        })
        refetch()
        refetchSaldos()
        if (selected?.id === pedidoId) {
          setSelected(result.data)
        }
      } else {
        // Fase 7 — rollback: si el backend rechazó el cambio (transición
        // inválida, error de transacción, etc.) refetchamos para asegurar
        // que la UI vuelva al estado real. Sin esto, si hubo un cambio
        // visual optimista, quedaría desincronizado.
        showToast({
          tone: 'error',
          title: 'No se pudo actualizar el pedido',
          message: result.error
        })
        refetch()
        refetchSaldos()
      }
    },
    [
      atrasadosIds,
      currentFocus,
      emoji,
      navigate,
      pedidos,
      proximosIds,
      refetch,
      refetchSaldos,
      saldosMap,
      selected,
      setSearchParams,
      showToast,
      sinAbonoIds
    ]
  )

  // Fase 11 — polling two-tab sync: si papá tiene la app abierta en varias
  // ventanas (o cambia en facturas y vuelve a pedidos), refetchamos cada
  // 10s. Solo cuando la pestaña está visible para no gastar CPU en second.
  // Además refetch inmediato al ganar visibilidad (document.visibilityState).
  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState !== 'visible') return
      refetch()
      refetchSaldos()
    }
    const handleVis = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    const id = window.setInterval(tick, 10_000)
    document.addEventListener('visibilitychange', handleVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', handleVis)
    }
  }, [refetch, refetchSaldos])

  // Solo mostramos el loader en la carga inicial (cuando aún no hay datos).
  // En refetches (polling de 10s, cambios de estado, abono rápido) el hook
  // vuelve a poner loading=true brevemente, pero conservamos el kanban en
  // pantalla porque `pedidos` sigue sosteniendo los datos previos — el
  // refetch es transparente para papá. Antes, cada tick del polling
  // reemplazaba el tablero completo por el spinner → parecía recarga.
  if (loading && !pedidos) return <PageLoader />

  return (
    <OperationalBoard
      eyebrow="Operational board"
      title="Pedidos en producción"
      subtitle="Confirma, produce, entrega o deriva a cobro desde un solo tablero con foco operativo."
      guidance={{
        tone: currentFocus === 'sin_abono' || currentFocus === 'atrasados' ? 'warning' : 'info',
        title:
          currentFocus === 'todos'
            ? 'Filtra primero por intención'
            : `Vista enfocada: ${FOCUS_LABEL[currentFocus]}`,
        message:
          currentFocus === 'todos'
            ? 'Usa los focos rápidos para abrir solo lo que requiere decisión hoy: retrasos, próximos a entregar o cobros pendientes.'
            : 'Esta vista ya recorta el trabajo para que no tengas que buscar manualmente qué atender.'
      }}
      primaryAction={{
        label: 'Nueva cotización',
        onClick: () => navigate('/cotizador'),
        icon: Calculator,
        variant: 'primary'
      }}
      filters={
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FOCUS_LABEL) as FocusKey[]).map((focus) => (
              <button
                key={focus}
                type="button"
                onClick={() => setSearchParams(focus === 'todos' ? {} : { focus })}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  currentFocus === focus
                    ? 'border-accent bg-accent/10 text-accent-strong'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                )}
              >
                {FOCUS_LABEL[focus]}{' '}
                <span className="ml-1 tabular-nums text-text-soft">({focusCounts[focus]})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch('')}
                placeholder="Buscar por número, cliente o descripción..."
              />
            </div>
            {/* Fase 6 — toggle Ver archivados */}
            <button
              type="button"
              onClick={() => setIncluirArchivados((prev) => !prev)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                incluirArchivados
                  ? 'border-accent bg-accent/10 text-accent-strong'
                  : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
              )}
              title={
                incluirArchivados
                  ? 'Mostrando entregados de más de 30 días. Clic para ocultar.'
                  : 'Mostrar también pedidos entregados hace más de 30 días.'
              }
            >
              <Archive size={15} />
              {incluirArchivados ? 'Archivados visibles' : 'Ver archivados'}
            </button>
            <div className="flex bg-surface-muted rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setView('kanban')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors cursor-pointer',
                  view === 'kanban'
                    ? 'bg-surface text-text shadow-1'
                    : 'text-text-soft hover:text-text-muted'
                )}
              >
                <LayoutGrid size={16} />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors cursor-pointer',
                  view === 'list'
                    ? 'bg-surface text-text shadow-1'
                    : 'text-text-soft hover:text-text-muted'
                )}
              >
                <List size={16} />
                Lista
              </button>
            </div>
          </div>
        </div>
      }
    >
      {(pedidos ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          illustration={<FrameIllustration size={140} />}
          title="Aún no hay pedidos"
          description="Crea una cotización y confírmala para verlos aquí."
          actionLabel="Ir al Cotizador"
          onAction={() => navigate('/cotizador')}
        />
      ) : view === 'kanban' ? (
        <KanbanBoard
          pedidos={filteredPedidos}
          clienteMap={clienteMap}
          saldosMap={saldosMap}
          onCardClick={setSelected}
          onChangeEstado={handleChangeEstado}
          highlightedId={highlightedId}
        />
      ) : (
        <PedidoListView
          pedidos={filteredPedidos}
          onRowClick={setSelected}
          clienteMap={clienteMap}
          saldosInfoMap={saldosInfoMap}
          highlightedId={highlightedId}
        />
      )}

      {selected && (
        <PedidoDetailPanel
          pedido={selected}
          onClose={() => setSelected(null)}
          onChangeEstado={handleChangeEstado}
          onPedidoUpdated={async () => {
            refetch()
            refetchSaldos()
            // Refresh the selected pedido so the panel shows updated data
            const updated = (await window.api.pedidos.obtener(
              selected.id
            )) as IpcResult<Pedido | null>
            if (updated.ok && updated.data) {
              setSelected(updated.data)
            }
          }}
        />
      )}
    </OperationalBoard>
  )
}

function getEstadoMessage(estado: EstadoPedido): string {
  if (estado === 'confirmado') return 'El trabajo ya puede pasar a producción.'
  if (estado === 'en_proceso') return 'Este pedido quedó marcado como trabajo activo.'
  if (estado === 'listo') return 'Ya puedes coordinar la entrega o generar la factura.'
  if (estado === 'entregado') return 'El proceso quedó cerrado como entrega finalizada.'
  return `Estado actualizado a ${estado}.`
}

function getEstadoActionLabel(estado: EstadoPedido): string | undefined {
  if (estado === 'listo') return 'Ir a facturas'
  if (estado === 'confirmado' || estado === 'en_proceso') return 'Deshacer'
  return undefined
}

// Fase 8 — determina si un pedido recién actualizado sigue perteneciendo al
// foco activo. Reutilizamos la misma lógica del filtrado de la vista para
// mantener consistencia — si los criterios cambian, se actualizan en un solo
// lugar.
function pedidoCumpleFoco(
  pedido: Pedido,
  focus: FocusKey,
  ids: { atrasadosIds: Set<number>; proximosIds: Set<number>; sinAbonoIds: Set<number> }
): boolean {
  if (focus === 'todos') return true
  if (focus === 'listos') return pedido.estado === 'listo'
  if (focus === 'atrasados') return ids.atrasadosIds.has(pedido.id)
  if (focus === 'proximos') return ids.proximosIds.has(pedido.id)
  if (focus === 'sin_abono') return ids.sinAbonoIds.has(pedido.id)
  if (focus === 'urgente_sin_abono')
    return ids.proximosIds.has(pedido.id) && ids.sinAbonoIds.has(pedido.id)
  // requiere_accion
  return (['confirmado', 'en_proceso', 'listo'] as EstadoPedido[]).includes(pedido.estado)
}
