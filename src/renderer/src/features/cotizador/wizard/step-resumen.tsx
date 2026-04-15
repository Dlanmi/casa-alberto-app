import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ClipboardList, CheckCircle, ShoppingCart, Receipt } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { useToast } from '@renderer/contexts/toast-context'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { conceptoIcon, TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import type { WizardData } from './wizard-shell'
import type { TipoTrabajo, Cliente, Pedido, IpcResult, ResultadoCotizacion } from '@shared/types'

type Props = {
  data: WizardData
  cotizacion: ResultadoCotizacion | null
  tipoTrabajo: TipoTrabajo
  cliente: Cliente | null
  onClienteChange: (cliente: Cliente | null) => void
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
  const [creating, setCreating] = useState(false)
  const [createdPedido, setCreatedPedido] = useState<{ id: number; numero: string } | null>(null)

  async function handleCrearPedido(): Promise<void> {
    if (!cliente || !cotizacion) return
    setCreating(true)
    try {
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
          fechaIngreso: hoyISO()
        },
        cotizacion
      )) as IpcResult<Pedido>

      if (result.ok) {
        setCreatedPedido({ id: result.data.id, numero: result.data.numero })
        showToast({
          tone: 'success',
          title: 'Pedido creado',
          message: `El pedido ${result.data.numero} ya quedó listo para continuar con facturación o seguimiento.`,
          actionLabel: 'Ir a pedidos',
          onAction: () => navigate('/pedidos')
        })
      } else {
        showToast({ tone: 'error', title: 'No se pudo crear el pedido', message: result.error })
      }
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

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Resumen de cotización</h2>
      <p className="text-sm text-text-muted mb-6 flex items-center gap-2">
        <TipoIcon size={16} className="text-accent-strong" />
        <span>
          {TIPO_TRABAJO_LABEL[tipoTrabajo]} — {data.anchoCm} x {data.altoCm} cm
        </span>
      </p>

      <GuidanceHint
        tone={cliente ? 'success' : 'accent'}
        title={cliente ? 'Listo para cerrar' : 'Falta vincular el cliente'}
        message={
          cliente
            ? 'Con el cliente seleccionado ya puedes crear el pedido o generar un PDF para compartir la cotización.'
            : 'Selecciona el cliente antes de crear el pedido. Si solo vas a compartir la cotización, también puedes generar el PDF desde aquí.'
        }
        className="mb-6"
      />

      {/* AGENT_UX: Breakdown visual — cada concepto con icono, descripción y
          subtotal alineado. El total final es visualmente dominante. */}
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
            <span className="tabular-nums font-medium text-text">
              {formatCOP(cotizacion.subtotal)}
            </span>
          </div>
          {cotizacion.totalMateriales > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <ShoppingCart size={14} />
                Materiales ({data.porcentajeMateriales}%)
              </span>
              <span className="tabular-nums font-medium text-text">
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

      <div className="space-y-4">
        <ClientePicker value={cliente} onChange={onClienteChange} label="Cliente" />
        {!cliente && (
          <p className="text-xs text-error-strong -mt-2">
            Selecciona un cliente para crear el pedido.
          </p>
        )}

        {!createdPedido && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCrearPedido} disabled={!cliente || creating}>
              <ClipboardList size={18} />
              {creating ? 'Creando pedido...' : 'Crear Pedido'}
            </Button>
            <Button
              variant="secondary"
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
          </div>
        )}

        {createdPedido && (
          <Card padding="md" className="mt-6 text-center">
            <CheckCircle size={32} className="text-success-strong mx-auto mb-3" />
            <p className="text-base font-semibold text-text mb-1">
              Pedido {createdPedido.numero} creado
            </p>
            <p className="text-sm text-text-muted mb-4">
              El siguiente paso natural es facturar o revisar el pedido en el tablero.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/facturas')}>Generar factura</Button>
              <Button variant="secondary" onClick={() => navigate('/pedidos')}>
                Ir a pedidos
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
