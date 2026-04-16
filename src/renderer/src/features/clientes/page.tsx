import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Phone,
  Mail,
  MapPin,
  FileText,
  X,
  Download,
  AlertCircle,
  Pencil,
  Calculator,
  ClipboardList,
  Receipt,
  UserX
} from 'lucide-react'
import { DirectoryScreen } from '@renderer/components/layout/page-frame'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PeopleIllustration } from '@renderer/components/illustrations'
import { PageLoader } from '@renderer/components/ui/spinner'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { iniciales, formatTelefono } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import type { Cliente, IpcResult } from '@shared/types'

type ClienteEstadisticas = {
  totalPedidos: number
  totalFacturado: number
  totalPagado: number
  saldoPendiente: number
  ultimoPedido: { numero: string; fechaIngreso: string; estado: string } | null
}

const AVATAR_COLORS = [
  'bg-accent/10 text-accent',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-info-bg text-info',
  'bg-error-bg text-error'
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

export default function ClientesPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const { showToast } = useToast()

  const {
    data: clientes,
    loading,
    error,
    refetch
  } = useIpc<Cliente[]>(() => window.api.clientes.listar({ soloActivos: true }), [])

  const filtered = useMemo(() => {
    if (!clientes) return []
    if (!search.trim()) return clientes
    const q = search.toLowerCase()
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.cedula?.toLowerCase().includes(q) ||
        c.telefono?.includes(q)
    )
  }, [clientes, search])

  const selectedCliente = useMemo(
    () => clientes?.find((c) => c.id === selectedId) ?? null,
    [clientes, selectedId]
  )

  if (loading) return <PageLoader />

  return (
    <DirectoryScreen
      title="Clientes y contexto comercial"
      subtitle="Usa el directorio como punto de salida operativo: ubica al cliente y salta a cotización, pedido o facturas sin volver a buscarlo."
      guidance={{
        tone: 'info',
        title: 'Este directorio ya no es solo informativo',
        message:
          'Desde cada ficha puedes revisar saldo, el último trabajo y abrir el siguiente módulo útil para ese cliente.'
      }}
      primaryAction={{ label: 'Nuevo cliente', onClick: () => setShowCreate(true), icon: Plus }}
      secondaryActions={[
        {
          label: 'Exportar',
          onClick: async (): Promise<void> => {
            try {
              const res = (await window.api.excel.exportarClientes()) as IpcResult<string>
              if (res.ok) {
                showToast({
                  tone: 'success',
                  title: 'Clientes exportados',
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
          variant: 'secondary'
        }
      ]}
      filters={
        <div className="space-y-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar por nombre, cédula o teléfono..."
          />
          {search && <p className="text-xs text-text-muted">{filtered.length} resultados</p>}
        </div>
      }
    >
      {error && !clientes && (
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
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          illustration={!search ? <PeopleIllustration size={140} /> : undefined}
          title={search ? 'Sin resultados' : 'Tu directorio está vacío'}
          description={
            search
              ? 'Intenta con otro término de búsqueda.'
              : 'Agrega tu primer cliente para empezar a llevar el historial de trabajos, cobros y seguimiento.'
          }
          actionLabel={!search ? 'Nuevo cliente' : undefined}
          onAction={!search ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              onOpen={() => setSelectedId(c.id)}
              onCall={(tel) => {
                window.location.href = `tel:${tel.replace(/\D/g, '')}`
              }}
              onCotizar={() => navigate('/cotizador')}
            />
          ))}
        </div>
      )}

      {selectedCliente && (
        <DetailPanel
          cliente={selectedCliente}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditCliente(selectedCliente)}
          onDeactivated={() => {
            setSelectedId(null)
            refetch()
          }}
        />
      )}

      {showCreate && (
        <CreateClienteModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            refetch()
            showToast('success', 'Cliente creado correctamente')
          }}
        />
      )}

      {editCliente && (
        <EditClienteModal
          cliente={editCliente}
          onClose={() => setEditCliente(null)}
          onUpdated={() => {
            setEditCliente(null)
            refetch()
            showToast('success', 'Cliente actualizado correctamente')
          }}
        />
      )}
    </DirectoryScreen>
  )
}

