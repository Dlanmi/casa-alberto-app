import { useState, useMemo, useCallback } from 'react'
import {
  Truck,
  Plus,
  Phone,
  Package,
  Calendar,
  CreditCard,
  X,
  Pencil,
  FileText,
  PackageCheck
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { WorkshopIllustration } from '@renderer/components/illustrations'
import { PageLoader } from '@renderer/components/ui/spinner'
import { DirectoryScreen, MetricCard, PageSection } from '@renderer/components/layout/page-frame'
import { formatTelefono } from '@renderer/lib/format'
import type { Proveedor } from '@shared/types'

export default function ProveedoresPage(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProveedor, setEditProveedor] = useState<Proveedor | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { showToast } = useToast()

  const {
    data: proveedores,
    loading,
    refetch
  } = useIpc<Proveedor[]>(() => window.api.proveedores.listar({ soloActivos: true }), [])

  const filtered = useMemo(() => {
    if (!proveedores) return []
    if (!search.trim()) return proveedores
    const q = search.toLowerCase()
    return proveedores.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.producto?.toLowerCase().includes(q)
    )
  }, [proveedores, search])

  const selectedProveedor = useMemo(
    () => proveedores?.find((p) => p.id === selectedId) ?? null,
    [proveedores, selectedId]
  )

  const stats = useMemo(() => {
    const total = proveedores?.length ?? 0
    const conContacto = proveedores?.filter((p) => Boolean(p.telefono)).length ?? 0
    const conCondiciones =
      proveedores?.filter((p) => Boolean(p.formaPago || p.diasPedido)).length ?? 0
    return { total, conContacto, conCondiciones }
  }, [proveedores])

  if (loading) return <PageLoader />

  return (
    <DirectoryScreen
      title="Proveedores"
      subtitle="Directorio operativo de materiales, condiciones de pedido y contactos clave."
      guidance={{
        title: 'Siguiente paso recomendado',
        message:
          'Abre un proveedor para revisar su producto, forma de pago o días de pedido antes de hacer un nuevo encargo.',
        actionLabel: 'Nuevo proveedor',
        onAction: () => {
          setEditProveedor(null)
          setShowModal(true)
        },
        tone: 'info'
      }}
      primaryAction={{
        label: 'Nuevo proveedor',
        onClick: () => {
          setEditProveedor(null)
          setShowModal(true)
        },
        icon: Plus
      }}
      filters={
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Buscar por nombre, producto o forma de pago..."
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Proveedores"
          value={stats.total}
          detail="Registrados y disponibles para nuevos pedidos"
          icon={Truck}
        />
        <MetricCard
          label="Con contacto"
          value={stats.conContacto}
          detail="Con teléfono cargado en la ficha"
          icon={Phone}
          tone="info"
        />
        <MetricCard
          label="Con condiciones"
          value={stats.conCondiciones}
          detail="Con forma de pago o días de pedido"
          icon={CreditCard}
          tone="success"
        />
      </div>

      <PageSection
        title="Directorio de proveedores"
        description={
          filtered.length === 0
            ? 'No hay coincidencias para la búsqueda actual.'
            : `${filtered.length} proveedores visibles`
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            illustration={!search ? <WorkshopIllustration size={140} /> : undefined}
            title={search ? 'Sin resultados' : 'Sin proveedores registrados'}
            description={
              search
                ? 'Intenta con otro término o limpia el filtro.'
                : 'Agrega tus proveedores de marcos, vidrios y materiales para tener su información siempre a la mano.'
            }
            actionLabel={!search ? 'Nuevo proveedor' : undefined}
            onAction={!search ? () => setShowModal(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                hoverable
                padding="md"
                onClick={() => setSelectedId(p.id)}
                className="space-y-3 border-border bg-surface"
              >
                <div>
                  <p className="text-sm font-semibold text-text">{p.nombre}</p>
                  {p.producto && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Package size={14} className="text-text-soft" />
                      <span className="truncate text-xs text-text-muted">{p.producto}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {p.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={14} className="text-text-soft" />
                      <span className="text-xs text-text-muted">{formatTelefono(p.telefono)}</span>
                    </div>
                  )}
                  {p.diasPedido && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-text-soft" />
                      <span className="text-xs text-text-muted">{p.diasPedido}</span>
                    </div>
                  )}
                  {p.formaPago && (
                    <div className="flex items-center gap-1.5">
                      <CreditCard size={14} className="text-text-soft" />
                      <span className="text-xs text-text-muted">{p.formaPago}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageSection>

      {selectedProveedor && (
        <ProveedorDetailPanel
          proveedor={selectedProveedor}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setEditProveedor(selectedProveedor)
            setShowModal(true)
          }}
        />
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <ProveedorFormModal
          proveedor={editProveedor}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            refetch()
            showToast('success', editProveedor ? 'Proveedor actualizado' : 'Proveedor creado')
          }}
        />
      )}
    </DirectoryScreen>
  )
}

