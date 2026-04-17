import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Download, Plus, ArrowUpDown, AlertCircle, Truck } from 'lucide-react'
import { SearchInput } from '@renderer/components/ui/search-input'
import { DirectoryScreen } from '@renderer/components/layout/page-frame'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useDirtyGuard } from '@renderer/hooks/use-dirty-guard'
import { useToast } from '@renderer/contexts/toast-context'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { BoxesIllustration } from '@renderer/components/illustrations'
import { PageLoader } from '@renderer/components/ui/spinner'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { cn } from '@renderer/lib/cn'
import { formatNumber, hoyISO } from '@renderer/lib/format'
import type { InventarioItem, IpcResult } from '@shared/types'
import {
  TIPOS_INVENTARIO,
  UNIDADES_INVENTARIO,
  TIPOS_MOV_INVENTARIO,
  MOTIVOS_MOV_INVENTARIO
} from '@shared/types'
import type { StatusColor } from '@renderer/lib/constants'

type StockEstado = 'BIEN' | 'BAJO' | 'CRITICO'

function getStockEstado(stockActual: number, stockMinimo: number): StockEstado {
  if (stockMinimo <= 0) return 'BIEN'
  if (stockActual <= stockMinimo) return 'CRITICO'
  if (stockActual <= stockMinimo * 1.5) return 'BAJO'
  return 'BIEN'
}

const STOCK_COLOR: Record<StockEstado, StatusColor> = {
  BIEN: 'success',
  BAJO: 'warning',
  CRITICO: 'error'
}

const STOCK_LABEL: Record<StockEstado, string> = {
  BIEN: 'Bien',
  BAJO: 'Bajo',
  CRITICO: 'Crítico'
}

const TIPO_LABEL: Record<string, string> = {
  marco: 'Marco',
  vidrio: 'Vidrio',
  paspartu: 'Paspartú',
  mdf: 'MDF',
  carton: 'Cartón',
  otro: 'Otro'
}

const UNIDAD_LABEL: Record<string, string> = {
  metros: 'm',
  m2: 'm2',
  unidades: 'und',
  laminas: 'lam'
}

const STOCK_PRIORITY: Record<StockEstado, number> = {
  CRITICO: 0,
  BAJO: 1,
  BIEN: 2
}

