import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  ClipboardList,
  ShoppingCart,
  Receipt,
  UserPlus,
  Banknote,
  StickyNote,
  CreditCard,
  Wallet,
  Zap
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { useToast } from '@renderer/contexts/toast-context'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { EMOJI_TOAST } from '@renderer/lib/emojis'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { conceptoIcon, TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import { cn } from '@renderer/lib/cn'
import { sugerenciasDejarEnTotal } from '@shared/comercial'
import type { EvaluacionComercial } from '@shared/comercial'
import type { WizardData, MetodoPagoWizard } from './wizard-shell'
import type {
  TipoTrabajo,
  Cliente,
  IpcResult,
  CrearPedidoConfirmadoResult,
  ResultadoCotizacion
} from '@shared/types'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
  cotizacion: ResultadoCotizacion | null
  evaluacion: EvaluacionComercial
  tipoTrabajo: TipoTrabajo
  cliente: Cliente | null
  onClienteChange: (cliente: Cliente | null) => void
}

function calcFechaEntrega(diasHabiles = 8): string {
  const d = new Date()
  d.setDate(d.getDate() + diasHabiles)
  return d.toISOString().slice(0, 10)
}

export function StepResumen({
  data,
  onChange,
  cotizacion,
  evaluacion,
  tipoTrabajo,
  cliente,
  onClienteChange
}: Props): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { emoji } = useEmojis()
  const [creating, setCreating] = useState(false)
  const [confirmSobrescritura, setConfirmSobrescritura] = useState<number | null>(null)

  const { precioSugerido, descuentoMonto, precioFinal, descuentoSolicitado } = evaluacion

  // Inputs controlados — leen de WizardData (vive arriba) y propagan hacia
  // arriba con onChange. Antes vivían como useState locales y se perdían al
  // volver atrás en el wizard (M1).
  const descuentoInput = useMoneyInput(
    data.descuentoNum,
    (n) => onChange({ descuentoNum: n }),
    { max: precioSugerido }
  )
  const abonoInput = useMoneyInput(data.abonoNum, (n) => onChange({ abonoNum: n }), {
    max: precioFinal
  })

  // Fecha de entrega: siempre hoy + 8 días por defecto (se ajusta en Pedidos si es urgente)
  const fechaEntrega = calcFechaEntrega(8)

  function handleAplicarDejarEn(objetivo: number): void {
    const nuevoDescuento = precioSugerido - objetivo
    if (data.conDescuento && data.descuentoNum > 0 && data.descuentoNum !== nuevoDescuento) {
      // M7 — Confirmar antes de sobrescribir un descuento manual previo
      setConfirmSobrescritura(nuevoDescuento)
      return
    }
    onChange({ conDescuento: true, descuentoNum: nuevoDescuento })
  }

  function aplicarDescuentoCalculado(monto: number): void {
    onChange({ conDescuento: true, descuentoNum: monto })
    setConfirmSobrescritura(null)
  }

  async function handleCrearPedido(): Promise<void> {
    if (!cliente || !cotizacion) return
    setCreating(true)
    try {
      const abonoEfectivo = data.conAbono ? data.abonoNum : 0
      const tipoVidrioPedido =
        tipoTrabajo === 'vidrio_espejo'
          ? data.tipoVidrioEspejo
          : data.conVidrio
            ? data.tipoVidrio
            : 'ninguno'
      const descripcion =
        data.descripcionManual.trim() ||
        `${TIPO_TRABAJO_LABEL[tipoTrabajo]} ${data.anchoCm}x${data.altoCm}`

      const result = (await window.api.pedidos.crearConfirmado({
        datos: {
          clienteId: cliente.id,
          tipoTrabajo,
          descripcion,
          anchoCm: data.anchoCm,
          altoCm: data.altoCm,
          muestraMarcoId: data.muestraMarcoId,
          anchoPaspartuCm: data.conPaspartu ? data.anchoPaspartuCm : undefined,
          tipoPaspartu: data.conPaspartu ? data.tipoPaspartu : undefined,
          conSuplemento: data.conSuplemento,
          tipoVidrio: tipoVidrioPedido,
          porcentajeMateriales: data.porcentajeMateriales,
          tipoEntrega: data.tipoEntrega,
          precioManual: tipoTrabajo === 'restauracion' ? data.precioManual : undefined,
          costoManualEstimado:
            tipoTrabajo === 'restauracion' && data.costoManualEstimado > 0
              ? data.costoManualEstimado
              : undefined,
          precioInstalacion: tipoTrabajo === 'vidrio_espejo' ? data.precioInstalacion : undefined,
          costoInstalacionEstimado:
            tipoTrabajo === 'vidrio_espejo' && data.costoInstalacionEstimado > 0
              ? data.costoInstalacionEstimado
              : undefined,
          fechaIngreso: hoyISO(),
          fechaEntrega: fechaEntrega || undefined,
          notas: data.notas.trim() || undefined
        },
        cotizacion,
        descuento:
          descuentoMonto > 0
            ? {
                monto: descuentoMonto,
                motivo: data.motivoDescuento.trim() || null
              }
            : null,
        facturaFecha: hoyISO(),
        abono:
          abonoEfectivo > 0
            ? {
                monto: abonoEfectivo,
                fecha: hoyISO(),
                metodoPago: data.metodoPago
              }
            : null
      })) as IpcResult<CrearPedidoConfirmadoResult>

      if (!result.ok) {
        showToast({ tone: 'error', title: 'No se pudo crear el pedido', message: result.error })
        return
      }

      const { pedido } = result.data

      showToast({
        tone: 'success',
        title: `${emoji(EMOJI_TOAST.pedido_creado)} Pedido ${pedido.numero} creado`.trim(),
        message:
          abonoEfectivo > 0
            ? `Abono de ${formatCOP(abonoEfectivo)} registrado. Factura generada.`
            : `Factura pendiente por ${formatCOP(precioFinal)}.`
      })
      // Navegación automática al listado de pedidos con el nuevo pedido
      // destacado — evita que el usuario se quede pensando "¿qué hago ahora?".
      navigate(`/pedidos?highlight=${pedido.id}`)
    } catch (err) {
      console.error('Create order failed:', err)
      showToast({
        tone: 'error',
        title: 'No se pudo crear el pedido',
        message: 'Revisa los datos y vuelve a intentarlo.'
      })
    } finally {
      setCreating(false)
    }
  }

  if (!cotizacion) {
    return (
      <div className="py-8">
        <GuidanceHint
          tone="warning"
          title="Todavía no hay un total calculado"
          message="Completa los pasos anteriores para ver el resumen, revisar el precio final y decidir si conviertes esta cotización en pedido."
        />
      </div>
    )
  }

  const TipoIcon = TIPO_TRABAJO_ICON[tipoTrabajo] ?? FileText
  const abonoVisible = data.conAbono ? data.abonoNum : 0
  const saldo = precioFinal - abonoVisible
  const porcentajePagado =
    precioFinal > 0 ? Math.min(100, Math.round((abonoVisible / precioFinal) * 100)) : 0
  const totalesSugeridos = sugerenciasDejarEnTotal(precioSugerido, 3)
  const descuentoAjustado =
    descuentoSolicitado > 0 && descuentoMonto !== descuentoSolicitado
      ? Math.abs(descuentoMonto - descuentoSolicitado)
      : 0

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold tracking-tight text-text">Resumen de cotización</h2>
      <p className="mb-6 flex items-center gap-2 text-sm text-text-muted">
        <TipoIcon size={16} className="text-accent-strong" />
        <span>
          {TIPO_TRABAJO_LABEL[tipoTrabajo]} — {data.anchoCm} x {data.altoCm} cm
        </span>
      </p>

      {/* Desglose del precio */}
      <Card padding="md" className="mb-6">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
          Desglose del precio
        </p>
        <div className="space-y-3">
          {cotizacion.items.map((item, i) => {
            const Icon = conceptoIcon(item.tipoItem)
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border bg-surface-muted/50 px-3 py-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-strong">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{item.descripcion}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
                  {formatCOP(item.subtotal)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Subtotal</span>
            <span className="font-medium tabular-nums text-text">
              {formatCOP(cotizacion.subtotal)}
            </span>
          </div>
          {cotizacion.totalMateriales > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <ShoppingCart size={14} />
                Materiales ({data.porcentajeMateriales}%)
              </span>
              <span className="font-medium tabular-nums text-text">
                {formatCOP(cotizacion.totalMateriales)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between rounded-md bg-accent/10 px-3 py-3">
            <span className="flex items-center gap-2 text-base font-semibold text-accent-strong">
              <Receipt size={18} />
              Precio sugerido
            </span>
            <PrecioDisplay value={precioSugerido} size="lg" className="text-accent-strong" />
          </div>
        </div>
      </Card>

      <Card padding="md" className="mb-6">
        <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
          Ajuste comercial
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-semibold text-text">Descuento</p>
              <p className="text-xs text-text-muted">
                Se aplica sobre el precio sugerido. El precio final se redondea al múltiplo de
                $1.000.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !data.conDescuento
                onChange({
                  conDescuento: next,
                  descuentoNum: next ? data.descuentoNum : 0,
                  motivoDescuento: next ? data.motivoDescuento : ''
                })
              }}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer',
                data.conDescuento ? 'bg-success' : 'bg-border'
              )}
              aria-label={data.conDescuento ? 'Desactivar descuento' : 'Activar descuento'}
            >
              <span
                className={cn(
                  'absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-1 transition-all duration-200',
                  data.conDescuento ? 'left-[23px]' : 'left-[3px]'
                )}
              />
            </button>
          </div>

          {data.conDescuento && (
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
                hint={
                  descuentoAjustado > 0
                    ? `Ajustado a ${formatCOP(descuentoMonto)} para que el precio final quede cerrado en ${formatCOP(precioFinal)}.`
                    : undefined
                }
              />
              <Input
                label="Motivo (opcional)"
                value={data.motivoDescuento}
                onChange={(event) => onChange({ motivoDescuento: event.target.value })}
                placeholder="Ej: Cliente frecuente, cierre comercial"
              />
              {totalesSugeridos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Dejar total cerrado
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {totalesSugeridos.map((objetivo) => (
                      <Button
                        key={objetivo}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAplicarDejarEn(objetivo)}
                      >
                        Dejar en {formatCOP(objetivo)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="rounded-lg bg-surface-muted p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Precio sugerido</span>
              <span className="font-medium tabular-nums text-text">
                {formatCOP(precioSugerido)}
              </span>
            </div>
            {descuentoMonto > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Descuento</span>
                <span className="font-semibold tabular-nums text-warning-strong">
                  − {formatCOP(descuentoMonto)}
                </span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-text">Precio final</span>
              <span className="font-semibold tabular-nums text-text">
                {formatCOP(precioFinal)}
              </span>
            </div>
            {precioFinal === 0 && precioSugerido > 0 && (
              <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning-strong">
                Vas a regalar este trabajo. La factura quedará marcada como pagada con $0.
              </p>
            )}
          </div>

          <GuidanceHint
            tone={
              evaluacion.estadoRentabilidad === 'critica'
                ? 'warning'
                : evaluacion.estadoRentabilidad === 'baja'
                  ? 'info'
                  : evaluacion.estadoRentabilidad === 'saludable'
                    ? 'success'
                    : 'accent'
            }
            title={
              evaluacion.estadoRentabilidad === 'critica'
                ? 'Margen estimado crítico'
                : evaluacion.estadoRentabilidad === 'baja'
                  ? 'Margen estimado ajustado'
                  : evaluacion.estadoRentabilidad === 'saludable'
                    ? 'Margen estimado saludable'
                    : 'Rentabilidad incompleta'
            }
            message={
              evaluacion.estadoRentabilidad === 'incompleta'
                ? 'Faltan costos estimados en uno o más componentes. Puedes seguir, pero el margen no será confiable todavía.'
                : `Costo estimado ${formatCOP(evaluacion.costoEstimado ?? 0)} · Margen estimado ${formatCOP(evaluacion.margenEstimado ?? 0)}${evaluacion.margenEstimadoPct !== null ? ` (${Math.round(evaluacion.margenEstimadoPct)}%)` : ''}.`
            }
          />
        </div>
      </Card>

      {/* ─── Datos del pedido — flujo guiado ─── */}
      <Card padding="md" className="mb-6">
        <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
          Datos del pedido
        </p>
        <div className="space-y-6">
          {/* ── 1. Cliente ── */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                1
              </span>
              <span className="text-sm font-semibold text-text">Cliente</span>
            </div>

            {!cliente ? (
              <div className="space-y-3">
                <ClientePicker value={cliente} onChange={onClienteChange} />
                <div className="flex items-start gap-2 rounded-md border border-accent/20 bg-accent/5 px-3 py-2.5">
                  <UserPlus size={16} className="mt-0.5 shrink-0 text-accent-strong" />
                  <p className="text-xs leading-relaxed text-text-muted">
                    Escribe el nombre del cliente para buscarlo. Si no existe, podrás{' '}
                    <strong className="text-text">crearlo ahí mismo</strong> con nombre y teléfono.
                  </p>
                </div>
              </div>
            ) : (
              <ClientePicker value={cliente} onChange={onClienteChange} />
            )}
          </div>

          {/* ── 2. Abono ── */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                2
              </span>
              <span className="text-sm font-semibold text-text">Abono</span>
              <span className="text-xs text-text-muted">(opcional)</span>
            </div>

            {!data.conAbono ? (
              <button
                onClick={() => onChange({ conAbono: true })}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-surface p-4 text-left transition-colors hover:border-accent hover:bg-accent/5 cursor-pointer"
                aria-label="Registrar abono"
              >
                <span className="flex items-center gap-2">
                  <Banknote size={18} className="text-accent" />
                  <span className="text-sm font-medium text-text">
                    ¿Cobraste algo? Registrar abono
                  </span>
                </span>
                <span className="text-xs text-text-muted">Opcional</span>
              </button>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-text">
                    <Banknote size={18} className="text-success" />
                    Registrar abono
                  </span>
                  <button
                    onClick={() => onChange({ conAbono: false, abonoNum: 0 })}
                    className="text-xs text-text-muted hover:text-text cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Monto */}
                  <Input
                    label="Monto del abono"
                    type="text"
                    inputMode="decimal"
                    min={0}
                    max={precioFinal}
                    placeholder="Ej: 50.000"
                    value={abonoInput.raw}
                    onChange={abonoInput.handleChange}
                    onBlur={abonoInput.handleBlur}
                  />

                  {/* Método de pago */}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                      Método de pago
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          { key: 'efectivo', label: 'Efectivo', icon: Wallet },
                          { key: 'transferencia', label: 'Transferencia', icon: CreditCard }
                        ] as const
                      ).map((method) => (
                        <button
                          key={method.key}
                          onClick={() =>
                            onChange({ metodoPago: method.key as MetodoPagoWizard })
                          }
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all cursor-pointer',
                            data.metodoPago === method.key
                              ? 'border-accent bg-accent/10 text-accent-strong'
                              : 'border-border text-text-muted hover:border-border-strong'
                          )}
                        >
                          <method.icon size={16} />
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Desglose visual del abono */}
                  {abonoVisible > 0 && (
                    <div className="space-y-3 rounded-lg bg-surface-muted p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-muted">Total del trabajo</span>
                        <span className="font-medium tabular-nums text-text">
                          {formatCOP(precioFinal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-success-strong">
                          <Banknote size={14} />
                          Abono
                        </span>
                        <span className="font-semibold tabular-nums text-success-strong">
                          − {formatCOP(abonoVisible)}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-text">Saldo pendiente</span>
                          <span className="font-semibold tabular-nums text-text">
                            {formatCOP(saldo > 0 ? saldo : 0)}
                          </span>
                        </div>
                      </div>
                      {/* Barra de progreso */}
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-success transition-all duration-300"
                            style={{ width: `${porcentajePagado}%` }}
                          />
                        </div>
                        <p className="text-right text-xs tabular-nums text-text-muted">
                          {porcentajePagado}% pagado
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Marcar como urgente ── */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                3
              </span>
              <span className="text-sm font-semibold text-text">Tipo de entrega</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <Zap
                  size={18}
                  className={cn(
                    'mt-0.5 shrink-0',
                    data.tipoEntrega === 'urgente' ? 'text-warning-strong' : 'text-text-soft'
                  )}
                />
                <div>
                  <p className="text-sm font-semibold text-text">Marcar como urgente</p>
                  <p className="text-xs text-text-muted">
                    Aparece destacado en el tablero y entra a la matriz de urgencia.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  onChange({
                    tipoEntrega: data.tipoEntrega === 'urgente' ? 'estandar' : 'urgente'
                  })
                }
                className={cn(
                  'relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer',
                  data.tipoEntrega === 'urgente' ? 'bg-warning' : 'bg-border'
                )}
                aria-label={
                  data.tipoEntrega === 'urgente' ? 'Quitar urgencia' : 'Marcar como urgente'
                }
              >
                <span
                  className={cn(
                    'absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-1 transition-all duration-200',
                    data.tipoEntrega === 'urgente' ? 'left-[23px]' : 'left-[3px]'
                  )}
                />
              </button>
            </div>
          </div>

          {/* ── 4. Notas ── */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                4
              </span>
              <span className="text-sm font-semibold text-text">Notas</span>
              <span className="text-xs text-text-muted">(opcional)</span>
            </div>
            <div className="flex items-start gap-3">
              <StickyNote size={18} className="mt-2.5 shrink-0 text-text-soft" />
              <textarea
                id="notas"
                value={data.notas}
                onChange={(e) => onChange({ notas: e.target.value })}
                rows={2}
                placeholder="Instrucciones especiales, preferencias del cliente..."
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCrearPedido} disabled={!cliente || creating} size="lg">
          <ClipboardList size={18} />
          {creating ? 'Creando...' : 'Crear Pedido'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={!cliente}
          title={!cliente ? 'Vincula un cliente para generar la cotización en PDF' : undefined}
          onClick={async () => {
            if (!cliente) return
            try {
              const now = new Date()
              const fecha = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
              const seq = String(now.getTime()).slice(-4)
              const numero = `COT-${fecha}-${seq}`
              const result = (await window.api.pdf.generarFactura({
                numero,
                fecha: hoyISO(),
                clienteNombre: cliente.nombre,
                clienteCedula: cliente.cedula,
                clienteTelefono: cliente.telefono,
                clienteDireccion: cliente.direccion,
                items: cotizacion.items.map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: it.cantidad,
                  precioUnitario: it.precioUnitario ?? it.subtotal,
                  subtotal: it.subtotal
                })),
                subtotal: cotizacion.subtotal,
                totalMateriales: cotizacion.totalMateriales,
                precioLista: precioSugerido,
                descuentoMonto: descuentoMonto,
                descuentoMotivo: data.motivoDescuento.trim() || null,
                total: precioFinal,
                pagos: [],
                saldo: precioFinal,
                notas: `${TIPO_TRABAJO_LABEL[tipoTrabajo]} ${data.anchoCm}x${data.altoCm}cm`
              })) as IpcResult<string>
              if (result.ok) {
                showToast({
                  tone: 'success',
                  title: 'PDF generado',
                  message: 'La cotización se abrió en PDF para revisión o envío al cliente.'
                })
                await window.api.pdf.abrir(result.data)
              } else {
                showToast({
                  tone: 'error',
                  title: 'No se pudo generar el PDF',
                  message: result.error
                })
              }
            } catch (err) {
              console.error('PDF generation failed:', err)
              showToast({
                tone: 'error',
                title: 'No se pudo generar el PDF',
                message: 'Revisa los datos de la cotización y vuelve a intentarlo.'
              })
            }
          }}
        >
          <FileText size={18} />
          Generar PDF
        </Button>
        {!cliente && (
          <p className="w-full text-xs text-text-muted">
            Vincula un cliente en el paso 1 para habilitar la creación del pedido.
          </p>
        )}
      </div>

      {/* M7 — Confirmar antes de sobrescribir un descuento manual con el preset "Dejar en X" */}
      <ConfirmDialog
        open={confirmSobrescritura !== null}
        title="¿Reemplazar el descuento actual?"
        message={`Tienes un descuento manual de ${formatCOP(data.descuentoNum)}. ¿Lo reemplazamos por uno calculado para que el total quede en ${formatCOP(precioSugerido - (confirmSobrescritura ?? 0))}?`}
        confirmLabel="Sí, reemplazar"
        onClose={() => setConfirmSobrescritura(null)}
        onConfirm={() => {
          if (confirmSobrescritura !== null) aplicarDescuentoCalculado(confirmSobrescritura)
        }}
      />
    </div>
  )
}
