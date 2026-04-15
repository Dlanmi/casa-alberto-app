import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, CreditCard, FileText, Plus, Ban } from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Button } from '@renderer/components/ui/button'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Tabs } from '@renderer/components/ui/tabs'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PageLoader } from '@renderer/components/ui/spinner'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { EstadoFacturaBadge } from '@renderer/components/shared/estado-badge'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { METODO_PAGO_LABEL } from '@renderer/lib/constants'
import type { Factura, Pago, Cliente, Pedido, MetodoPago, IpcResult } from '@shared/types'
import { METODOS_PAGO } from '@shared/types'

type FacturaConCliente = Factura & { clienteNombre?: string }

type TabKey = 'todas' | 'pendiente' | 'pagada' | 'anulada'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'pagada', label: 'Pagadas' },
  { key: 'anulada', label: 'Anuladas' }
]

export default function FacturasPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>(() => parseTab(searchParams.get('focus')))
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [showNuevaFactura, setShowNuevaFactura] = useState(false)
  const { showToast } = useToast()

  const {
    data: facturas,
    loading,
    refetch
  } = useIpc<Factura[]>(() => window.api.facturas.listar({}), [])

  const { data: clientes } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  const clienteMap = useMemo(() => {
    const map = new Map<number, string>()
    clientes?.forEach((c) => map.set(c.id, c.nombre))
    return map
  }, [clientes])

  const enriched = useMemo<FacturaConCliente[]>(() => {
    if (!facturas) return []
    return facturas.map((f) => ({
      ...f,
      clienteNombre: clienteMap.get(f.clienteId) ?? 'Cliente desconocido'
    }))
  }, [facturas, clienteMap])

  const filtered = useMemo(() => {
    let list = enriched
    if (tab !== 'todas') {
      list = list.filter((f) => f.estado === tab)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) => f.numero.toLowerCase().includes(q) || f.clienteNombre?.toLowerCase().includes(q)
      )
    }
    return list
  }, [enriched, tab, search])

  const tabCounts = useMemo(() => {
    if (!enriched) return {}
    return {
      todas: enriched.length,
      pendiente: enriched.filter((f) => f.estado === 'pendiente').length,
      pagada: enriched.filter((f) => f.estado === 'pagada').length,
      anulada: enriched.filter((f) => f.estado === 'anulada').length
    }
  }, [enriched])

  if (loading) return <PageLoader />

  return (
    <OperationalBoard
      title="Cobros y facturación"
      subtitle="Convierte pedidos listos en facturas, registra abonos y mantén visible el saldo real de cada cliente."
      guidance={{
        tone: tab === 'pendiente' ? 'warning' : 'info',
        title:
          tab === 'pendiente'
            ? 'Vista orientada a cobro'
            : 'Sigue el puente pedido → factura → pago',
        message:
          tab === 'pendiente'
            ? 'Estás viendo las facturas que todavía requieren abonos. Desde aquí el siguiente paso útil es registrar pago o enviar PDF.'
            : 'Una factura útil siempre te deja claro cuánto falta por cobrar y qué pedido originó el documento.'
      }}
      primaryAction={{
        label: 'Nueva factura',
        onClick: () => setShowNuevaFactura(true),
        icon: Plus
      }}
      filters={
        <div className="space-y-4">
          <Tabs
            tabs={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              count: tabCounts[t.key]
            }))}
            active={tab}
            onChange={(k) => {
              setTab(k as TabKey)
              setSearchParams(k === 'todas' ? {} : { focus: String(k) })
            }}
            ariaLabel="Filtros de facturas"
            idBase="facturas-tabs"
          />

          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar por número o cliente..."
          />
        </div>
      }
    >
      <div
        role="tabpanel"
        id={`facturas-tabs-panel-${tab}`}
        aria-labelledby={`facturas-tabs-tab-${tab}`}
        className="space-y-4"
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={search || tab !== 'todas' ? 'Sin resultados' : 'No hay facturas'}
            description="Cuando tengas un pedido confirmado, en proceso o listo, podrás crear la factura desde aquí."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Número</Th>
                <Th>Cliente</Th>
                <Th>Fecha</Th>
                <Th className="text-right">Total</Th>
                <Th>Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((f) => (
                <Tr key={f.id} className="cursor-pointer" onClick={() => setSelectedFactura(f)}>
                  <Td className="font-medium">{f.numero}</Td>
                  <Td>{f.clienteNombre}</Td>
                  <Td>
                    <FechaDisplay fecha={f.fecha} relative />
                  </Td>
                  <Td className="text-right">
                    <PrecioDisplay value={f.total} size="sm" />
                  </Td>
                  <Td>
                    <EstadoFacturaBadge estado={f.estado} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Detail modal */}
      {selectedFactura && (
        <FacturaDetailModal
          factura={selectedFactura}
          clienteNombre={clienteMap.get(selectedFactura.clienteId) ?? ''}
          onClose={() => setSelectedFactura(null)}
          onPagoRegistrado={() => {
            refetch()
            showToast('success', 'Pago registrado correctamente')
          }}
        />
      )}

      {/* Nueva factura modal */}
      {showNuevaFactura && (
        <NuevaFacturaModal
          clienteMap={clienteMap}
          facturasExistentes={facturas ?? []}
          onClose={() => setShowNuevaFactura(false)}
          onCreated={() => {
            setShowNuevaFactura(false)
            refetch()
            showToast('success', 'Factura creada correctamente')
          }}
        />
      )}
    </OperationalBoard>
  )
}

