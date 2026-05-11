import { useRef, useState } from 'react'
import {
  X,
  CreditCard,
  FileText,
  CheckCircle,
  Hammer,
  Package,
  Truck,
  Inbox,
  Calendar,
  Check,
  Pencil,
  Download
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import { Toggle } from '@renderer/components/ui/toggle'
import { EstadoPedidoBadge } from '@renderer/components/shared/estado-badge'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { cn } from '@renderer/lib/cn'
import { formatCOP } from '@renderer/lib/format'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { useToast } from '@renderer/contexts/toast-context'
import { useSlidePanel, SLIDE_PANEL_EXIT_MS } from '@renderer/hooks/use-slide-panel'
import {
  TIPO_TRABAJO_LABEL,
  ESTADO_PEDIDO_LABEL,
  DEFAULT_LIST_QUERY_LIMIT
} from '@renderer/lib/constants'
import type { LucideIcon } from 'lucide-react'
import type { Cliente, Pedido, Factura, EstadoPedido, IpcResult, PedidoItem } from '@shared/types'

const NEXT_ESTADO: Partial<Record<EstadoPedido, EstadoPedido>> = {
  cotizado: 'confirmado',
  confirmado: 'en_proceso',
  en_proceso: 'listo',
  listo: 'entregado'
}

// AGENT_UX: Timeline visual del ciclo de vida del pedido (PRO-004).
// Muestra los 5 estados principales como hitos con icono. El actual es
// accent, los anteriores son success, los posteriores neutral.
type TimelineStage = { estado: EstadoPedido; label: string; icon: LucideIcon }

const TIMELINE_STAGES: TimelineStage[] = [
  { estado: 'cotizado', label: 'Cotizado', icon: FileText },
  { estado: 'confirmado', label: 'Confirmado', icon: CheckCircle },
  { estado: 'en_proceso', label: 'En proceso', icon: Hammer },
  { estado: 'listo', label: 'Listo', icon: Package },
  { estado: 'entregado', label: 'Entregado', icon: Truck }
]

function stageIndex(estado: EstadoPedido): number {
  const idx = TIMELINE_STAGES.findIndex((s) => s.estado === estado)
  if (idx >= 0) return idx
  // sin_reclamar y cancelado no pasan por el timeline lineal
  return -1
}

type Props = {
  pedido: Pedido
  onClose: () => void
  onChangeEstado: (pedidoId: number, estado: EstadoPedido) => void
  onPedidoUpdated?: () => void
}

export function PedidoDetailPanel({
  pedido,
  onClose,
  onChangeEstado,
  onPedidoUpdated
}: Props): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { closing, requestClose } = useSlidePanel({
    onClose,
    closeRef,
    exitDurationMs: SLIDE_PANEL_EXIT_MS
  })
  const [pagandoMonto, setPagandoMonto] = useState<number | null>(null)
  // C3 — Lock sincrónico para evitar double-submit en quick-pay. El estado
  // React se actualiza en el siguiente tick, así que clicks rapidísimos (o
  // bubbling de mouse) podían disparar 2+ registrarPago antes de que el
  // disabled={pagandoMonto !== null} se reflejara en el DOM. Este ref se
  // setea antes del await, en el mismo tick del handler, como guard real.
  const payingRef = useRef(false)
  const [editingFecha, setEditingFecha] = useState(false)
  const [fechaInput, setFechaInput] = useState(pedido.fechaEntrega ?? '')
  const [savingFecha, setSavingFecha] = useState(false)
  const [editingComercial, setEditingComercial] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const nextEstado = NEXT_ESTADO[pedido.estado]
  const puedeEditarComercial = pedido.estado !== 'entregado' && pedido.estado !== 'cancelado'

  // Fetch facturas for this pedido to find a linked factura
  const {
    data: facturas,
    loading: facturasLoading,
    refetch: refetchFacturas
  } = useIpc<Factura[]>(
    () => window.api.facturas.listar({ limit: DEFAULT_LIST_QUERY_LIMIT }),
    [pedido.id]
  )

  // Find the active factura for this pedido
  const facturasDelPedido =
    facturas?.filter((f) => f.pedidoId === pedido.id && f.estado !== 'anulada') ?? []
  const facturaActiva = facturasDelPedido.length > 0 ? facturasDelPedido[0] : null

  // Fetch the real saldo from the backend when a factura exists
  const {
    data: saldo,
    loading: saldoLoading,
    refetch: refetchSaldo
  } = useIpc<number>(
    () =>
      facturaActiva
        ? window.api.facturas.saldo(facturaActiva.id)
        : Promise.resolve({ ok: true, data: 0 }),
    [facturaActiva?.id ?? null]
  )

  // pagado = total de la factura - saldo pendiente
  const pagado = facturaActiva && saldo != null ? facturaActiva.total - saldo : 0
  const saldoPendiente = facturaActiva && saldo != null ? saldo : 0

  /**
   * Genera el PDF del pedido. Si tiene factura activa, usa el número de
   * factura formal; si no, genera una cotización con número COT-... La data
   * (items, descuento, motivo) viene del pedido — incluye todo lo necesario
   * para que la PDF muestre el desglose correcto.
   */
  async function handleGenerarPDF(): Promise<void> {
    setGenerandoPdf(true)
    try {
      const pedidoRes = (await window.api.pedidos.obtener(pedido.id)) as IpcResult<
        Pedido & { items?: PedidoItem[] }
      >
      if (!pedidoRes.ok) {
        showToast({
          tone: 'error',
          title: 'No se pudieron cargar los items',
          message: pedidoRes.error
        })
        return
      }
      const clienteRes = (await window.api.clientes.obtener(pedido.clienteId)) as IpcResult<Cliente>
      const cliente = clienteRes.ok ? clienteRes.data : null

      // v2.2.0+: propagamos metadata.trabajoId al PDF para que items de un
      // pedido multi-trabajo se agrupen visualmente. Pedidos viejos sin
      // metadata se renderizan como lista plana (comportamiento histórico).
      const pdfItems =
        pedidoRes.data.items?.map((it) => {
          const md = (it as { metadata?: { trabajoId?: number; tipoTrabajoOrigen?: string; medidas?: { anchoCm: number; altoCm: number } } | null }).metadata ?? null
          return {
            descripcion: it.descripcion ?? 'Item',
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario ?? it.subtotal,
            subtotal: it.subtotal,
            ...(md?.trabajoId != null ? { trabajoId: md.trabajoId } : {}),
            ...(md?.tipoTrabajoOrigen
              ? { tipoTrabajoOrigen: md.tipoTrabajoOrigen as never }
              : {}),
            ...(md?.medidas ? { medidasTrabajo: md.medidas } : {})
          }
        }) ?? []

      const pdfPagos: { fecha: string; monto: number; metodo: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' }[] = []
      const numero = facturaActiva
        ? facturaActiva.numero
        : `COT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${pedido.id}`

      const result = (await window.api.pdf.generarFactura({
        numero,
        fecha: new Date().toISOString().slice(0, 10),
        clienteNombre: cliente?.nombre ?? 'Sin cliente',
        clienteCedula: cliente?.cedula,
        clienteTelefono: cliente?.telefono,
        clienteDireccion: cliente?.direccion,
        items: pdfItems,
        subtotal: pedido.subtotal,
        totalMateriales: pedido.totalMateriales,
        precioLista: pedido.precioLista || pedido.precioTotal,
        descuentoMonto: pedido.descuentoMonto ?? 0,
        descuentoMotivo: pedido.descuentoMotivo,
        total: pedido.precioTotal,
        pagos: pdfPagos,
        saldo: saldoPendiente,
        notas: pedido.notas
      })) as IpcResult<string>

      if (result.ok) {
        showToast({
          tone: 'success',
          title: 'PDF generado',
          message: facturaActiva ? 'Factura abierta para imprimir o enviar.' : 'Cotización abierta.'
        })
        await window.api.pdf.abrir(result.data)
      } else {
        showToast({ tone: 'error', title: 'No se pudo generar el PDF', message: result.error })
      }
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al generar PDF',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setGenerandoPdf(false)
    }
  }

  // SPEC-006: registra un abono rápido contra la factura activa del pedido.
  // Recorta el monto al saldo pendiente (no permite sobre-pago) y refresca
  // tanto facturas como saldo para que la pago-bar se actualice al instante.
  const handleQuickPay = async (montoSolicitado: number): Promise<void> => {
    if (!facturaActiva || saldoPendiente <= 0) return
    // C3 — Guard sincrónico contra double-submit. Si ya hay un pago en vuelo
    // lo ignoramos antes de tocar el servidor o el estado React.
    if (payingRef.current) return
    payingRef.current = true
    const monto = Math.min(montoSolicitado, saldoPendiente)
    setPagandoMonto(montoSolicitado)
    try {
      const result = (await window.api.facturas.registrarPago({
        facturaId: facturaActiva.id,
        monto,
        metodoPago: 'efectivo',
        fecha: new Date().toISOString().slice(0, 10),
        notas: 'Abono rápido desde panel de pedido'
      })) as IpcResult<unknown>
      if (result.ok) {
        showToast({
          tone: 'success',
          title: 'Abono registrado',
          message: `Se abonaron $${monto.toLocaleString('es-CO')} a la factura ${facturaActiva.numero}.`
        })
        refetchFacturas()
        refetchSaldo()
        // Sincroniza con el kanban: refresca saldosMap del parent para que
        // el badge "Debe $X" y el bloqueo de "entregar" desaparezcan sin
        // tener que esperar al polling de 10s.
        onPedidoUpdated?.()
      } else {
        showToast({
          tone: 'error',
          title: 'No se pudo registrar el pago',
          message: result.error
        })
      }
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Error inesperado',
        message: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setPagandoMonto(null)
      payingRef.current = false
    }
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 bottom-0 w-full sm:w-105 sm:max-w-[80vw] bg-surface border-l border-border shadow-4 z-40 flex flex-col',
        closing ? 'animate-slide-out-right' : 'animate-slide-in-right'
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-text">{pedido.numero}</h2>
          <p className="text-xs text-text-muted">{TIPO_TRABAJO_LABEL[pedido.tipoTrabajo]}</p>
        </div>
        <button
          ref={closeRef}
          onClick={requestClose}
          className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-surface-muted text-text-muted hover:text-text cursor-pointer transition-colors"
          aria-label="Cerrar panel"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {nextEstado && (
          <GuidanceHint
            tone="info"
            title="Siguiente paso sugerido"
            message={`Cuando termines esta revisión puedes mover el pedido a ${ESTADO_PEDIDO_LABEL[nextEstado].toLowerCase()}.`}
          />
        )}

        {pedido.estado === 'listo' && facturasDelPedido.length === 0 && (
          <GuidanceHint
            tone="accent"
            title="Pedido listo para facturar"
            message="Crea la factura para poder cobrar al cliente y coordinar la entrega."
            actionLabel="Ir a facturas"
            onAction={() => navigate('/facturas')}
          />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-soft">Estado:</span>
          <EstadoPedidoBadge estado={pedido.estado} />
          {pedido.tipoEntrega === 'urgente' && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning-strong">
              ⚡ Urgente
            </span>
          )}
          {puedeEditarComercial && (
            <button
              type="button"
              onClick={async () => {
                const nuevo = pedido.tipoEntrega === 'urgente' ? 'estandar' : 'urgente'
                const res = (await window.api.pedidos.actualizarTipoEntrega(
                  pedido.id,
                  nuevo
                )) as IpcResult<Pedido | null>
                if (res.ok) {
                  showToast({
                    tone: 'success',
                    title:
                      nuevo === 'urgente' ? 'Marcado como urgente' : 'Urgencia removida',
                    message:
                      nuevo === 'urgente'
                        ? 'Aparece destacado en el tablero.'
                        : 'Vuelve al flujo estándar.'
                  })
                  onPedidoUpdated?.()
                } else {
                  showToast({ tone: 'error', title: 'No se pudo cambiar', message: res.error })
                }
              }}
              className="text-xs text-text-muted hover:text-warning-strong cursor-pointer underline-offset-4 hover:underline"
            >
              {pedido.tipoEntrega === 'urgente' ? 'Quitar urgencia' : 'Marcar urgente'}
            </button>
          )}
        </div>

        {/* AGENT_UX: Timeline visual del ciclo de vida */}
        {pedido.estado !== 'cancelado' && pedido.estado !== 'sin_reclamar' && (
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
              Línea del pedido
            </p>
            <ol className="flex items-start">
              {TIMELINE_STAGES.map((stage, i) => {
                const current = stageIndex(pedido.estado)
                const done = i < current
                const active = i === current
                const Icon = stage.icon
                return (
                  <li
                    key={stage.estado}
                    className={cn(
                      'flex flex-1 items-start',
                      i === TIMELINE_STAGES.length - 1 && 'flex-none'
                    )}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                          done && 'border-success bg-success-bg text-success-strong',
                          active &&
                            'border-accent bg-accent text-white ring-4 ring-accent/15 scale-110',
                          !done && !active && 'border-border bg-surface text-text-soft'
                        )}
                      >
                        <Icon size={16} />
                      </div>
                      <span
                        className={cn(
                          'max-w-16 text-center text-[11px] font-medium leading-tight',
                          active ? 'text-accent-strong' : done ? 'text-text' : 'text-text-muted'
                        )}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {i < TIMELINE_STAGES.length - 1 && (
                      <div
                        className={cn(
                          'mx-1 mt-4 h-0.5 flex-1 rounded-full',
                          done ? 'bg-success' : 'bg-border'
                        )}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
        {pedido.estado === 'sin_reclamar' && (
          <div className="flex items-center gap-3 rounded-md border border-warning/30 bg-warning-bg p-3">
            <Inbox size={18} className="shrink-0 text-warning-strong" />
            <p className="text-sm text-warning-strong">
              Este pedido quedó sin reclamar. Contacta al cliente para cerrar.
            </p>
          </div>
        )}

        <Card padding="sm" className="shadow-none border border-border">
          <div className="space-y-3 text-sm">
            {pedido.descripcion && (
              <div>
                <span className="text-text-soft">Descripción</span>
                <p className="text-text truncate">{pedido.descripcion}</p>
              </div>
            )}
            {pedido.anchoCm && pedido.altoCm && (
              <div className="flex justify-between">
                <span className="text-text-soft">Medidas</span>
                <span>
                  {pedido.anchoCm} x {pedido.altoCm} cm
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-soft">Ingreso</span>
              <FechaDisplay fecha={pedido.fechaIngreso} />
            </div>
            {/* Fecha de entrega editable */}
            <div className="flex justify-between items-center">
              <span className="text-text-soft">Entrega</span>
              {editingFecha ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={fechaInput}
                    onChange={(e) => setFechaInput(e.target.value)}
                    min={pedido.fechaIngreso}
                    className="h-8 rounded-md border border-accent bg-surface px-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    type="button"
                    disabled={savingFecha}
                    onClick={async () => {
                      if (!fechaInput) return
                      setSavingFecha(true)
                      try {
                        const result = (await window.api.pedidos.actualizarFechaEntrega(
                          pedido.id,
                          fechaInput
                        )) as IpcResult<Pedido | null>
                        if (result.ok) {
                          showToast({
                            tone: 'success',
                            title: 'Fecha actualizada',
                            message: `Entrega cambiada a ${new Date(fechaInput + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.`
                          })
                          setEditingFecha(false)
                          onPedidoUpdated?.()
                        } else {
                          showToast({
                            tone: 'error',
                            title: 'Error',
                            message: result.error
                          })
                        }
                      } catch {
                        showToast({
                          tone: 'error',
                          title: 'Error',
                          message: 'No se pudo actualizar la fecha'
                        })
                      } finally {
                        setSavingFecha(false)
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover cursor-pointer"
                    aria-label="Guardar fecha"
                  >
                    {savingFecha ? <Spinner size="sm" /> : <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFecha(false)
                      setFechaInput(pedido.fechaEntrega ?? '')
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-text-soft hover:bg-surface-muted cursor-pointer"
                    aria-label="Cancelar"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFechaInput(pedido.fechaEntrega ?? '')
                    setEditingFecha(true)
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-sm text-text-muted hover:border-accent hover:text-accent-strong cursor-pointer transition-colors"
                  title="Clic para cambiar la fecha de entrega"
                >
                  {pedido.fechaEntrega ? (
                    <FechaDisplay fecha={pedido.fechaEntrega} relative />
                  ) : (
                    <span className="text-text-soft italic">Sin fecha</span>
                  )}
                  <Calendar size={14} className="text-accent-strong" />
                </button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-soft">Precio sugerido</span>
              <PrecioDisplay value={pedido.precioLista || pedido.precioTotal} />
            </div>
            {(pedido.descuentoMonto ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-text-soft">Descuento</span>
                <span className="font-semibold tabular-nums text-warning-strong">
                  − ${pedido.descuentoMonto.toLocaleString('es-CO')}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-text-soft">Precio final</span>
              <PrecioDisplay value={pedido.precioTotal} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-soft">Costo estimado</span>
              <span className="tabular-nums text-text">
                {pedido.costoEstimadoTotal != null ? formatCOP(pedido.costoEstimadoTotal) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-soft">Margen estimado</span>
              <span
                className={cn(
                  'tabular-nums font-medium',
                  pedido.margenEstimado != null && pedido.margenEstimado < 0
                    ? 'text-error-strong'
                    : 'text-success-strong'
                )}
              >
                {pedido.margenEstimado != null ? formatCOP(pedido.margenEstimado) : '—'}
              </span>
            </div>
            {puedeEditarComercial && (
              <button
                type="button"
                onClick={() => setEditingComercial(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-text-muted hover:border-accent hover:text-accent-strong cursor-pointer transition-colors"
              >
                <Pencil size={12} />
                Editar descuento o costo
              </button>
            )}
          </div>
        </Card>

        {editingComercial && (
          <EditarComercialModal
            pedido={pedido}
            onClose={() => setEditingComercial(false)}
            onSaved={() => {
              setEditingComercial(false)
              refetchFacturas()
              refetchSaldo()
              onPedidoUpdated?.()
            }}
          />
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-text">Pagos</span>
            {(facturasLoading || saldoLoading) && <Spinner size="sm" />}
          </div>
          <PagoBar total={pedido.precioTotal} pagado={pagado} showLabels />
          {/* SPEC-006: Quick-pay buttons. Cada botón llama a registrarPago
              con el monto preseleccionado (recortado al saldo pendiente) y
              refresca facturas + saldo al instante. */}
          {facturaActiva && saldoPendiente > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                Abono rápido
              </p>
              <div className="flex gap-2">
                {[50000, 100000, 200000]
                  .filter((_, i, arr) => i === 0 || arr[i - 1] < saldoPendiente)
                  .map((monto) => {
                    const efectivo = Math.min(monto, saldoPendiente)
                    const esElUltimo = efectivo < monto
                    return (
                      <Button
                        key={monto}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={pagandoMonto !== null}
                        onClick={() => handleQuickPay(monto)}
                        title={
                          esElUltimo
                            ? `Solo queda $${saldoPendiente.toLocaleString('es-CO')} de saldo`
                            : undefined
                        }
                      >
                        {pagandoMonto === monto ? (
                          <Spinner size="sm" />
                        ) : (
                          `+$${(efectivo / 1000).toFixed(0)}k`
                        )}
                      </Button>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {pedido.notas && (
          <div>
            <span className="text-sm font-medium text-text mb-1 block">Notas</span>
            <p className="text-sm text-text-muted max-h-24 overflow-y-auto">{pedido.notas}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
        <div className="flex gap-3">
          {nextEstado &&
            (() => {
              // Bloqueo visual: no permitir marcar "entregado"
              // mientras quede saldo pendiente. Misma regla que el kanban
              // via handleChangeEstado; aquí además deshabilitamos el
              // botón y lo explicamos con un title para que papá sepa por
              // qué no puede avanzar.
              const bloquearPorSaldo = nextEstado === 'entregado' && saldoPendiente > 0
              return (
                <Button
                  className="flex-1"
                  disabled={bloquearPorSaldo}
                  onClick={() => onChangeEstado(pedido.id, nextEstado)}
                  title={
                    bloquearPorSaldo
                      ? `Falta cobrar $${saldoPendiente.toLocaleString('es-CO')} antes de entregar`
                      : undefined
                  }
                >
                  {bloquearPorSaldo
                    ? `Cobra $${saldoPendiente.toLocaleString('es-CO')} para entregar`
                    : `Mover a ${ESTADO_PEDIDO_LABEL[nextEstado]}`}
                </Button>
              )
            })()}
          {facturasDelPedido.length === 0 &&
            pedido.estado !== 'cotizado' &&
            pedido.estado !== 'cancelado' && (
              <Button variant="secondary" className="flex-1" onClick={() => navigate('/facturas')}>
                <CreditCard size={16} />
                Generar Factura
              </Button>
            )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleGenerarPDF}
            disabled={generandoPdf}
          >
            {generandoPdf ? <Spinner size="sm" /> : <Download size={16} />}
            {generandoPdf
              ? 'Generando...'
              : facturaActiva
                ? `PDF factura ${facturaActiva.numero}`
                : 'PDF cotización'}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={requestClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Modal para editar descuento, motivo y costo estimado de un pedido ya
// creado (D5). El backend recalcula precio total, margen y, si hay factura
// activa, ajusta su total con devolución automática si el nuevo total es
// menor que lo cobrado.
// ----------------------------------------------------------------------
function EditarComercialModal({
  pedido,
  onClose,
  onSaved
}: {
  pedido: Pedido
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const { showToast } = useToast()
  const [conDescuento, setConDescuento] = useState((pedido.descuentoMonto ?? 0) > 0)
  const [descuentoNum, setDescuentoNum] = useState(pedido.descuentoMonto ?? 0)
  const [motivo, setMotivo] = useState(pedido.descuentoMotivo ?? '')
  const usaCostoManual =
    pedido.tipoTrabajo === 'restauracion' || pedido.tipoTrabajo === 'vidrio_espejo'
  const [costoNum, setCostoNum] = useState(pedido.costoEstimadoTotal ?? 0)
  const [saving, setSaving] = useState(false)

  const descuentoInput = useMoneyInput(descuentoNum, setDescuentoNum, {
    max: pedido.precioLista || pedido.precioTotal
  })
  const costoInput = useMoneyInput(costoNum, setCostoNum, { min: 0 })

  const precioSugerido = pedido.precioLista || pedido.precioTotal
  const descuentoEfectivo = conDescuento ? descuentoNum : 0
  const nuevoTotal = Math.max(0, precioSugerido - descuentoEfectivo)

  async function handleGuardar(): Promise<void> {
    setSaving(true)
    try {
      const result = (await window.api.pedidos.editarComercial({
        pedidoId: pedido.id,
        descuentoMonto: descuentoEfectivo,
        descuentoMotivo: motivo.trim() || null,
        costoEstimadoTotal: usaCostoManual ? (costoNum > 0 ? costoNum : null) : undefined
      })) as IpcResult<{ devolucionGenerada: { monto: number } | null }>
      if (!result.ok) {
        showToast({
          tone: 'error',
          title: 'No se pudo editar el pedido',
          message: result.error
        })
        return
      }
      const devolucion = result.data.devolucionGenerada
      showToast({
        tone: 'success',
        title: 'Pedido actualizado',
        message: devolucion
          ? `Se generó una devolución automática de ${formatCOP(devolucion.monto)} al cliente.`
          : 'Descuento, costo y margen actualizados.'
      })
      onSaved()
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al editar',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar pedido" size="md">
      <div className="space-y-4">
        <div className="rounded-md bg-surface-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Precio sugerido</span>
            <span className="tabular-nums font-medium text-text">{formatCOP(precioSugerido)}</span>
          </div>
          {descuentoEfectivo > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-text-muted">Descuento</span>
              <span className="tabular-nums text-warning-strong">
                − {formatCOP(descuentoEfectivo)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <span className="font-semibold text-text">Precio final</span>
            <span className="tabular-nums font-semibold text-text">{formatCOP(nuevoTotal)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
          <div>
            <p className="text-sm font-medium text-text">Aplicar descuento</p>
            <p className="text-xs text-text-muted">
              Se ajusta el total y se sincroniza la factura si existe.
            </p>
          </div>
          <Toggle
            checked={conDescuento}
            onChange={(next) => {
              setConDescuento(next)
              if (!next) {
                setDescuentoNum(0)
                setMotivo('')
              }
            }}
            ariaLabel={conDescuento ? 'Desactivar descuento' : 'Activar descuento'}
          />
        </div>

        {conDescuento && (
          <>
            <Input
              label="Monto del descuento"
              type="text"
              inputMode="decimal"
              min={0}
              max={precioSugerido}
              value={descuentoInput.raw}
              onChange={descuentoInput.handleChange}
              onBlur={descuentoInput.handleBlur}
              placeholder="Ej: 5.000"
            />
            <Input
              label="Motivo (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Cliente frecuente"
            />
          </>
        )}

        {usaCostoManual && (
          <Input
            label="Costo estimado interno"
            type="text"
            inputMode="decimal"
            min={0}
            value={costoInput.raw}
            onChange={costoInput.handleChange}
            onBlur={costoInput.handleBlur}
            placeholder="Ej: 80.000"
            hint="Solo se usa para calcular margen interno, no se muestra al cliente."
          />
        )}

        {nuevoTotal === 0 && precioSugerido > 0 && (
          <div className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning-strong">
            El precio final queda en $0 (regalo). La factura se marcará como pagada y, si ya
            cobraste algo, se generará una devolución automática.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving} className="flex-1">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
