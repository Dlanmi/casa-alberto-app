import { useState, useCallback } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, Package, GlassWater } from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useToast } from '@renderer/contexts/toast-context'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Modal } from '@renderer/components/ui/modal'
import { Badge } from '@renderer/components/ui/badge'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { Tabs } from '@renderer/components/ui/tabs'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PageLoader } from '@renderer/components/ui/spinner'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { formatCOP } from '@renderer/lib/format'
import { parseMoneyInput } from '@renderer/lib/parse-input'
import type {
  IpcResult,
  MuestraMarco,
  MuestraMarcoConProveedor,
  PrecioVidrio,
  Proveedor
} from '@shared/types'

type Props = {
  onBack: () => void
}

const TABS = [
  { key: 'marcos', label: 'Marcos' },
  { key: 'vidrios', label: 'Vidrios' },
  { key: 'paspartu-pintado', label: 'Paspartú pintado' },
  { key: 'paspartu-acrilico', label: 'Paspartú acrílico' },
  { key: 'retablos', label: 'Retablos' },
  { key: 'bastidores', label: 'Bastidores' },
  { key: 'tapas', label: 'Tapas' }
]

// ── Marco form data ──

type MarcoForm = {
  referencia: string
  colillaCm: string
  precioMetro: string
  costoMetroEstimado: string
  descripcion: string
  proveedorId: string
}

const EMPTY_MARCO_FORM: MarcoForm = {
  referencia: '',
  colillaCm: '',
  precioMetro: '',
  costoMetroEstimado: '',
  descripcion: '',
  proveedorId: ''
}

// ── Main component ──

export function ListasPrecios({ onBack }: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('marcos')

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-text">Listas de precios</h1>
          <p className="text-sm text-text-muted">Gestiona marcos, vidrios y listas por medida</p>
        </div>
      </div>

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
        ariaLabel="Listas de precios"
        idBase="listas-precios"
      />

      <div
        role="tabpanel"
        id={`listas-precios-panel-${activeTab}`}
        aria-labelledby={`listas-precios-tab-${activeTab}`}
      >
        {activeTab === 'marcos' && <TabMarcos />}
        {activeTab === 'vidrios' && <TabVidrios />}
        {activeTab === 'paspartu-pintado' && (
          <TabMedidaPrecio
            title="Paspartú pintado (cartón)"
            desc="Precios por medida exterior. El dueño corta el cartón y lo pinta a mano."
            listarFn={() => window.api.precios.listarPaspartuPintado()}
            crearFn={(data: unknown) => window.api.precios.crearPaspartuPintado(data)}
            editarFn={(id: number, data: { precio: number; costoEstimado?: number | null }) =>
              window.api.precios.actualizarPaspartuPintado(id, data)
            }
            eliminarFn={(id: number) => window.api.precios.eliminarPaspartuPintado(id)}
          />
        )}
        {activeTab === 'paspartu-acrilico' && (
          <TabMedidaPrecio
            title="Paspartú acrílico (MDF)"
            desc="Precios por medida exterior. MDF pintado, más resistente que el cartón."
            listarFn={() => window.api.precios.listarPaspartuAcrilico()}
            crearFn={(data: unknown) => window.api.precios.crearPaspartuAcrilico(data)}
            editarFn={(id: number, data: { precio: number; costoEstimado?: number | null }) =>
              window.api.precios.actualizarPaspartuAcrilico(id, data)
            }
            eliminarFn={(id: number) => window.api.precios.eliminarPaspartuAcrilico(id)}
          />
        )}
        {activeTab === 'retablos' && (
          <TabMedidaPrecio
            title="Retablos"
            desc="4 listones + tapa MDF. Precio por medida."
            listarFn={() => window.api.precios.listarRetablos()}
            crearFn={(data: unknown) => window.api.precios.crearRetablo(data)}
            editarFn={(id: number, data: { precio: number; costoEstimado?: number | null }) =>
              window.api.precios.actualizarRetablo(id, data)
            }
            eliminarFn={(id: number) => window.api.precios.eliminarRetablo(id)}
          />
        )}
        {activeTab === 'bastidores' && (
          <TabMedidaPrecio
            title="Bastidores"
            desc="Estructura de madera para lienzos. Precio por medida."
            listarFn={() => window.api.precios.listarBastidores()}
            crearFn={(data: unknown) => window.api.precios.crearBastidor(data)}
            editarFn={(id: number, data: { precio: number; costoEstimado?: number | null }) =>
              window.api.precios.actualizarBastidor(id, data)
            }
            eliminarFn={(id: number) => window.api.precios.eliminarBastidor(id)}
          />
        )}
        {activeTab === 'tapas' && (
          <TabMedidaPrecio
            title="Tapas portarretratos"
            desc="Tapas de reemplazo. Precio por medida."
            listarFn={() => window.api.precios.listarTapas()}
            crearFn={(data: unknown) => window.api.precios.crearTapa(data)}
            editarFn={(id: number, data: { precio: number; costoEstimado?: number | null }) =>
              window.api.precios.actualizarTapa(id, data)
            }
            eliminarFn={(id: number) => window.api.precios.eliminarTapa(id)}
          />
        )}
      </div>
    </div>
  )
}