export default function InventarioPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMovModal, setShowMovModal] = useState(false)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()
  const {
    data: items,
    loading,
    error,
    refetch
  } = useIpc<InventarioItem[]>(() => window.api.inventario.listar(true), [])

  const enriched = useMemo(() => {
    if (!items) return []
    return items
      .map((item) => ({
        ...item,
        stockEstado: getStockEstado(item.stockActual, item.stockMinimo)
      }))
      .sort((a, b) => {
        const pri = STOCK_PRIORITY[a.stockEstado] - STOCK_PRIORITY[b.stockEstado]
        if (pri !== 0) return pri
        return a.nombre.localeCompare(b.nombre, 'es')
      })
  }, [items])

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched
    const q = search.trim().toLowerCase()
    return enriched.filter(
      (item) =>
        item.nombre.toLowerCase().includes(q) ||
        (item.referencia && item.referencia.toLowerCase().includes(q))
    )
  }, [enriched, search])

  const criticos = useMemo(() => enriched.filter((i) => i.stockEstado === 'CRITICO'), [enriched])

  if (loading) return <PageLoader />

  return (
    <DirectoryScreen
      title="Inventario de materiales"
      subtitle="Controla existencias reales y registra entradas o salidas sin perder de vista qué materiales necesitan reposición."
      guidance={{
        tone: 'info',
        title: 'Piensa este módulo como stock operativo',
        message:
          'Úsalo para materiales almacenados en taller. Los marcos siguen el flujo de proveedor según cada trabajo.'
      }}
      primaryAction={{
        label: 'Nuevo material',
        onClick: () => setShowCreateModal(true),
        icon: Plus
      }}
      secondaryActions={[
        {
          label: 'Registrar movimiento',
          onClick: () => setShowMovModal(true),
          icon: ArrowUpDown,
          variant: 'secondary'
        },
        {
          label: 'Exportar',
          onClick: async (): Promise<void> => {
            try {
              const res = (await window.api.excel.exportarInventario()) as IpcResult<string>
              if (res.ok) {
                showToast({
                  tone: 'success',
                  title: 'Inventario exportado',
                  message: `Archivo generado en ${res.data}.`
                })
              } else {
                showToast('error', res.error)
              }
            } catch (err) {
              console.error('Excel export failed:', err)
              showToast('error', 'Error al exportar')
            }
          },
          icon: Download,
          variant: 'outline'
        }
      ]}
    >
      {error && !items && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/20 bg-warning-bg p-4 text-text">
          <AlertCircle size={20} className="shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-medium">Algo salió mal al cargar los datos</p>
            <p className="text-xs text-text-muted">
              Intenta cerrar y abrir la app. Si el problema sigue, revisa la configuración.
            </p>
          </div>
        </div>
      )}
      {enriched.length > 0 && (
        <div className="flex gap-3">
          <Badge color="success">
            {enriched.filter((i) => i.stockEstado === 'BIEN').length} en buen nivel
          </Badge>
          <Badge color="warning">
            {enriched.filter((i) => i.stockEstado === 'BAJO').length} stock bajo
          </Badge>
          <Badge color="error">
            {enriched.filter((i) => i.stockEstado === 'CRITICO').length} críticos
          </Badge>
        </div>
      )}

      {criticos.length > 0 && (
        <GuidanceHint
          tone="warning"
          title="Stock crítico"
          message={
            criticos.length === 1
              ? `${criticos[0].nombre} está en nivel crítico. Considera hacer pedido al proveedor.`
              : `${criticos.map((i) => i.nombre).join(' y ')} están en nivel crítico. Considera hacer pedido al proveedor.`
          }
        />
      )}

      {enriched.length > 0 && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Buscar por nombre o referencia…"
          className="max-w-sm"
        />
      )}

      {enriched.length === 0 ? (
        <EmptyState
          icon={Package}
          illustration={<BoxesIllustration size={140} />}
          title="Sin materiales registrados"
          description="Registra los materiales que almacenas en el local para controlar el stock. Los marcos no van aquí porque se piden al proveedor."
          actionLabel="Nuevo material"
          onAction={() => setShowCreateModal(true)}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin resultados"
          description="No se encontraron materiales con ese criterio de búsqueda."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nombre</Th>
              <Th>Referencia</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Stock actual</Th>
              <Th className="text-right">Stock mínimo</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acción</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((item) => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.nombre}</Td>
                <Td className="text-text-muted">{item.referencia || '-'}</Td>
                <Td className="text-text-muted">{TIPO_LABEL[item.tipo] ?? item.tipo}</Td>
                <Td className="text-right">
                  <span
                    className={cn(
                      'tabular-nums font-semibold text-sm',
                      item.stockEstado === 'CRITICO' && 'text-error-strong',
                      item.stockEstado === 'BAJO' && 'text-warning-strong',
                      item.stockEstado === 'BIEN' && 'text-text'
                    )}
                  >
                    {formatNumber(item.stockActual)}
                  </span>
                  <span className="ml-1 text-xs text-text-muted">
                    {UNIDAD_LABEL[item.unidad] ?? item.unidad}
                  </span>
                </Td>
                <Td className="text-right">
                  <span className="tabular-nums text-sm text-text-muted">
                    {formatNumber(item.stockMinimo)}
                  </span>
                  <span className="ml-1 text-xs text-text-muted">
                    {UNIDAD_LABEL[item.unidad] ?? item.unidad}
                  </span>
                </Td>
                <Td>
                  <Badge color={STOCK_COLOR[item.stockEstado]}>
                    {STOCK_LABEL[item.stockEstado]}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {item.stockEstado !== 'BIEN' && (
                    <Button
                      size="sm"
                      variant={item.stockEstado === 'CRITICO' ? 'primary' : 'outline'}
                      onClick={() => navigate('/proveedores')}
                      title={`Ir a proveedores para reponer ${item.nombre}`}
                    >
                      <Truck size={14} />
                      Pedir
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {showCreateModal && (
        <NuevoItemModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refetch()
            showToast('success', 'Material creado correctamente')
          }}
        />
      )}

      {showMovModal && (
        <RegistrarMovimientoModal
          items={items ?? []}
          onClose={() => setShowMovModal(false)}
          onSuccess={(nuevoStock) => {
            setShowMovModal(false)
            refetch()
            showToast('success', `Movimiento registrado. Nuevo stock: ${formatNumber(nuevoStock)}`)
          }}
        />
      )}
    </DirectoryScreen>
  )
}

