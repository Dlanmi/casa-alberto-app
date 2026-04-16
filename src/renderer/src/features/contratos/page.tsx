import { useState, useMemo, useCallback } from 'react'
import {
  FileSignature,
  AlertCircle,
  Check,
  Plus,
  X,
  Trash2,
  ArrowRight,
  Receipt
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { FrameIllustration } from '@renderer/components/illustrations'
import { PageLoader } from '@renderer/components/ui/spinner'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { DirectoryScreen, MetricCard, PageSection } from '@renderer/components/layout/page-frame'
import { cn } from '@renderer/lib/cn'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import type {
  Contrato,
  ContratoItem,
  CuentaCobro,
  Cliente,
  EstadoContrato,
  IpcResult
} from '@shared/types'
import type { StatusColor } from '@renderer/lib/constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESTADO_CONTRATO_LABEL: Record<EstadoContrato, string> = {
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  cobrada: 'Cobrada',
  rechazada: 'Rechazada'
}

const ESTADO_CONTRATO_COLOR: Record<EstadoContrato, StatusColor> = {
  enviada: 'info',
  aprobada: 'success',
  cobrada: 'success',
  rechazada: 'error'
}

const NEXT_ESTADO: Partial<Record<EstadoContrato, EstadoContrato>> = {
  enviada: 'aprobada',
  aprobada: 'cobrada'
}