// ── Marcos tab ──

function TabMarcos(): React.JSX.Element {
  const { showToast } = useToast()
  const {
    data: marcos,
    loading,
    refetch
  } = useIpc<MuestraMarcoConProveedor[]>(() => window.api.cotizador.listarMuestrasMarcos(), [])

  // Proveedores tipo 'marco' para el selector del modal.
  const { data: proveedoresMarco } = useIpc<Proveedor[]>(
    () => window.api.proveedores.listar({ soloActivos: true, tipo: 'marco' }),
    []
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMarco, setEditingMarco] = useState<MuestraMarcoConProveedor | null>(null)
  const [form, setForm] = useState<MarcoForm>(EMPTY_MARCO_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof MarcoForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<MuestraMarcoConProveedor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openCreate = useCallback(() => {
    setEditingMarco(null)
    setForm(EMPTY_MARCO_FORM)
    setErrors({})
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((marco: MuestraMarcoConProveedor) => {
    setEditingMarco(marco)
    setForm({
      referencia: marco.referencia,
      colillaCm: String(marco.colillaCm),
      precioMetro: String(marco.precioMetro),
      costoMetroEstimado: marco.costoMetroEstimado != null ? String(marco.costoMetroEstimado) : '',
      descripcion: marco.descripcion ?? '',
      proveedorId: marco.proveedorId ? String(marco.proveedorId) : ''
    })
    setErrors({})
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingMarco(null)
  }, [])

  function validate(): boolean {
    const errs: Partial<Record<keyof MarcoForm, string>> = {}
    if (!form.referencia.trim()) errs.referencia = 'Requerido'
    const colilla = Number(form.colillaCm)
    if (!form.colillaCm || isNaN(colilla) || colilla <= 0) errs.colillaCm = 'Debe ser mayor a 0'
    const precio = parseMoneyInput(form.precioMetro)
    if (!form.precioMetro || precio <= 0) errs.precioMetro = 'Debe ser mayor a 0'
    const costo = parseMoneyInput(form.costoMetroEstimado)
    if (form.costoMetroEstimado.trim() && costo < 0) errs.costoMetroEstimado = 'No puede ser negativo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(): Promise<void> {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        referencia: form.referencia.trim(),
        colillaCm: Number(form.colillaCm),
        precioMetro: parseMoneyInput(form.precioMetro),
        costoMetroEstimado: form.costoMetroEstimado.trim()
          ? parseMoneyInput(form.costoMetroEstimado)
          : null,
        descripcion: form.descripcion.trim() || null,
        proveedorId: form.proveedorId ? Number(form.proveedorId) : null
      }

      if (editingMarco) {
        const res = (await window.api.cotizador.actualizarMuestraMarco(
          editingMarco.id,
          payload
        )) as IpcResult<MuestraMarco>
        if (res.ok) {
          showToast('success', `Marco ${payload.referencia} actualizado`)
          closeModal()
          refetch()
        } else {
          showToast('error', res.error)
        }
      } else {
        const res = (await window.api.cotizador.crearMuestraMarco(
          payload
        )) as IpcResult<MuestraMarco>
        if (res.ok) {
          showToast('success', `Marco ${payload.referencia} creado`)
          closeModal()
          refetch()
        } else {
          showToast('error', res.error)
        }
      }
    } catch {
      showToast('error', 'Error al guardar marco')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = (await window.api.cotizador.desactivarMuestraMarco(
        deleteTarget.id
      )) as IpcResult<MuestraMarco>
      if (res.ok) {
        showToast('success', `Marco ${deleteTarget.referencia} eliminado`)
        setDeleteTarget(null)
        refetch()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al eliminar marco')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageLoader />

  if (!marcos || marcos.length === 0) {
    return (
      <>
        <EmptyState
          icon={Package}
          title="No hay marcos"
          description="Agrega el primer marco para empezar a cotizar"
          actionLabel="Nuevo marco"
          onAction={openCreate}
        />
        <MarcoModal
          open={modalOpen}
          onClose={closeModal}
          form={form}
          setForm={setForm}
          errors={errors}
          saving={saving}
          onSave={handleSave}
          isEditing={!!editingMarco}
          proveedores={proveedoresMarco ?? []}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-muted">{marcos.length} marcos</p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={16} />
          Nuevo marco
        </Button>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>Referencia</Th>
            <Th>Proveedor</Th>
            <Th>Colilla (cm)</Th>
            <Th>Precio/m</Th>
            <Th>Costo/m</Th>
            <Th>Descripcion</Th>
            <Th className="text-right">Acciones</Th>
          </Tr>
        </Thead>
        <Tbody>
          {marcos.map((marco) => (
            <Tr key={marco.id}>
              <Td className="font-medium">{marco.referencia}</Td>
              <Td>
                {marco.proveedorNombre ? (
                  <Badge color={marco.proveedorActivo === false ? 'neutral' : 'info'} size="sm">
                    {marco.proveedorNombre}
                    {marco.proveedorActivo === false && ' (inactivo)'}
                  </Badge>
                ) : (
                  <span className="text-text-muted text-xs">Sin proveedor</span>
                )}
              </Td>
              <Td>{marco.colillaCm}</Td>
              <Td className="tabular-nums">{formatCOP(marco.precioMetro)}</Td>
              <Td className="tabular-nums text-text-muted">
                {marco.costoMetroEstimado != null ? formatCOP(marco.costoMetroEstimado) : '—'}
              </Td>
              <Td className="text-text-muted max-w-50 truncate">{marco.descripcion || '-'}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(marco)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(marco)}>
                    <Trash2 size={14} className="text-error" />
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <MarcoModal
        open={modalOpen}
        onClose={closeModal}
        form={form}
        setForm={setForm}
        errors={errors}
        saving={saving}
        onSave={handleSave}
        isEditing={!!editingMarco}
        proveedores={proveedoresMarco ?? []}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar marco"
        message={`Eliminar marco ${deleteTarget?.referencia}?`}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  )
}

// ── Marco modal ──

type MarcoModalProps = {
  open: boolean
  onClose: () => void
  form: MarcoForm
  setForm: (form: MarcoForm) => void
  errors: Partial<Record<keyof MarcoForm, string>>
  saving: boolean
  onSave: () => void
  isEditing: boolean
  proveedores: Proveedor[]
}

function MarcoModal({
  open,
  onClose,
  form,
  setForm,
  errors,
  saving,
  onSave,
  isEditing,
  proveedores
}: MarcoModalProps): React.JSX.Element {
  function update(field: keyof MarcoForm, value: string): void {
    setForm({ ...form, [field]: value })
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar marco' : 'Nuevo marco'}>
      <div className="flex flex-col gap-4">
        <Input
          label="Referencia"
          value={form.referencia}
          onChange={(e) => update('referencia', e.target.value)}
          error={errors.referencia}
          placeholder="Ej: M-001"
        />
        <Select
          label="Proveedor"
          value={form.proveedorId}
          onChange={(e) => update('proveedorId', e.target.value)}
          options={[
            { value: '', label: 'Sin proveedor' },
            ...proveedores.map((p) => ({ value: String(p.id), label: p.nombre }))
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Colilla (cm)"
            type="number"
            min={0}
            step="0.1"
            value={form.colillaCm}
            onChange={(e) => update('colillaCm', e.target.value)}
            error={errors.colillaCm}
            placeholder="Ej: 3.5"
          />
          <Input
            label="Precio por metro"
            type="text"
            inputMode="decimal"
            min={0}
            value={form.precioMetro}
            onChange={(e) => update('precioMetro', e.target.value)}
            error={errors.precioMetro}
            placeholder="Ej: 12.000"
          />
        </div>
        <Input
          label="Costo estimado por metro (opcional)"
          type="text"
          inputMode="decimal"
          min={0}
          value={form.costoMetroEstimado}
          onChange={(e) => update('costoMetroEstimado', e.target.value)}
          error={errors.costoMetroEstimado}
          placeholder="Ej: 8.500"
        />
        <Input
          label="Descripcion (opcional)"
          value={form.descripcion}
          onChange={(e) => update('descripcion', e.target.value)}
          placeholder="Ej: Dorado liso"
        />
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear marco'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Vidrios tab ──

type VidrioForm = {
  nombre: string
  espesorMm: string
  precioM2: string
  costoM2Estimado: string
}

const EMPTY_VIDRIO_FORM: VidrioForm = {
  nombre: '',
  espesorMm: '2',
  precioM2: '',
  costoM2Estimado: ''
}

function TabVidrios(): React.JSX.Element {
  const { showToast } = useToast()
  const {
    data: vidrios,
    loading,
    refetch
  } = useIpc<PrecioVidrio[]>(() => window.api.cotizador.listarPreciosVidrio(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingVidrio, setEditingVidrio] = useState<PrecioVidrio | null>(null)
  const [form, setForm] = useState<VidrioForm>(EMPTY_VIDRIO_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof VidrioForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PrecioVidrio | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate(): void {
    setEditingVidrio(null)
    setForm(EMPTY_VIDRIO_FORM)
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(vidrio: PrecioVidrio): void {
    setEditingVidrio(vidrio)
    setForm({
      nombre: vidrio.nombre,
      espesorMm: String(vidrio.espesorMm),
      precioM2: String(vidrio.precioM2),
      costoM2Estimado: vidrio.costoM2Estimado != null ? String(vidrio.costoM2Estimado) : ''
    })
    setErrors({})
    setModalOpen(true)
  }

  function closeModal(): void {
    setModalOpen(false)
    setEditingVidrio(null)
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof VidrioForm, string>> = {}
    if (!form.nombre.trim()) nextErrors.nombre = 'Requerido'
    const espesor = Number(form.espesorMm)
    if (!form.espesorMm.trim() || !Number.isFinite(espesor) || espesor <= 0) {
      nextErrors.espesorMm = 'Debe ser mayor a 0'
    }
    const precio = parseMoneyInput(form.precioM2)
    if (!form.precioM2.trim() || precio <= 0) nextErrors.precioM2 = 'Debe ser mayor a 0'
    const costo = parseMoneyInput(form.costoM2Estimado)
    if (form.costoM2Estimado.trim() && costo < 0) nextErrors.costoM2Estimado = 'No puede ser negativo'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSave(): Promise<void> {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        espesorMm: Number(form.espesorMm),
        precioM2: parseMoneyInput(form.precioM2),
        costoM2Estimado: form.costoM2Estimado.trim() ? parseMoneyInput(form.costoM2Estimado) : null
      }
      const res = editingVidrio
        ? ((await window.api.cotizador.actualizarPrecioVidrio(
            editingVidrio.id,
            payload
          )) as IpcResult<PrecioVidrio>)
        : ((await window.api.cotizador.crearPrecioVidrio(payload)) as IpcResult<PrecioVidrio>)
      if (res.ok) {
        showToast('success', editingVidrio ? 'Vidrio actualizado' : `Vidrio "${payload.nombre}" agregado`)
        closeModal()
        refetch()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al guardar vidrio')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = (await window.api.cotizador.eliminarPrecioVidrio(
        deleteTarget.id
      )) as IpcResult<PrecioVidrio>
      if (res.ok) {
        showToast('success', `Vidrio "${deleteTarget.nombre}" eliminado`)
        setDeleteTarget(null)
        refetch()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al eliminar vidrio')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageLoader />

  const tieneVidrios = vidrios && vidrios.length > 0

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-muted">
          {tieneVidrios ? `${vidrios.length} tipos de vidrio` : 'Sin vidrios configurados'}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Agregar tipo
        </Button>
      </div>

      {!tieneVidrios ? (
        <EmptyState
          icon={GlassWater}
          title="No hay vidrios configurados"
          description="Agrega el primer vidrio con nombre comercial, espesor y costos estimados."
          actionLabel="Agregar tipo"
          onAction={openCreate}
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Vidrio</Th>
              <Th>Espesor</Th>
              <Th>Precio/m2</Th>
              <Th>Costo/m2</Th>
              <Th className="text-right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {vidrios.map((vidrio) => (
              <Tr key={vidrio.id}>
                <Td className="font-medium">{vidrio.nombre}</Td>
                <Td className="tabular-nums">{vidrio.espesorMm} mm</Td>
                <Td className="tabular-nums">{formatCOP(vidrio.precioM2)}</Td>
                <Td className="tabular-nums text-text-muted">
                  {vidrio.costoM2Estimado != null ? formatCOP(vidrio.costoM2Estimado) : '—'}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(vidrio)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(vidrio)}>
                      <Trash2 size={14} className="text-error" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {modalOpen && (
        <Modal open onClose={closeModal} title={editingVidrio ? 'Editar vidrio' : 'Nuevo vidrio'} size="sm">
          <div className="space-y-4">
            <Input
              label="Nombre visible"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              error={errors.nombre}
              placeholder="Ej: Vidrio claro"
              autoFocus
            />
            <Input
              label="Espesor (mm)"
              type="number"
              min="1"
              step="0.5"
              value={form.espesorMm}
              onChange={(e) => setForm((prev) => ({ ...prev, espesorMm: e.target.value }))}
              error={errors.espesorMm}
              placeholder="Ej: 3"
            />
            <Input
              label="Precio por m2"
              type="text"
              inputMode="decimal"
              min="0"
              value={form.precioM2}
              onChange={(e) => setForm((prev) => ({ ...prev, precioM2: e.target.value }))}
              error={errors.precioM2}
              placeholder="Ej: 120.000"
            />
            <Input
              label="Costo estimado por m2 (opcional)"
              type="text"
              inputMode="decimal"
              min="0"
              value={form.costoM2Estimado}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, costoM2Estimado: e.target.value }))
              }
              error={errors.costoM2Estimado}
              placeholder="Ej: 70.000"
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : editingVidrio ? 'Guardar cambios' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar tipo de vidrio?"
        message={`Se eliminará "${deleteTarget?.nombre ?? ''}" de la lista. No afecta pedidos existentes.`}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Generic Tab: Medida × Precio (paspartú, retablos, bastidores, tapas) */
/* ------------------------------------------------------------------ */

type MedidaItem = {
  id: number
  anchoCm: number
  altoCm: number
  precio: number
  costoEstimado: number | null
}

function TabMedidaPrecio({
  title,
  desc,
  listarFn,
  crearFn,
  editarFn,
  eliminarFn
}: {
  title: string
  desc: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listarFn: () => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  crearFn: (data: unknown) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editarFn: (id: number, data: { precio: number; costoEstimado?: number | null }) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eliminarFn: (id: number) => Promise<any>
}): React.JSX.Element {
  const { showToast } = useToast()
  const { data: items, loading, refetch } = useIpc<MedidaItem[]>(listarFn, [])
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ anchoCm: '', altoCm: '', precio: '', costoEstimado: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editCosto, setEditCosto] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  function startEdit(item: MedidaItem): void {
    setEditingId(item.id)
    setEditValue(String(item.precio))
    setEditCosto(item.costoEstimado != null ? String(item.costoEstimado) : '')
    setEditError('')
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditValue('')
    setEditCosto('')
    setEditError('')
  }

  async function saveEdit(id: number): Promise<void> {
    const precio = parseMoneyInput(editValue)
    if (!editValue.trim() || precio <= 0) {
      setEditError('Debe ser un número válido mayor a 0')
      return
    }
    const costoEstimado = editCosto.trim() ? parseMoneyInput(editCosto) : null
    setSavingEdit(true)
    try {
      const res = (await editarFn(id, { precio, costoEstimado })) as IpcResult<MedidaItem>
      if (res.ok) {
        showToast('success', 'Precio actualizado')
        cancelEdit()
        refetch()
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al actualizar precio')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const ancho = parseFloat(form.anchoCm)
    const alto = parseFloat(form.altoCm)
    const precio = parseMoneyInput(form.precio)
    const costoEstimado = form.costoEstimado.trim() ? parseMoneyInput(form.costoEstimado) : null
    if (!ancho || !alto || !precio) return
    setSaving(true)
    try {
      const res = (await crearFn({ anchoCm: ancho, altoCm: alto, precio, costoEstimado })) as IpcResult<MedidaItem>
      if (res.ok) {
        showToast('success', 'Precio agregado')
        setShowCreate(false)
        setForm({ anchoCm: '', altoCm: '', precio: '', costoEstimado: '' })
        refetch()
      } else {
        showToast('error', res.error)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (deleteId === null) return
    const res = (await eliminarFn(deleteId)) as IpcResult<MedidaItem>
    if (res.ok) {
      showToast('success', 'Precio eliminado')
      refetch()
    } else {
      showToast('error', res.error)
    }
    setDeleteId(null)
  }

  if (loading) return <PageLoader />

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          Agregar precio
        </Button>
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin precios registrados"
          description="Agrega precios por medida para poder cotizar este tipo de trabajo."
          actionLabel="Agregar precio"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Ancho (cm)</Th>
              <Th>Alto (cm)</Th>
              <Th className="text-right">Precio</Th>
              <Th className="text-right">Costo est.</Th>
              <Th className="w-32 text-right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
              <Tr key={item.id}>
                <Td className="tabular-nums">{item.anchoCm}</Td>
                <Td className="tabular-nums">{item.altoCm}</Td>
                <Td className="text-right">
                  {editingId === item.id ? (
                    <div className="grid gap-2 justify-end">
                      <div className="max-w-40">
                        <Input
                          type="text"
                          inputMode="decimal"
                          min={0}
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value)
                            setEditError('')
                          }}
                          error={editError}
                          className="h-10"
                        />
                      </div>
                      <div className="max-w-40">
                        <Input
                          type="text"
                          inputMode="decimal"
                          min={0}
                          value={editCosto}
                          onChange={(e) => setEditCosto(e.target.value)}
                          className="h-10"
                          placeholder="Costo"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="tabular-nums font-medium">{formatCOP(item.precio)}</span>
                  )}
                </Td>
                <Td className="text-right tabular-nums text-text-muted">
                  {editingId === item.id ? null : item.costoEstimado != null ? formatCOP(item.costoEstimado) : '—'}
                </Td>
                <Td>
                  {editingId === item.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(item.id)} disabled={savingEdit}>
                        {savingEdit ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                        <Pencil size={14} />
                      </Button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-text-soft hover:text-error cursor-pointer p-1"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {showCreate && (
        <Modal
          open
          onClose={() => setShowCreate(false)}
          title={`Nuevo precio — ${title}`}
          size="sm"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ancho (cm)"
                type="number"
                min="1"
                step="1"
                value={form.anchoCm}
                onChange={(e) => setForm((p) => ({ ...p, anchoCm: e.target.value }))}
                placeholder="Ej: 30"
                required
              />
              <Input
                label="Alto (cm)"
                type="number"
                min="1"
                step="1"
                value={form.altoCm}
                onChange={(e) => setForm((p) => ({ ...p, altoCm: e.target.value }))}
                placeholder="Ej: 40"
                required
              />
            </div>
            <Input
              label="Precio"
              type="text"
              inputMode="decimal"
              min="1"
              value={form.precio}
              onChange={(e) => setForm((p) => ({ ...p, precio: e.target.value }))}
              placeholder="Ej: 25.000"
              required
            />
            <Input
              label="Costo estimado (opcional)"
              type="text"
              inputMode="decimal"
              min="0"
              value={form.costoEstimado}
              onChange={(e) => setForm((p) => ({ ...p, costoEstimado: e.target.value }))}
              placeholder="Ej: 15.000"
            />
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar precio?"
        message="Este precio se eliminara de la lista. Los pedidos existentes no se afectan."
        confirmLabel="Eliminar"
        danger
      />
    </>
  )
}
