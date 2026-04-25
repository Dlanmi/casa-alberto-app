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
  Check
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { EstadoPedidoBadge } from '@renderer/components/shared/estado-badge'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { cn } from '@renderer/lib/cn'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useToast } from '@renderer/contexts/toast-context'
import { useSlidePanel } from '@renderer/hooks/use-slide-panel'
import { TIPO_TRABAJO_LABEL, ESTADO_PEDIDO_LABEL } from '@renderer/lib/constants'
import type { LucideIcon } from 'lucide-react'
import type { Pedido, Factura, EstadoPedido, IpcResult } from '@shared/types'

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
  useSlidePanel({ onClose, closeRef })
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
  const nextEstado = NEXT_ESTADO[pedido.estado]

  // Fetch facturas for this pedido to find a linked factura
  const {
    data: facturas,
    loading: facturasLoading,
    refetch: refetchFacturas
  } = useIpc<Factura[]>(() => window.api.facturas.listar({ limit: 100 }), [pedido.id])

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
      className="fixed right-0 top-0 bottom-0 w-full sm:w-105 sm:max-w-[80vw] bg-surface border-l border-border shadow-4 z-40 flex flex-col animate-slide-in-right"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-text">{pedido.numero}</h2>
          <p className="text-xs text-text-muted">{TIPO_TRABAJO_LABEL[pedido.tipoTrabajo]}</p>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-soft">Estado:</span>
          <EstadoPedidoBadge estado={pedido.estado} />
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
              <span className="text-text-soft">Precio total</span>
              <PrecioDisplay value={pedido.precioTotal} />
            </div>
          </div>
        </Card>

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
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