const NEXT_ESTADO_LABEL: Partial<Record<EstadoContrato, string>> = {
  enviada: 'Marcar aprobada',
  aprobada: 'Marcar cobrada'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContratoConItems = Contrato & { items: ContratoItem[] }

type ItemRow = {
  key: number
  descripcion: string
  cantidad: string
  valorUnitario: string
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContratosPage(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { showToast } = useToast()

  const {
    data: contratos,
    loading,
    error,
    refetch
  } = useIpc<Contrato[]>(() => window.api.contratos.listar({}), [])

  const { data: clientes } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  const clienteMap = useMemo(() => {
    const map = new Map<number, string>()
    clientes?.forEach((c) => map.set(c.id, c.nombre))
    return map
  }, [clientes])

  const filtered = useMemo(() => {
    if (!contratos) return []
    if (!search.trim()) return contratos
    const q = search.toLowerCase()
    return contratos.filter(
      (c) =>
        c.numero.toLowerCase().includes(q) || clienteMap.get(c.clienteId)?.toLowerCase().includes(q)
    )
  }, [contratos, search, clienteMap])

  const selectedContrato = useMemo(
    () => contratos?.find((c) => c.id === selectedId) ?? null,
    [contratos, selectedId]
  )

  const stats = useMemo(() => {
    const total = contratos?.length ?? 0
    const enviadas = contratos?.filter((c) => c.estado === 'enviada').length ?? 0
    const aprobadas = contratos?.filter((c) => c.estado === 'aprobada').length ?? 0
    const cobradas = contratos?.filter((c) => c.estado === 'cobrada').length ?? 0
    return { total, enviadas, aprobadas, cobradas }
  }, [contratos])

  if (loading) return <PageLoader />

  return (
    <DirectoryScreen
      title="Contratos"
      subtitle="Seguimiento de acuerdos formales, cuentas de cobro y estados de aprobación."
      guidance={{
        title: 'Flujo recomendado',
        message:
          'Revisa primero las cotizaciones enviadas, luego apruébalas y finalmente crea la cuenta de cobro cuando ya haya confirmación.',
        actionLabel: 'Nuevo contrato',
        onAction: () => setShowCreate(true),
        tone: 'info'
      }}
      primaryAction={{
        label: 'Nuevo contrato',
        onClick: () => setShowCreate(true),
        icon: Plus
      }}
      filters={
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Buscar por número o cliente..."
        />
      }
    >
      {error && !contratos && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/20 bg-warning-bg p-4 text-text">
          <AlertCircle size={20} className="text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium">Algo salió mal al cargar los datos</p>
            <p className="text-xs text-text-muted">
              Intenta cerrar y abrir la app. Si el problema sigue, revisa la configuración.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total"
          value={stats.total}
          detail="Contratos activos en el sistema"
          icon={FileSignature}
        />
        <MetricCard
          label="Enviados"
          value={stats.enviadas}
          detail="Pendientes de respuesta o aprobación"
          icon={ArrowRight}
          tone="info"
        />
        <MetricCard
          label="Aprobados"
          value={stats.aprobadas}
          detail="Listos para facturar o cobrar"
          icon={Check}
          tone="success"
        />
        <MetricCard
          label="Cobrados"
          value={stats.cobradas}
          detail="Ya cerrados en cuenta de cobro"
          icon={Receipt}
          tone="neutral"
        />
      </div>

      <PageSection
        title="Listado de contratos"
        description={
          filtered.length === 0
            ? 'No hay coincidencias para el filtro actual.'
            : `${filtered.length} contratos visibles`
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            illustration={!search ? <FrameIllustration size={140} /> : undefined}
            title={search ? 'Sin resultados' : 'Sin contratos'}
            description={
              search
                ? 'Intenta con otro término de búsqueda.'
                : 'Aquí aparecerán las cotizaciones formales para conjuntos y empresas.'
            }
            actionLabel={!search ? 'Nuevo contrato' : undefined}
            onAction={!search ? () => setShowCreate(true) : undefined}
          />
        ) : (
          <Card padding="md" className="border-border bg-surface">
            <Table>
              <Thead>
                <Tr>
                  <Th>Numero</Th>
                  <Th>Cliente</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map((c) => (
                  <Tr
                    key={c.id}
                    className="cursor-pointer hover:bg-surface-muted"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <Td className="font-medium text-text">{c.numero}</Td>
                    <Td className="text-text-muted">
                      {clienteMap.get(c.clienteId) ?? 'Desconocido'}
                    </Td>
                    <Td className="text-right">
                      <PrecioDisplay value={c.total} size="sm" />
                    </Td>
                    <Td>
                      <Badge color={ESTADO_CONTRATO_COLOR[c.estado]}>
                        {ESTADO_CONTRATO_LABEL[c.estado]}
                      </Badge>
                    </Td>
                    <Td>
                      <FechaDisplay fecha={c.fecha} relative />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        )}
      </PageSection>

      {/* Detail panel */}
      {selectedContrato && (
        <DetailPanel
          contrato={selectedContrato}
          clienteNombre={clienteMap.get(selectedContrato.clienteId) ?? 'Desconocido'}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            refetch()
          }}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateContratoModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refetch()
            showToast('success', 'Contrato creado correctamente')
          }}
        />
      )}
    </DirectoryScreen>
  )
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  contrato,
  clienteNombre,
  onClose,
  onChanged
}: {
  contrato: Contrato
  clienteNombre: string
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const { showToast } = useToast()
  const [changingEstado, setChangingEstado] = useState(false)
  const [creandoCuenta, setCreandoCuenta] = useState(false)

  const { data: fullContrato, loading: loadingDetail } = useIpc<ContratoConItems>(
    () => window.api.contratos.obtener(contrato.id),
    [contrato.id]
  )

  const { data: cuentas } = useIpc<CuentaCobro[]>(
    () => window.api.cuentasCobro.listar(contrato.id),
    [contrato.id]
  )

  const nextEstado = NEXT_ESTADO[contrato.estado]

  async function handleCambiarEstado(): Promise<void> {
    if (!nextEstado) return
    setChangingEstado(true)
    try {
      const res = (await window.api.contratos.cambiarEstado(
        contrato.id,
        nextEstado
      )) as IpcResult<Contrato>
      if (res.ok) {
        showToast(
          'success',
          `Contrato marcado como ${ESTADO_CONTRATO_LABEL[nextEstado].toLowerCase()}`
        )
        onChanged()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al cambiar estado')
    } finally {
      setChangingEstado(false)
    }
  }

  async function handleRechazar(): Promise<void> {
    setChangingEstado(true)
    try {
      const res = (await window.api.contratos.cambiarEstado(
        contrato.id,
        'rechazada'
      )) as IpcResult<Contrato>
      if (res.ok) {
        showToast('success', 'Contrato marcado como rechazado')
        onChanged()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al rechazar contrato')
    } finally {
      setChangingEstado(false)
    }
  }

  async function handleCrearCuentaCobro(): Promise<void> {
    setCreandoCuenta(true)
    try {
      const res = (await window.api.cuentasCobro.crear({
        contratoId: contrato.id,
        total: contrato.total,
        retencion: contrato.retencionMonto,
        fecha: hoyISO()
      })) as IpcResult<CuentaCobro>
      if (res.ok) {
        showToast('success', `Cuenta de cobro ${res.data.numero} creada`)
        onChanged()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al crear cuenta de cobro')
    } finally {
      setCreandoCuenta(false)
    }
  }

  const items = fullContrato?.items ?? []

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface shadow-4 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">{contrato.numero}</h2>
              <p className="text-sm text-text-muted">{clienteNombre}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
              aria-label="Cerrar detalle"
            >
              <X size={20} />
            </button>
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">Estado:</span>
            <Badge color={ESTADO_CONTRATO_COLOR[contrato.estado]}>
              {ESTADO_CONTRATO_LABEL[contrato.estado]}
            </Badge>
          </div>

          {/* Info */}
          <Card padding="sm" className="border-border bg-surface shadow-none">
            <div className="space-y-3 text-sm">
              {contrato.descripcion && (
                <div>
                  <span className="text-text-muted">Descripción</span>
                  <p className="text-text">{contrato.descripcion}</p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Total</span>
                <PrecioDisplay value={contrato.total} size="sm" />
              </div>
              {contrato.retencionPorcentaje > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-muted">
                      Retención ({contrato.retencionPorcentaje}%)
                    </span>
                    <span className="tabular-nums text-text">
                      {formatCOP(contrato.retencionMonto)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-text-muted">Neto</span>
                    <span className="tabular-nums text-text">
                      {formatCOP(contrato.total - contrato.retencionMonto)}
                    </span>
                  </div>
                </>
              )}
              {contrato.condiciones && (
                <div>
                  <span className="text-text-muted">Condiciones</span>
                  <p className="text-text">{contrato.condiciones}</p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Fecha</span>
                <div className="text-right">
                  <FechaDisplay fecha={contrato.fecha} />
                  <FechaDisplay
                    fecha={contrato.fecha}
                    relative
                    className="block text-xs text-text-muted"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Items */}
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-soft">
              Items
            </h3>
            {loadingDetail ? (
              <p className="text-sm text-text-muted">Cargando items...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-text-muted">Sin items</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <Card key={item.id} padding="sm" className="border-border bg-surface shadow-none">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text">{item.descripcion}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {item.cantidad} x {formatCOP(item.valorUnitario)}
                        </p>
                      </div>
                      <span className="ml-3 tabular-nums text-sm font-medium text-text">
                        {formatCOP(item.subtotal)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Cuentas de cobro */}
          {cuentas && cuentas.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-soft">
                Cuentas de cobro
              </h3>
              <div className="space-y-2">
                {cuentas.map((cc) => (
                  <Card key={cc.id} padding="sm" className="border-border bg-surface shadow-none">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-text">{cc.numero}</p>
                        <FechaDisplay fecha={cc.fecha} relative />
                      </div>
                      <div className="text-right">
                        <span className="tabular-nums text-sm font-medium text-text">
                          {formatCOP(cc.totalNeto)}
                        </span>
                        <div className="mt-0.5">
                          <Badge
                            color={
                              cc.estado === 'pagada'
                                ? 'success'
                                : cc.estado === 'anulada'
                                  ? 'error'
                                  : 'info'
                            }
                          >
                            {cc.estado === 'pagada'
                              ? 'Pagada'
                              : cc.estado === 'anulada'
                                ? 'Anulada'
                                : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <p className="text-sm text-text-muted">
              {nextEstado
                ? `El siguiente paso sugerido es marcar el contrato como ${ESTADO_CONTRATO_LABEL[nextEstado].toLowerCase()}.`
                : 'Este contrato ya no tiene una transición pendiente.'}
            </p>
            {nextEstado && contrato.estado !== 'rechazada' && (
              <Button className="w-full" onClick={handleCambiarEstado} disabled={changingEstado}>
                <ArrowRight size={16} />
                {changingEstado ? 'Actualizando...' : NEXT_ESTADO_LABEL[contrato.estado]}
              </Button>
            )}
            {contrato.estado === 'enviada' && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleRechazar}
                disabled={changingEstado}
              >
                {changingEstado ? 'Actualizando...' : 'Rechazar contrato'}
              </Button>
            )}
            {(contrato.estado === 'aprobada' || contrato.estado === 'cobrada') && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleCrearCuentaCobro}
                disabled={creandoCuenta}
              >
                <Receipt size={16} />
                {creandoCuenta ? 'Creando...' : 'Crear cuenta de cobro'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

let itemKeyCounter = 0

function newItemRow(): ItemRow {
  return { key: ++itemKeyCounter, descripcion: '', cantidad: '1', valorUnitario: '' }
}

function CreateContratoModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}): React.JSX.Element {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [items, setItems] = useState<ItemRow[]>([newItemRow()])
  const [retencionPorcentaje, setRetencionPorcentaje] = useState('0')
  const [condiciones, setCondiciones] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { showToast } = useToast()

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        clienteId: number
        descripcion: string | null
        retencionPorcentaje: number
        condiciones: string | null
        fecha: string
        items: { descripcion: string; cantidad: number; valorUnitario: number }[]
      }) => window.api.contratos.crear(data),
      []
    )
  )

  function updateItem(key: number, field: keyof ItemRow, value: string): void {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
    if (errors['items']) setErrors((prev) => ({ ...prev, items: '' }))
  }

  function removeItem(key: number): void {
    setItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((it) => it.key !== key)
    })
  }

  function addItem(): void {
    setItems((prev) => [...prev, newItemRow()])
  }

  const parsedItems = useMemo(() => {
    return items.map((it) => {
      const cantidad = parseFloat(it.cantidad) || 0
      const valorUnitario = parseFloat(it.valorUnitario) || 0
      return {
        descripcion: it.descripcion,
        cantidad,
        valorUnitario,
        subtotal: cantidad * valorUnitario
      }
    })
  }, [items])

  const total = useMemo(() => parsedItems.reduce((acc, it) => acc + it.subtotal, 0), [parsedItems])
  const retencion = useMemo(() => {
    const pct = parseFloat(retencionPorcentaje) || 0
    return total * (pct / 100)
  }, [total, retencionPorcentaje])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!cliente) newErrors.cliente = 'Selecciona un cliente'
    const validItems = parsedItems.filter(
      (it) => it.descripcion.trim() && it.cantidad > 0 && it.valorUnitario > 0
    )
    if (validItems.length === 0) newErrors.items = 'Agrega al menos un item valido'
    if (!fecha) newErrors.fecha = 'La fecha es obligatoria'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      await execute({
        clienteId: cliente!.id,
        descripcion: descripcion.trim() || null,
        retencionPorcentaje: parseFloat(retencionPorcentaje) || 0,
        condiciones: condiciones.trim() || null,
        fecha,
        items: validItems.map((it) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          valorUnitario: it.valorUnitario
        }))
      })
      onCreated()
    } catch {
      showToast('error', 'Error al crear el contrato')
    }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo contrato" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ClientePicker
          label="Cliente *"
          value={cliente}
          onChange={(c) => {
            setCliente(c)
            if (errors.cliente) setErrors((prev) => ({ ...prev, cliente: '' }))
          }}
          error={errors.cliente}
        />

        <Input
          label="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción general del contrato (opcional)"
        />

        {/* Items */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text">Items *</label>
          {errors.items && <p className="text-xs text-error">{errors.items}</p>}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.key} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Descripción del item"
                    value={item.descripcion}
                    onChange={(e) => updateItem(item.key, 'descripcion', e.target.value)}
                    className={cn(
                      'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text',
                      'placeholder:text-text-soft',
                      'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
                    )}
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    placeholder="Cant."
                    value={item.cantidad}
                    onChange={(e) => updateItem(item.key, 'cantidad', e.target.value)}
                    min="0"
                    step="1"
                    className={cn(
                      'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text tabular-nums',
                      'placeholder:text-text-soft',
                      'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
                    )}
                  />
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    placeholder="Valor unit."
                    value={item.valorUnitario}
                    onChange={(e) => updateItem(item.key, 'valorUnitario', e.target.value)}
                    min="0"
                    step="100"
                    className={cn(
                      'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text tabular-nums',
                      'placeholder:text-text-soft',
                      'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
                    )}
                  />
                </div>
                <div className="flex h-10 w-28 items-center justify-end text-sm text-text-muted tabular-nums">
                  {formatCOP(parsedItems[idx]?.subtotal ?? 0)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className={cn(
                    'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-error-bg hover:text-error transition-colors',
                    items.length <= 1 && 'opacity-30 pointer-events-none'
                  )}
                  aria-label="Eliminar item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}>
            <Plus size={14} />
            Agregar item
          </Button>

          {/* Totals */}
          <div className="flex justify-end pt-2">
            <div className="text-right space-y-1">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-muted">Total:</span>
                <span className="font-semibold text-text tabular-nums">{formatCOP(total)}</span>
              </div>
              {retencion > 0 && (
                <>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-text-muted">Retención ({retencionPorcentaje}%):</span>
                    <span className="tabular-nums text-text-muted">-{formatCOP(retencion)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium">
                    <span className="text-text-muted">Neto:</span>
                    <span className="tabular-nums text-text">{formatCOP(total - retencion)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Retención %"
            type="number"
            value={retencionPorcentaje}
            onChange={(e) => setRetencionPorcentaje(e.target.value)}
            placeholder="0"
            min={0}
            max={100}
          />
          <Input
            label="Fecha *"
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value)
              if (errors.fecha) setErrors((prev) => ({ ...prev, fecha: '' }))
            }}
            error={errors.fecha}
          />
        </div>

        <Input
          label="Condiciones"
          value={condiciones}
          onChange={(e) => setCondiciones(e.target.value)}
          placeholder="Condiciones de pago o entrega (opcional)"
        />

        <p className="text-xs text-text-muted">
          La retención es para clientes empresa. Déjalo en 0 para personas naturales.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Creando...' : 'Crear contrato'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