/* ------------------------------------------------------------------ */
/* Detail Panel                                                       */
/* ------------------------------------------------------------------ */

function ProveedorDetailPanel({
  proveedor,
  onClose,
  onEdit
}: {
  proveedor: Proveedor
  onClose: () => void
  onEdit: () => void
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${proveedor.nombre}`}
        className="relative h-full w-105 max-w-[80vw] overflow-y-auto bg-surface shadow-4 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Truck size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">{proveedor.nombre}</h2>
                {proveedor.producto && (
                  <p className="text-sm text-text-muted">{proveedor.producto}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-accent-strong transition-colors"
                aria-label="Editar proveedor"
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

          {/* Info rows */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-soft">
              Informacion de contacto
            </h3>
            <div className="space-y-3">
              {proveedor.telefono ? (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="shrink-0 text-text-soft" />
                  <span className="text-text">{formatTelefono(proveedor.telefono)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="shrink-0 text-text-soft" />
                  <span className="text-text-muted">Sin telefono registrado</span>
                </div>
              )}
              {proveedor.producto ? (
                <div className="flex items-center gap-3 text-sm">
                  <Package size={16} className="shrink-0 text-text-soft" />
                  <span className="text-text">{proveedor.producto}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <Package size={16} className="shrink-0 text-text-soft" />
                  <span className="text-text-muted">Sin producto definido</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-soft">
              Condiciones comerciales
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="shrink-0 text-text-soft" />
                <div>
                  <p className="text-xs text-text-soft">Dias de pedido</p>
                  <p className="text-text">{proveedor.diasPedido || 'No especificado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CreditCard size={16} className="shrink-0 text-text-soft" />
                <div>
                  <p className="text-xs text-text-soft">Forma de pago</p>
                  <p className="text-text">{proveedor.formaPago || 'No especificada'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <PackageCheck size={16} className="shrink-0 text-text-soft" />
                <div>
                  <p className="text-xs text-text-soft">Forma de entrega</p>
                  <p className="text-text">{proveedor.formaEntrega || 'No especificada'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-soft">Notas</h3>
            {proveedor.notas ? (
              <div className="flex items-start gap-3 text-sm">
                <FileText size={16} className="mt-0.5 shrink-0 text-text-soft" />
                <span className="text-text-muted">{proveedor.notas}</span>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Sin notas adicionales</p>
            )}
          </div>

          {/* Editar button */}
          <div className="pt-2">
            <Button onClick={onEdit} className="w-full justify-center">
              <Pencil size={16} />
              Editar proveedor
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Form Modal                                                         */
/* ------------------------------------------------------------------ */

function ProveedorFormModal({
  proveedor,
  onClose,
  onSaved
}: {
  proveedor: Proveedor | null
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const isEdit = !!proveedor
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? '',
    producto: proveedor?.producto ?? '',
    telefono: proveedor?.telefono ?? '',
    diasPedido: proveedor?.diasPedido ?? '',
    formaPago: proveedor?.formaPago ?? '',
    formaEntrega: proveedor?.formaEntrega ?? '',
    notas: proveedor?.notas ?? ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { execute: crear, loading: creando } = useIpcMutation(
    useCallback((data: Record<string, string | null>) => window.api.proveedores.crear(data), [])
  )

  const { execute: actualizar, loading: actualizando } = useIpcMutation(
    useCallback(
      (id: number, data: Record<string, string | null>) =>
        window.api.proveedores.actualizar(id, data),
      []
    )
  )

  const loading = creando || actualizando

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

    const data = {
      nombre: form.nombre,
      producto: form.producto || null,
      telefono: form.telefono || null,
      diasPedido: form.diasPedido || null,
      formaPago: form.formaPago || null,
      formaEntrega: form.formaEntrega || null,
      notas: form.notas || null
    }

    try {
      if (isEdit) {
        await actualizar(proveedor!.id, data)
      } else {
        await crear(data)
      }
      onSaved()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Editar proveedor' : 'Nuevo proveedor'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-muted">
          Completa lo esencial para poder llamar, pedir o coordinar entregas sin tener que salir de
          esta ficha.
        </p>
        <Input
          label="Nombre *"
          value={form.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          error={errors.nombre}
          placeholder="Nombre del proveedor"
        />
        <Input
          label="Producto"
          value={form.producto}
          onChange={(e) => handleChange('producto', e.target.value)}
          placeholder="Qué producto suministra"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="300 123 4567"
          />
          <Input
            label="Días de pedido"
            value={form.diasPedido}
            onChange={(e) => handleChange('diasPedido', e.target.value)}
            placeholder="Lunes y jueves"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Forma de pago"
            value={form.formaPago}
            onChange={(e) => handleChange('formaPago', e.target.value)}
            placeholder="Contraentrega, crédito..."
          />
          <Input
            label="Forma de entrega"
            value={form.formaEntrega}
            onChange={(e) => handleChange('formaEntrega', e.target.value)}
            placeholder="Domicilio, recogida..."
          />
        </div>
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
            {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear proveedor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