/* ------------------------------------------------------------------ */
/* Nuevo Item Modal                                                   */
/* ------------------------------------------------------------------ */

// Marcos NO van en inventario — se piden bajo demanda al proveedor (Fase 1, 4.2)
const TIPO_OPTIONS = TIPOS_INVENTARIO.filter((t) => t !== 'marco').map((t) => ({
  value: t,
  label: TIPO_LABEL[t] ?? t
}))

const UNIDAD_OPTIONS = UNIDADES_INVENTARIO.map((u) => ({
  value: u,
  label: UNIDAD_LABEL[u] ?? u
}))

function NuevoItemModal({
  onClose,
  onSuccess
}: {
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    nombre: '',
    referencia: '',
    tipo: 'vidrio' as string,
    unidad: 'm2' as string,
    stockActual: '0',
    stockMinimo: '0'
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        nombre: string
        referencia: string
        tipo: string
        unidad: string
        stockActual: number
        stockMinimo: number
      }) => window.api.inventario.crear(data),
      []
    )
  )

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.nombre.trim()) return
    try {
      await execute({
        nombre: form.nombre.trim(),
        referencia: form.referencia.trim(),
        tipo: form.tipo,
        unidad: form.unidad,
        stockActual: parseFloat(form.stockActual) || 0,
        stockMinimo: parseFloat(form.stockMinimo) || 0
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  // C1 — dirty "significativo": solo el nombre (>=3 chars) cuenta. Tipo,
  // unidad y stock son dropdowns/defaults que se rellenan rapidísimo; no vale
  // interrumpir por eso. La referencia también es corta.
  const dirty = form.nombre.trim().length >= 3
  const guard = useDirtyGuard(dirty, onClose)

  return (
    <>
      <Modal
        open
        onClose={guard.handleClose}
        onBeforeClose={guard.onBeforeClose}
        title="Nuevo material"
        size="md"
      >
        <GuidanceHint
          tone="info"
          title="Piensa en stock físico"
          message="Solo registra materiales que realmente guardas en el taller. Los marcos se siguen gestionando por proveedor."
          className="mb-4"
        />
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre del material"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            placeholder={
              form.tipo === 'vidrio'
                ? 'Ej: Vidrio claro 2mm'
                : form.tipo === 'mdf'
                  ? 'Ej: MDF 3mm'
                  : form.tipo === 'carton'
                    ? 'Ej: Cartón para paspartú'
                    : form.tipo === 'paspartu'
                      ? 'Ej: Paspartú pintado blanco'
                      : 'Ej: Nombre del material'
            }
            required
          />
          <Input
            label="Referencia"
            value={form.referencia}
            onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))}
            placeholder="Codigo o referencia (opcional)"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tipo de material"
              options={TIPO_OPTIONS}
              value={form.tipo}
              onChange={(e) => {
                const tipo = e.target.value
                const defaultUnidad =
                  tipo === 'vidrio'
                    ? 'm2'
                    : tipo === 'mdf' || tipo === 'carton' || tipo === 'paspartu'
                      ? 'laminas'
                      : 'unidades'
                setForm((p) => ({ ...p, tipo, unidad: defaultUnidad }))
              }}
            />
            <Select
              label="Unidad de medida"
              options={UNIDAD_OPTIONS}
              value={form.unidad}
              onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cantidad actual"
              type="number"
              min="0"
              step="0.01"
              value={form.stockActual}
              onChange={(e) => setForm((p) => ({ ...p, stockActual: e.target.value }))}
            />
            <Input
              label="Mínimo para alerta"
              type="number"
              min="0"
              step="0.01"
              value={form.stockMinimo}
              onChange={(e) => setForm((p) => ({ ...p, stockMinimo: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !form.nombre.trim()}>
              {loading ? 'Creando...' : 'Crear material'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={guard.confirmOpen}
        onClose={guard.cancelClose}
        onConfirm={guard.confirmClose}
        title="¿Descartar el material?"
        message="Aún no terminaste de crear el material. Si sales ahora se perderá el nombre que escribiste."
        confirmLabel="Sí, descartar"
        danger
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Registrar Movimiento Modal                                         */
/* ------------------------------------------------------------------ */

const TIPO_MOV_OPTIONS = TIPOS_MOV_INVENTARIO.map((t) => ({
  value: t,
  label: t === 'entrada' ? 'Entrada' : 'Salida'
}))

const MOTIVO_LABEL: Record<string, string> = {
  pedido_proveedor: 'Pedido a proveedor',
  uso_pedido: 'Uso en pedido',
  ajuste: 'Ajuste',
  otro: 'Otro'
}

const MOTIVO_OPTIONS = MOTIVOS_MOV_INVENTARIO.map((m) => ({
  value: m,
  label: MOTIVO_LABEL[m] ?? m
}))

function RegistrarMovimientoModal({
  items,
  onClose,
  onSuccess
}: {
  items: InventarioItem[]
  onClose: () => void
  onSuccess: (nuevoStock: number) => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    inventarioId: '',
    tipo: 'entrada' as string,
    cantidad: '',
    motivo: 'pedido_proveedor' as string,
    fecha: hoyISO(),
    notas: ''
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        inventarioId: number
        tipo: string
        cantidad: number
        motivo: string
        fecha: string
        notas: string
      }) => window.api.inventario.registrarMovimiento(data),
      []
    )
  )

  const itemOptions = items.map((i) => ({
    value: String(i.id),
    label: `${i.nombre}${i.referencia ? ` (${i.referencia})` : ''}`
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.inventarioId) return
    const cantidad = parseFloat(form.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) return
    try {
      const result = await execute({
        inventarioId: parseInt(form.inventarioId),
        tipo: form.tipo,
        cantidad,
        motivo: form.motivo,
        fecha: form.fecha,
        notas: form.notas.trim()
      })
      const res = result as unknown as { mov: unknown; nuevoStock: number }
      onSuccess(res.nuevoStock)
    } catch {
      // handled by hook
    }
  }

  // C1 — dirty "significativo": cantidad ingresada o notas con texto real
  // (>=3 chars). Tipo/motivo son dropdowns rellenables en segundos, no vale
  // interrumpir solo por tocarlos. Material seleccionado SÍ importa porque
  // requiere recordar cuál.
  const dirty =
    form.inventarioId !== '' || form.cantidad.trim().length > 0 || form.notas.trim().length >= 3
  const guard = useDirtyGuard(dirty, onClose)

  return (
    <>
      <Modal
        open
        onClose={guard.handleClose}
        onBeforeClose={guard.onBeforeClose}
        title="Registrar movimiento"
        size="md"
      >
        <GuidanceHint
          tone="accent"
          title="Registra lo que entra y lo que sale"
          message="Las entradas suelen venir del proveedor y las salidas del uso en pedidos o ajustes. Deja una nota si necesitas contexto para después."
          className="mb-4"
        />
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Material"
            options={itemOptions}
            value={form.inventarioId}
            onChange={(e) => setForm((p) => ({ ...p, inventarioId: e.target.value }))}
            placeholder="Seleccionar material"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tipo"
              options={TIPO_MOV_OPTIONS}
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
            />
            <Input
              label="Cantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={form.cantidad}
              onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Motivo"
              options={MOTIVO_OPTIONS}
              value={form.motivo}
              onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
            />
            <Input
              label="Fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
            />
          </div>
          <Input
            label="Notas"
            value={form.notas}
            onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
            placeholder="Notas opcionales"
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !form.inventarioId || !form.cantidad}
            >
              {loading ? 'Registrando...' : 'Registrar movimiento'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={guard.confirmOpen}
        onClose={guard.cancelClose}
        onConfirm={guard.confirmClose}
        title="¿Descartar el movimiento?"
        message="Aún no terminaste de registrar el movimiento. Si sales ahora se perderán los datos que ingresaste."
        confirmLabel="Sí, descartar"
        danger
      />
    </>
  )
}
