import { useState, useCallback } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, Package, GlassWater } from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useToast } from '@renderer/contexts/toast-context'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Modal } from '@renderer/components/ui/modal'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { Tabs } from '@renderer/components/ui/tabs'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PageLoader } from '@renderer/components/ui/spinner'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { formatCOP } from '@renderer/lib/format'
import type { IpcResult, MuestraMarco, PrecioVidrio } from '@shared/types'

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
  descripcion: string
}

const EMPTY_MARCO_FORM: MarcoForm = {
  referencia: '',
  colillaCm: '',
  precioMetro: '',
  descripcion: ''
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
            eliminarFn={(id: number) => window.api.precios.eliminarPaspartuPintado(id)}
          />
        )}
        {activeTab === 'paspartu-acrilico' && (
          <TabMedidaPrecio
            title="Paspartú acrílico (MDF)"
            desc="Precios por medida exterior. MDF pintado, más resistente que el cartón."
            listarFn={() => window.api.precios.listarPaspartuAcrilico()}
            crearFn={(data: unknown) => window.api.precios.crearPaspartuAcrilico(data)}
            eliminarFn={(id: number) => window.api.precios.eliminarPaspartuAcrilico(id)}
          />
        )}
        {activeTab === 'retablos' && (
          <TabMedidaPrecio
            title="Retablos"
            desc="4 listones + tapa MDF. Precio por medida."
            listarFn={() => window.api.precios.listarRetablos()}
            crearFn={(data: unknown) => window.api.precios.crearRetablo(data)}
            eliminarFn={(id: number) => window.api.precios.eliminarRetablo(id)}
          />
        )}
        {activeTab === 'bastidores' && (
          <TabMedidaPrecio
            title="Bastidores"
            desc="Estructura de madera para lienzos. Precio por medida."
            listarFn={() => window.api.precios.listarBastidores()}
            crearFn={(data: unknown) => window.api.precios.crearBastidor(data)}
            eliminarFn={(id: number) => window.api.precios.eliminarBastidor(id)}
          />
        )}
        {activeTab === 'tapas' && (
          <TabMedidaPrecio
            title="Tapas portarretratos"
            desc="Tapas de reemplazo. Precio por medida."
            listarFn={() => window.api.precios.listarTapas()}
            crearFn={(data: unknown) => window.api.precios.crearTapa(data)}
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
  } = useIpc<MuestraMarco[]>(() => window.api.cotizador.listarMuestrasMarcos(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMarco, setEditingMarco] = useState<MuestraMarco | null>(null)
  const [form, setForm] = useState<MarcoForm>(EMPTY_MARCO_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof MarcoForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<MuestraMarco | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openCreate = useCallback(() => {
    setEditingMarco(null)
    setForm(EMPTY_MARCO_FORM)
    setErrors({})
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((marco: MuestraMarco) => {
    setEditingMarco(marco)
    setForm({
      referencia: marco.referencia,
      colillaCm: String(marco.colillaCm),
      precioMetro: String(marco.precioMetro),
      descripcion: marco.descripcion ?? ''
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
    const precio = Number(form.precioMetro)
    if (!form.precioMetro || isNaN(precio) || precio <= 0) errs.precioMetro = 'Debe ser mayor a 0'
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
        precioMetro: Number(form.precioMetro),
        descripcion: form.descripcion.trim() || null
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
            <Th>Colilla (cm)</Th>
            <Th>Precio/m</Th>
            <Th>Descripcion</Th>
            <Th className="text-right">Acciones</Th>
          </Tr>
        </Thead>
        <Tbody>
          {marcos.map((marco) => (
            <Tr key={marco.id}>
              <Td className="font-medium">{marco.referencia}</Td>
              <Td>{marco.colillaCm}</Td>
              <Td className="tabular-nums">{formatCOP(marco.precioMetro)}</Td>
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
}

function MarcoModal({
  open,
  onClose,
  form,
  setForm,
  errors,
  saving,
  onSave,
  isEditing
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
            type="number"
            min={0}
            step="100"
            value={form.precioMetro}
            onChange={(e) => update('precioMetro', e.target.value)}
            error={errors.precioMetro}
            placeholder="Ej: 12000"
          />
        </div>
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

function TabVidrios(): React.JSX.Element {
  const { showToast } = useToast()
  const {
    data: vidrios,
    loading,
    refetch
  } = useIpc<PrecioVidrio[]>(() => window.api.cotizador.listarPreciosVidrio(), [])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(vidrio: PrecioVidrio): void {
    setEditingId(vidrio.id)
    setEditValue(String(vidrio.precioM2))
    setEditError('')
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditValue('')
    setEditError('')
  }

  async function saveEdit(id: number): Promise<void> {
    const precio = Number(editValue)
    if (isNaN(precio) || precio < 0) {
      setEditError('Debe ser un numero valido >= 0')
      return
    }
    setSaving(true)
    try {
      const res = (await window.api.cotizador.actualizarPrecioVidrio(
        id,
        precio
      )) as IpcResult<PrecioVidrio>
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
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  if (!vidrios || vidrios.length === 0) {
    return (
      <EmptyState
        icon={GlassWater}
        title="No hay vidrios configurados"
        description="Los precios de vidrio se cargan con los datos iniciales"
      />
    )
  }

  return (
    <>
      <p className="text-sm text-text-muted mb-4">{vidrios.length} tipos de vidrio</p>

      <Table>
        <Thead>
          <Tr>
            <Th>Tipo</Th>
            <Th>Precio/m2</Th>
            <Th className="text-right">Acciones</Th>
          </Tr>
        </Thead>
        <Tbody>
          {vidrios.map((vidrio) => (
            <Tr key={vidrio.id}>
              <Td className="font-medium capitalize">{vidrio.tipo.replace(/_/g, ' ')}</Td>
              <Td>
                {editingId === vidrio.id ? (
                  <div className="flex items-center gap-2 max-w-50">
                    <Input
                      type="number"
                      min={0}
                      step="100"
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value)
                        setEditError('')
                      }}
                      error={editError}
                      className="h-10"
                    />
                  </div>
                ) : (
                  <span className="tabular-nums">{formatCOP(vidrio.precioM2)}</span>
                )}
              </Td>
              <Td className="text-right">
                {editingId === vidrio.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(vidrio.id)} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => startEdit(vidrio)}>
                    <Pencil size={14} />
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Generic Tab: Medida × Precio (paspartú, retablos, bastidores, tapas) */
/* ------------------------------------------------------------------ */

type MedidaItem = { id: number; anchoCm: number; altoCm: number; precio: number }

function TabMedidaPrecio({
  title,
  desc,
  listarFn,
  crearFn,
  eliminarFn
}: {
  title: string
  desc: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listarFn: () => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  crearFn: (data: unknown) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eliminarFn: (id: number) => Promise<any>
}): React.JSX.Element {
  const { showToast } = useToast()
  const { data: items, loading, refetch } = useIpc<MedidaItem[]>(listarFn, [])
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ anchoCm: '', altoCm: '', precio: '' })
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const ancho = parseFloat(form.anchoCm)
    const alto = parseFloat(form.altoCm)
    const precio = parseFloat(form.precio)
    if (!ancho || !alto || !precio) return
    setSaving(true)
    try {
      const res = (await crearFn({ anchoCm: ancho, altoCm: alto, precio })) as IpcResult<MedidaItem>
      if (res.ok) {
        showToast('success', 'Precio agregado')
        setShowCreate(false)
        setForm({ anchoCm: '', altoCm: '', precio: '' })
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
              <Th className="w-20"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
              <Tr key={item.id}>
                <Td className="tabular-nums">{item.anchoCm}</Td>
                <Td className="tabular-nums">{item.altoCm}</Td>
                <Td className="text-right tabular-nums font-medium">{formatCOP(item.precio)}</Td>
                <Td>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="text-text-soft hover:text-error cursor-pointer p-1"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
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
              type="number"
              min="1"
              value={form.precio}
              onChange={(e) => setForm((p) => ({ ...p, precio: e.target.value }))}
              placeholder="Ej: 25000"
              required
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