/* ------------------------------------------------------------------ */
/* Cliente Card with hover quick actions                              */
/* ------------------------------------------------------------------ */

// AGENT_UX: Card de cliente con quick actions visibles al hover.
// Botones: Cotizar (Calculator icon) y Llamar (Phone icon) — sin abrir
// la ficha. El usuario de 60 años puede iniciar acción en 1 click.
function ClienteCard({
  cliente,
  onOpen,
  onCall,
  onCotizar
}: {
  cliente: Cliente
  onOpen: () => void
  onCall: (tel: string) => void
  onCotizar: () => void
}): React.JSX.Element {
  const stopPropagation = (e: React.MouseEvent): void => e.stopPropagation()
  const clienteScore = scoreCliente(cliente)

  return (
    <Card hoverable padding="md" onClick={onOpen} className="group relative overflow-hidden">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'h-12 w-12 flex items-center justify-center rounded-full text-sm font-semibold shrink-0',
            avatarColor(cliente.id)
          )}
        >
          {iniciales(cliente.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-text">{cliente.nombre}</p>
            {cliente.esMenor && (
              <span className="shrink-0 text-[10px] font-medium text-info px-1.5 py-0.5 bg-info-bg rounded-sm">
                Menor
              </span>
            )}
            {clienteScore && (
              <span
                className={cn(
                  'shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm',
                  clienteScore.className
                )}
              >
                {clienteScore.label}
              </span>
            )}
          </div>
          {cliente.telefono && (
            <p className="mt-0.5 text-xs text-text-muted">{formatTelefono(cliente.telefono)}</p>
          )}
        </div>
      </div>

      {/* Hover overlay with quick actions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-full items-center gap-2 border-t border-border bg-surface/95 px-3 py-2 opacity-0 backdrop-blur transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <Button
          size="sm"
          variant="primary"
          onClick={(e) => {
            stopPropagation(e)
            onCotizar()
          }}
          className="flex-1"
        >
          <Calculator size={14} />
          Cotizar
        </Button>
        {cliente.telefono ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              stopPropagation(e)
              onCall(cliente.telefono!)
            }}
            className="flex-1"
            title={`Llamar a ${formatTelefono(cliente.telefono)}`}
          >
            <Phone size={14} />
            Llamar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              stopPropagation(e)
              onOpen()
            }}
            className="flex-1"
          >
            <ClipboardList size={14} />
            Abrir
          </Button>
        )}
      </div>
    </Card>
  )
}

type ClienteScore = { label: string; className: string } | null

// AGENT_UX (PRO-005): Scoring informal — VIP, Regular, Nuevo según el
// número de pedidos (placeholder hasta que biz agent agregue stats en
// card). Por ahora usamos un heurístico conservador con el campo `esMenor`
// deshabilitado y un score neutro. biz puede refinar.
// AGENT_UX_NEEDS_BIZ: necesitamos `totalPedidos` o `totalFacturado` en el
// row cliente (no solo en /estadisticas) para scoring real en el grid.
function scoreCliente(cliente: Cliente): ClienteScore {
  // Por ahora devolvemos null hasta que biz exponga el conteo en el row.
  // Cuando biz agregue cliente.totalPedidos o cliente.totalGastado, usar:
  //   if (totalGastado > 500_000) return { label: 'VIP', className: 'bg-accent/10 text-accent-strong' }
  //   if (totalPedidos >= 5) return { label: 'Regular', className: 'bg-info-bg text-info-strong' }
  //   if (totalPedidos < 3) return { label: 'Nuevo', className: 'bg-success-bg text-success-strong' }
  void cliente
  return null
}

/* ------------------------------------------------------------------ */
/* Detail Panel                                                       */
/* ------------------------------------------------------------------ */

function DetailPanel({
  cliente,
  onClose,
  onEdit,
  onDeactivated
}: {
  cliente: Cliente
  onClose: () => void
  onEdit: () => void
  onDeactivated: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const { data: stats, loading } = useIpc<ClienteEstadisticas>(
    () => window.api.clientes.estadisticas(cliente.id),
    [cliente.id]
  )

  async function handleDeactivate(): Promise<void> {
    setDeactivating(true)
    try {
      const res = (await window.api.clientes.desactivar(cliente.id)) as IpcResult<Cliente>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Cliente desactivado',
          message: `${cliente.nombre} fue desactivado del directorio.`
        })
        setShowDeactivate(false)
        onDeactivated()
      } else {
        showToast({ tone: 'error', title: 'No se pudo desactivar', message: res.error })
        setShowDeactivate(false)
      }
    } catch {
      showToast({ tone: 'error', title: 'Error', message: 'No se pudo desactivar el cliente' })
      setShowDeactivate(false)
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${cliente.nombre}`}
        className="relative h-full w-full max-w-md overflow-y-auto bg-surface shadow-4 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'h-14 w-14 flex items-center justify-center rounded-full text-base font-semibold',
                  avatarColor(cliente.id)
                )}
              >
                {iniciales(cliente.nombre)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">{cliente.nombre}</h2>
                {cliente.cedula && <p className="text-sm text-text-muted">CC {cliente.cedula}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-accent-strong transition-colors"
                aria-label="Editar cliente"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={onClose}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
                aria-label="Cerrar detalle"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <GuidanceHint
            tone={stats && stats.saldoPendiente > 0 ? 'warning' : 'info'}
            title={
              stats && stats.saldoPendiente > 0
                ? 'Hay saldo por revisar'
                : 'Ficha lista para seguimiento'
            }
            message={
              stats && stats.saldoPendiente > 0
                ? 'Conviene revisar facturas o abonos pendientes antes del siguiente trabajo.'
                : 'Usa esta ficha para revisar antecedentes, datos de contacto y el último pedido del cliente.'
            }
          />

          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={() => navigate('/cotizador')} className="justify-center">
              <Calculator size={16} />
              Cotizar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/pedidos')}
              className="justify-center"
            >
              <ClipboardList size={16} />
              Pedidos
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/facturas?focus=pendiente')}
              className="justify-center"
            >
              <Receipt size={16} />
              Facturas
            </Button>
          </div>

          <div className="space-y-3">
            {cliente.telefono && (
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="shrink-0 text-text-soft" />
                <span className="text-text">{formatTelefono(cliente.telefono)}</span>
              </div>
            )}
            {cliente.correo && (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="shrink-0 text-text-soft" />
                <span className="text-text">{cliente.correo}</span>
              </div>
            )}
            {cliente.direccion && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="shrink-0 text-text-soft" />
                <span className="text-text">{cliente.direccion}</span>
              </div>
            )}
            {cliente.notas && (
              <div className="flex items-start gap-3 text-sm">
                <FileText size={16} className="mt-0.5 shrink-0 text-text-soft" />
                <span className="text-text-muted">{cliente.notas}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-text-muted">Cargando estadísticas...</div>
          ) : stats ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-text-soft">
                Estadísticas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Card padding="sm" className="text-center">
                  <p className="text-2xl font-semibold tabular-nums text-text">
                    {stats.totalPedidos}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">Pedidos</p>
                </Card>
                <Card padding="sm" className="text-center">
                  <PrecioDisplay value={stats.totalFacturado} size="sm" className="text-text" />
                  <p className="mt-1 text-xs text-text-muted">Facturado</p>
                </Card>
                <Card padding="sm" className="text-center">
                  <PrecioDisplay
                    value={stats.totalPagado}
                    size="sm"
                    className="text-success-strong"
                  />
                  <p className="mt-1 text-xs text-text-muted">Pagado</p>
                </Card>
                <Card padding="sm" className="text-center">
                  <PrecioDisplay
                    value={stats.saldoPendiente}
                    size="sm"
                    className={stats.saldoPendiente > 0 ? 'text-warning-strong' : 'text-text'}
                  />
                  <p className="mt-1 text-xs text-text-muted">Saldo</p>
                </Card>
              </div>
              {stats.ultimoPedido && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-text-soft">
                    Último pedido
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">#{stats.ultimoPedido.numero}</p>
                      <FechaDisplay fecha={stats.ultimoPedido.fechaIngreso} relative />
                    </div>
                    <Badge color="info">{stats.ultimoPedido.estado}</Badge>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {cliente.activo && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-error hover:bg-error-bg"
                onClick={() => setShowDeactivate(true)}
              >
                <UserX size={16} />
                Desactivar cliente
              </Button>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={showDeactivate}
          onClose={() => setShowDeactivate(false)}
          onConfirm={handleDeactivate}
          title="Desactivar cliente"
          message={`${cliente.nombre} dejará de aparecer en el directorio activo. Sus pedidos y facturas existentes no se eliminan.`}
          confirmLabel="Desactivar"
          danger
          loading={deactivating}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Create Modal                                                       */
/* ------------------------------------------------------------------ */

function CreateClienteModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    cedula: '',
    correo: '',
    direccion: '',
    notas: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: typeof form) =>
        window.api.clientes.crear({
          nombre: data.nombre,
          telefono: data.telefono || null,
          cedula: data.cedula || null,
          correo: data.correo || null,
          direccion: data.direccion || null,
          notas: data.notas || null
        }),
      []
    )
  )

  function handleChange(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    try {
      await execute(form)
      onCreated()
    } catch {
      // error is handled by the mutation hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo cliente" size="md">
      <GuidanceHint
        tone="info"
        title="Guarda solo lo necesario"
        message="Nombre y teléfono suelen ser suficientes para empezar. El resto lo puedes completar después."
        className="mb-4"
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={form.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          error={errors.nombre}
          placeholder="Nombre completo del cliente"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="300 123 4567"
          />
          <Input
            label="Cédula"
            value={form.cedula}
            onChange={(e) => handleChange('cedula', e.target.value)}
            placeholder="1234567890"
          />
        </div>
        <Input
          label="Correo"
          type="email"
          value={form.correo}
          onChange={(e) => handleChange('correo', e.target.value)}
          placeholder="correo@ejemplo.com"
        />
        <Input
          label="Dirección"
          value={form.direccion}
          onChange={(e) => handleChange('direccion', e.target.value)}
          placeholder="Dirección del cliente"
        />
        <Input
          label="Notas"
          value={form.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
          placeholder="Notas adicionales"
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Edit Modal                                                         */
/* ------------------------------------------------------------------ */

function EditClienteModal({
  cliente,
  onClose,
  onUpdated
}: {
  cliente: Cliente
  onClose: () => void
  onUpdated: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? '',
    cedula: cliente.cedula ?? '',
    correo: cliente.correo ?? '',
    direccion: cliente.direccion ?? '',
    notas: cliente.notas ?? ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  function handleChange(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setLoading(true)
    try {
      const res = (await window.api.clientes.actualizar(cliente.id, {
        nombre: form.nombre,
        telefono: form.telefono || null,
        cedula: form.cedula || null,
        correo: form.correo || null,
        direccion: form.direccion || null,
        notas: form.notas || null
      })) as IpcResult<Cliente>
      if (res.ok) {
        onUpdated()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al actualizar el cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar cliente" size="md">
      <GuidanceHint
        tone="info"
        title="Mantén la ficha útil"
        message="Aprovecha las notas para dejar referencias de gustos, horarios o pendientes del cliente."
        className="mb-4"
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={form.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          error={errors.nombre}
          placeholder="Nombre completo del cliente"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="300 123 4567"
          />
          <Input
            label="Cédula"
            value={form.cedula}
            onChange={(e) => handleChange('cedula', e.target.value)}
            placeholder="1234567890"
          />
        </div>
        <Input
          label="Correo"
          type="email"
          value={form.correo}
          onChange={(e) => handleChange('correo', e.target.value)}
          placeholder="correo@ejemplo.com"
        />
        <Input
          label="Dirección"
          value={form.direccion}
          onChange={(e) => handleChange('direccion', e.target.value)}
          placeholder="Dirección del cliente"
        />
        <Input
          label="Notas"
          value={form.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
          placeholder="Notas adicionales"
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