function parseTab(value: string | null): TabKey {
  if (value === 'pendiente' || value === 'pagada' || value === 'anulada') {
    return value
  }
  return 'todas'
}

/* ------------------------------------------------------------------ */
/* Detail Modal                                                       */
/* ------------------------------------------------------------------ */

function FacturaDetailModal({
  factura,
  clienteNombre,
  onClose,
  onPagoRegistrado
}: {
  factura: Factura
  clienteNombre: string
  onClose: () => void
  onPagoRegistrado: () => void
}): React.JSX.Element {
  const [showPayment, setShowPayment] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showAnular, setShowAnular] = useState(false)
  const [anulando, setAnulando] = useState(false)
  // SPEC-008 — Fase 3 v2 §5.4.3: formato del PDF (carta, A4 o tirilla térmica).
  const [formatoPDF, setFormatoPDF] = useState<'carta' | 'a4' | 'termico80'>('carta')
  const { showToast } = useToast()

  const { data: saldo, refetch: refetchSaldo } = useIpc<number>(
    () => window.api.facturas.saldo(factura.id),
    [factura.id]
  )

  const { data: facturaDetalle, refetch: refetchDetalle } = useIpc<Factura & { pagos?: Pago[] }>(
    () => window.api.facturas.obtener(factura.id),
    [factura.id]
  )

  const totalPagado = saldo != null && facturaDetalle ? facturaDetalle.total - saldo : 0

  async function handlePDF(): Promise<void> {
    setGeneratingPDF(true)
    try {
      const clienteRes = (await window.api.clientes.obtener(
        factura.clienteId
      )) as IpcResult<Cliente>
      const c = clienteRes.ok ? clienteRes.data : null

      // Fetch pedido items for the PDF line items
      const pedidoRes = (await window.api.pedidos.obtener(factura.pedidoId)) as IpcResult<
        Pedido & {
          items?: {
            descripcion: string | null
            cantidad: number
            precioUnitario: number | null
            subtotal: number
          }[]
        }
      >
      const pedidoData = pedidoRes.ok ? pedidoRes.data : null
      const pdfItems =
        pedidoData?.items?.map((it) => ({
          descripcion: it.descripcion ?? 'Item',
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario ?? it.subtotal,
          subtotal: it.subtotal
        })) ?? []

      // Use real payment history from facturaDetalle
      const pdfPagos =
        facturaDetalle?.pagos?.map((p) => ({
          fecha: p.fecha,
          monto: p.monto,
          metodo: p.metodoPago
        })) ?? []

      const result = (await window.api.pdf.generarFactura({
        numero: factura.numero,
        fecha: factura.fecha,
        clienteNombre: clienteNombre,
        clienteCedula: c?.cedula,
        clienteTelefono: c?.telefono,
        clienteDireccion: c?.direccion,
        items: pdfItems,
        subtotal: factura.total,
        totalMateriales: 0,
        total: factura.total,
        pagos: pdfPagos,
        saldo: saldo ?? factura.total,
        notas: factura.notas,
        formato: formatoPDF
      })) as IpcResult<string>
      if (result.ok) {
        showToast('success', 'PDF generado')
        await window.api.pdf.abrir(result.data)
      } else {
        showToast('error', result.error)
      }
    } catch (err) {
      console.error('PDF generation failed:', err)
      showToast('error', 'Error al generar el PDF')
    } finally {
      setGeneratingPDF(false)
    }
  }

  async function handleAnular(): Promise<void> {
    setAnulando(true)
    try {
      const result = (await window.api.facturas.anular(factura.id)) as IpcResult<Factura | null>
      if (result.ok) {
        showToast('success', 'Factura anulada correctamente')
        setShowAnular(false)
        onPagoRegistrado() // refetch parent list
        onClose()
      } else {
        showToast('error', result.error)
      }
    } catch {
      showToast('error', 'Error al anular la factura')
    } finally {
      setAnulando(false)
    }
  }

  const estadoActual = facturaDetalle?.estado ?? factura.estado

  return (
    <Modal open onClose={onClose} title={`Factura ${factura.numero}`} size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted">Cliente</p>
            <p className="text-sm font-medium text-text">{clienteNombre}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">Fecha</p>
            <FechaDisplay fecha={factura.fecha} />
          </div>
        </div>

        <GuidanceHint
          tone={(saldo ?? 0) > 0 ? 'warning' : 'success'}
          title={(saldo ?? 0) > 0 ? 'Aún hay saldo pendiente' : 'Factura al día'}
          message={
            (saldo ?? 0) > 0
              ? 'Registra aquí el próximo abono para que el saldo y el estado se actualicen automáticamente.'
              : 'Esta factura ya no requiere más pagos. Puedes generar el PDF o revisar su historial.'
          }
        />

        <div className="bg-surface-muted rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Total</span>
            <PrecioDisplay value={factura.total} size="md" />
          </div>
          <PagoBar total={factura.total} pagado={totalPagado} showLabels />
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Saldo pendiente</span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                (saldo ?? 0) > 0 ? 'text-warning-strong' : 'text-success-strong'
              )}
            >
              {formatCOP(saldo ?? 0)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Estado</span>
            <EstadoFacturaBadge estado={estadoActual} />
          </div>
        </div>

        <div className="flex gap-3">
          {estadoActual === 'pendiente' && (saldo ?? 0) > 0 && (
            <Button onClick={() => setShowPayment(true)} className="flex-1">
              <CreditCard size={18} />
              Registrar pago
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handlePDF}
            className="flex-1"
            disabled={generatingPDF}
          >
            <FileText size={18} />
            {generatingPDF ? 'Generando...' : 'Generar PDF'}
          </Button>
        </div>

        {/* SPEC-008 — selector de formato de impresión */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-soft">Formato:</span>
          {[
            { key: 'carta' as const, label: 'Carta' },
            { key: 'a4' as const, label: 'A4' },
            { key: 'termico80' as const, label: 'Térmico 80mm' }
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFormatoPDF(opt.key)}
              className={cn(
                'min-h-9 rounded-sm border px-3 py-1 cursor-pointer transition-colors',
                formatoPDF === opt.key
                  ? 'border-accent bg-accent/10 text-accent-strong font-medium'
                  : 'border-border text-text-soft hover:border-border-strong'
              )}
              aria-pressed={formatoPDF === opt.key}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {estadoActual !== 'anulada' && (
          <Button variant="danger" size="sm" className="w-full" onClick={() => setShowAnular(true)}>
            <Ban size={16} />
            Anular factura
          </Button>
        )}

        {showPayment && (
          <PaymentForm
            facturaId={factura.id}
            saldo={saldo ?? 0}
            onCancel={() => setShowPayment(false)}
            onSuccess={() => {
              setShowPayment(false)
              refetchSaldo()
              refetchDetalle()
              onPagoRegistrado()
            }}
          />
        )}

        <ConfirmDialog
          open={showAnular}
          onClose={() => setShowAnular(false)}
          onConfirm={handleAnular}
          title="Anular factura"
          message={`La factura ${factura.numero} quedará marcada como anulada. El pedido asociado podrá facturarse nuevamente si es necesario.`}
          confirmLabel="Anular factura"
          danger
          loading={anulando}
        />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Nueva Factura Modal                                                */
/* ------------------------------------------------------------------ */

function NuevaFacturaModal({
  clienteMap,
  facturasExistentes,
  onClose,
  onCreated
}: {
  clienteMap: Map<number, string>
  facturasExistentes: { pedidoId: number; estado: string }[]
  onClose: () => void
  onCreated: () => void
}): React.JSX.Element {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [abono, setAbono] = useState('')
  const [creating, setCreating] = useState(false)
  const { showToast } = useToast()

  const { data: pedidos, loading: pedidosLoading } = useIpc<Pedido[]>(
    () => window.api.pedidos.listar({}),
    []
  )

  const pedidosElegibles = useMemo(() => {
    if (!pedidos) return []
    const pedidosConFactura = new Set(
      facturasExistentes.filter((f) => f.estado !== 'anulada').map((f) => f.pedidoId)
    )
    return pedidos.filter(
      (p) =>
        (p.estado === 'confirmado' || p.estado === 'en_proceso' || p.estado === 'listo') &&
        !pedidosConFactura.has(p.id)
    )
  }, [pedidos, facturasExistentes])

  async function handleCrear(): Promise<void> {
    if (!selectedPedido) return
    setCreating(true)
    try {
      const result = (await window.api.facturas.crear({
        pedidoId: selectedPedido.id,
        clienteId: selectedPedido.clienteId,
        fecha: hoyISO(),
        total: selectedPedido.precioTotal
      })) as IpcResult<Factura>
      if (result.ok) {
        const montoAbono = Number(abono)
        if (montoAbono > 0) {
          await window.api.facturas.registrarPago({
            facturaId: result.data.id,
            monto: montoAbono,
            metodoPago: 'efectivo',
            fecha: hoyISO(),
            notas: 'Abono inicial'
          })
        }
        onCreated()
      } else {
        showToast('error', result.error)
      }
    } catch {
      showToast('error', 'Error al crear la factura')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nueva factura" size="md">
      {step === 1 && (
        <div className="space-y-4">
          <GuidanceHint
            tone="accent"
            title="Primero elige el pedido"
            message="Solo aparecen pedidos listos para seguir el flujo de cobro. Si no ves uno aquí, revísalo en el tablero de pedidos."
          />
          {pedidosLoading ? (
            <PageLoader />
          ) : pedidosElegibles.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin pedidos elegibles"
              description="No hay pedidos confirmados, en proceso o listos para facturar."
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pedidosElegibles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPedido(p)}
                  className={cn(
                    'w-full text-left p-3 rounded-md border transition-colors cursor-pointer',
                    selectedPedido?.id === p.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:bg-surface-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {p.numero} · {clienteMap.get(p.clienteId) ?? 'Cliente sin nombre'}
                      </p>
                      <p className="truncate text-sm text-text-muted">
                        {p.descripcion || 'Sin descripción'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-text">
                      {formatCOP(p.precioTotal)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!selectedPedido} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && selectedPedido && (
        <div className="space-y-4">
          <GuidanceHint
            tone="info"
            title="Confirma y decide si habrá abono"
            message="Puedes emitir la factura sin pago inicial o registrar de una vez el primer adelanto del cliente."
          />
          <div className="bg-surface-muted rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Pedido</span>
              <span className="text-sm font-medium text-text">{selectedPedido.numero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Cliente</span>
              <span className="text-sm font-medium text-text">
                {clienteMap.get(selectedPedido.clienteId) ?? `Cliente #${selectedPedido.clienteId}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Fecha</span>
              <span className="text-sm font-medium text-text">{hoyISO()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Total</span>
              <PrecioDisplay value={selectedPedido.precioTotal} size="md" />
            </div>
          </div>
          <Input
            label="Abono inicial (opcional)"
            type="number"
            min={0}
            max={selectedPedido.precioTotal}
            value={abono}
            onChange={(e) => setAbono(e.target.value)}
            placeholder="Ej: 50000"
            hint={
              Number(abono) > 0
                ? `Saldo pendiente: ${formatCOP(selectedPedido.precioTotal - Number(abono))}`
                : 'Si el cliente paga un adelanto, ingrésalo aquí.'
            }
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button className="flex-1" onClick={handleCrear} disabled={creating}>
              {creating ? 'Creando...' : 'Crear factura'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Payment Form                                                       */
/* ------------------------------------------------------------------ */

function PaymentForm({
  facturaId,
  saldo,
  onCancel,
  onSuccess
}: {
  facturaId: number
  saldo: number
  onCancel: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    monto: String(saldo),
    metodoPago: 'efectivo' as MetodoPago,
    fecha: hoyISO(),
    notas: ''
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        facturaId: number
        monto: number
        metodoPago: MetodoPago
        fecha: string
        notas: string | null
      }) => window.api.facturas.registrarPago(data),
      []
    )
  )

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (isNaN(monto) || monto <= 0) return
    try {
      await execute({
        facturaId,
        monto,
        metodoPago: form.metodoPago,
        fecha: form.fecha,
        notas: form.notas || null
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  const metodoPagoOptions = METODOS_PAGO.map((m) => ({
    value: m,
    label: METODO_PAGO_LABEL[m]
  }))

  // SPEC-006 — Fase 3 v2 §5.3.2: botones rápidos para montos frecuentes.
  // Se muestran sólo si el saldo pendiente los cubre, para no confundir al
  // usuario con opciones que excederían el total.
  const quickAmounts = [50000, 100000, 200000].filter((amount) => amount <= saldo)
  const handleQuickAmount = (amount: number): void => {
    setForm((p) => ({ ...p, monto: String(amount) }))
  }
  const setFullSaldo = (): void => {
    setForm((p) => ({ ...p, monto: String(saldo) }))
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border pt-4 space-y-4">
      <h3 className="text-sm font-semibold text-text">Registrar pago</h3>
      {(quickAmounts.length > 0 || saldo > 0) && (
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handleQuickAmount(amount)}
              className="min-h-10 rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm font-medium text-text hover:border-accent hover:text-accent cursor-pointer transition-colors"
            >
              {formatCOP(amount)}
            </button>
          ))}
          <button
            type="button"
            onClick={setFullSaldo}
            className="min-h-10 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent-strong hover:bg-accent/20 cursor-pointer transition-colors"
          >
            Saldo total ({formatCOP(saldo)})
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Monto"
          type="number"
          min="1"
          max={saldo}
          value={form.monto}
          onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
          hint={`Saldo: ${formatCOP(saldo)}`}
        />
        <Select
          label="Método de pago"
          options={metodoPagoOptions}
          value={form.metodoPago}
          onChange={(e) => setForm((p) => ({ ...p, metodoPago: e.target.value as MetodoPago }))}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Fecha"
          type="date"
          value={form.fecha}
          onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
        />
        <Input
          label="Notas"
          value={form.notas}
          onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
          placeholder="Opcional"
        />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar pago'}
        </Button>
      </div>
    </form>
  )
}
