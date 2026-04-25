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
  Wallet
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { useToast } from '@renderer/contexts/toast-context'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { EMOJI_TOAST } from '@renderer/lib/emojis'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { conceptoIcon, TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import { cn } from '@renderer/lib/cn'
import type { WizardData } from './wizard-shell'
import type {
  TipoTrabajo,
  Cliente,
  Pedido,
  Factura,
  IpcResult,
  ResultadoCotizacion
} from '@shared/types'

type Props = {
  data: WizardData
  cotizacion: ResultadoCotizacion | null
  tipoTrabajo: TipoTrabajo
  cliente: Cliente | null
  onClienteChange: (cliente: Cliente | null) => void
}

type MetodoPago = 'efectivo' | 'transferencia'

function calcFechaEntrega(diasHabiles = 8): string {
  const d = new Date()
  d.setDate(d.getDate() + diasHabiles)
  return d.toISOString().slice(0, 10)
}

export function StepResumen({
  data,
  cotizacion,
  tipoTrabajo,
  cliente,
  onClienteChange
}: Props): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { emoji } = useEmojis()
  const [creating, setCreating] = useState(false)

  // Campos adicionales para el pedido
  const [conAbono, setConAbono] = useState(true)
  const [abonoNum, setAbonoNum] = useState<number>(0)
  const abonoInput = useMoneyInput(abonoNum, setAbonoNum, {
    max: cotizacion?.precioTotal
  })
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [notas, setNotas] = useState('')
  // Fecha de entrega: siempre hoy + 8 días por defecto (se ajusta en Pedidos si es urgente)
  const fechaEntrega = calcFechaEntrega(8)

  async function handleCrearPedido(): Promise<void> {
    if (!cliente || !cotizacion) return
    setCreating(true)
    try {
      // 1. Crear el pedido con fecha de entrega y notas
      const result = (await window.api.pedidos.crear(
        {
          clienteId: cliente.id,
          tipoTrabajo,
          descripcion: `${TIPO_TRABAJO_LABEL[tipoTrabajo]} ${data.anchoCm}x${data.altoCm}`,
          anchoCm: data.anchoCm,
          altoCm: data.altoCm,
          anchoPaspartuCm: data.conPaspartu ? data.anchoPaspartuCm : undefined,
          tipoPaspartu: data.conPaspartu ? data.tipoPaspartu : undefined,
          tipoVidrio: data.conVidrio ? data.tipoVidrio : 'ninguno',
          porcentajeMateriales: data.porcentajeMateriales,
          fechaIngreso: hoyISO(),
          fechaEntrega: fechaEntrega || undefined,
          notas: notas.trim() || undefined
        },
        cotizacion
      )) as IpcResult<Pedido>

      if (!result.ok) {
        showToast({ tone: 'error', title: 'No se pudo crear el pedido', message: result.error })
        return
      }

      const pedido = result.data
      const abonoEfectivo = conAbono ? abonoNum : 0

      // 2. Confirmar pedido + crear factura SIEMPRE que el dueño finalice el
      //    wizard — el cliente ya comprometió el trabajo aunque aún no pague.
      //    La factura queda en "pendiente" hasta que registre el primer pago.
      //    Antes: sólo se creaba factura si había abono, por lo que los
      //    trabajos "fiados" no aparecían en la sección Facturas.
      await window.api.pedidos.cambiarEstado(pedido.id, 'confirmado')

      const factRes = (await window.api.facturas.crear({
        pedidoId: pedido.id,
        clienteId: cliente.id,
        fecha: hoyISO(),
        total: cotizacion.precioTotal
      })) as IpcResult<Factura>

      if (factRes.ok && abonoEfectivo > 0) {
        // Registrar el abono como primer pago si lo hay
        await window.api.facturas.registrarPago({
          facturaId: factRes.data.id,
          monto: abonoEfectivo,
          fecha: hoyISO(),
          metodoPago
        })
      }

      showToast({
        tone: 'success',
        title: `${emoji(EMOJI_TOAST.pedido_creado)} Pedido ${pedido.numero} creado`.trim(),
        message:
          abonoEfectivo > 0
            ? `Abono de ${formatCOP(abonoEfectivo)} registrado. Factura generada.`
            : `Factura pendiente por ${formatCOP(cotizacion.precioTotal)}.`
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
  const abonoVisible = conAbono ? abonoNum : 0
  const saldo = cotizacion.precioTotal - abonoVisible
  const porcentajePagado =
    cotizacion.precioTotal > 0
      ? Math.min(100, Math.round((abonoVisible / cotizacion.precioTotal) * 100))
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
              Total
            </span>
            <PrecioDisplay
              value={cotizacion.precioTotal}
              size="lg"
              className="text-accent-strong"
            />
          </div>
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

            {!conAbono ? (
              <button
                onClick={() => setConAbono(true)}
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
                    onClick={() => {
                      setConAbono(false)
                      setAbonoNum(0)
                    }}
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
                    max={cotizacion.precioTotal}
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
                          onClick={() => setMetodoPago(method.key)}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all cursor-pointer',
                            metodoPago === method.key
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
                          {formatCOP(cotizacion.precioTotal)}
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

          {/* ── 3. Notas ── */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                3
              </span>
              <span className="text-sm font-semibold text-text">Notas</span>
              <span className="text-xs text-text-muted">(opcional)</span>
            </div>
            <div className="flex items-start gap-3">
              <StickyNote size={18} className="mt-2.5 shrink-0 text-text-soft" />
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
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
          onClick={async () => {
            try {
              const now = new Date()
              const fecha = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
              const seq = String(now.getTime()).slice(-4)
              const numero = `COT-${fecha}-${seq}`
              const result = (await window.api.pdf.generarFactura({
                numero,
                fecha: hoyISO(),
                clienteNombre: cliente?.nombre ?? 'Sin cliente',
                items: cotizacion.items.map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: 1,
                  precioUnitario: it.subtotal,
                  subtotal: it.subtotal
                })),
                subtotal: cotizacion.subtotal,
                totalMateriales: cotizacion.totalMateriales,
                total: cotizacion.precioTotal,
                pagos: [],
                saldo: cotizacion.precioTotal,
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
    </div>
  )
}
