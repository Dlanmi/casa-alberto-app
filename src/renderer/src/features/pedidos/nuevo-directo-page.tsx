// Página `/pedidos/nuevo-directo` — feature "Pedido directo".
//
// Permite registrar un pedido completo (cliente + items + factura + abono
// opcional + PDF opcional) en una sola pantalla, sin pasar por el wizard
// del cotizador. Casos de uso:
//   - Pedido rápido cuando ya se sabe el precio.
//   - Registro retroactivo de pedidos pasados (estado `entregado` directo,
//     fechas en el pasado).
//   - Precios "históricos" que no calzan con la lista actual (sin que se
//     consideren descuento — decisión P16/B).
//
// Layout: 5 secciones visibles a la vez, scroll vertical. Form simple con
// useState — preferimos legibilidad sobre useReducer en este tamaño.
import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, AlertCircle, FileText } from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Modal } from '@renderer/components/ui/modal'
import { Spinner } from '@renderer/components/ui/spinner'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { useToast } from '@renderer/contexts/toast-context'
import { formatCOP, hoyISO, toFechaISO } from '@renderer/lib/format'
import { formatPrimaryShortcut } from '@renderer/lib/shortcuts'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { cn } from '@renderer/lib/cn'
import { conceptoIcon } from '@renderer/lib/iconography'
import {
  MoneyField,
  NumberField,
  TextField
} from '@renderer/components/shared/form-fields'
import {
  ESTADO_PEDIDO_LABEL,
  TIPO_ENTREGA_LABEL,
  TIPO_TRABAJO_LABEL
} from '@renderer/lib/constants'
import {
  METODOS_PAGO,
  TIPOS_ENTREGA,
  TIPOS_TRABAJO,
  type Cliente,
  type CrearPedidoDirectoInput,
  type ItemPedidoDirecto,
  type EstadoPedido,
  type MetodoPago,
  type TipoEntrega,
  type TipoItemPedido,
  type TipoTrabajo
} from '@shared/types'

// ---------------------------------------------------------------------------
// Tipos del form (estado local; se traduce a CrearPedidoDirectoInput al submit)
// ---------------------------------------------------------------------------

type ItemForm = {
  // ID local solo para React key — no se envía al backend.
  uid: string
  tipoItem: TipoItemPedido | 'otro'
  descripcion: string
  referencia: string
  cantidad: number
  precioUnitario: number
  costoUnitarioEstimado: number | null
}

// Estados que el dueño puede elegir como inicial. Excluimos 'cancelado' y
// 'sin_reclamar' (no tiene sentido crear directamente en esos estados).
const ESTADOS_INICIALES: EstadoPedido[] = [
  'cotizado',
  'confirmado',
  'en_proceso',
  'listo',
  'entregado'
]

const TIPOS_ITEM_VISIBLES: Array<{ key: TipoItemPedido | 'otro'; label: string }> = [
  { key: 'marco', label: 'Marco' },
  { key: 'vidrio', label: 'Vidrio' },
  { key: 'paspartu_pintado', label: 'Paspartú pintado' },
  { key: 'paspartu_acrilico', label: 'Paspartú acrílico' },
  { key: 'acolchado', label: 'Acolchado' },
  { key: 'adherido', label: 'Adherido' },
  { key: 'retablo', label: 'Retablo' },
  { key: 'bastidor', label: 'Bastidor' },
  { key: 'tapa', label: 'Tapa' },
  { key: 'restauracion', label: 'Restauración' },
  { key: 'instalacion', label: 'Instalación' },
  { key: 'materiales_adicionales', label: 'Materiales' },
  { key: 'otro', label: 'Otro / Personalizado' }
]

// Genera UID local para keys de items en la lista.
let __uidCounter = 0
function nextUid(): string {
  __uidCounter += 1
  return `item-${__uidCounter}`
}

function nuevoItemVacio(): ItemForm {
  return {
    uid: nextUid(),
    tipoItem: 'otro',
    descripcion: '',
    referencia: '',
    cantidad: 1,
    precioUnitario: 0,
    costoUnitarioEstimado: null
  }
}

// Días sugeridos desde hoy para auto-fecha de entrega según tipo de entrega.
// El dueño puede sobreescribir el valor — son solo defaults inteligentes.
const DIAS_SUGERIDOS_ENTREGA: Record<TipoEntrega, number> = {
  urgente: 3,
  estandar: 7,
  sin_afan: 14
}

function sugerirFechaEntrega(tipoEntrega: TipoEntrega, fechaIngreso: string): string {
  const base = new Date(`${fechaIngreso}T12:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + DIAS_SUGERIDOS_ENTREGA[tipoEntrega])
  return toFechaISO(base)
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function NuevoPedidoDirectoPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // --- Estado del form ---
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [tipoTrabajo, setTipoTrabajo] = useState<TipoTrabajo>('enmarcacion_estandar')
  const [descripcion, setDescripcion] = useState('')
  const [anchoCm, setAnchoCm] = useState<number | null>(null)
  const [altoCm, setAltoCm] = useState<number | null>(null)
  const [fechaIngreso, setFechaIngreso] = useState(hoyISO())
  // `fechaEntregaEditada` es la fecha que el dueño escribió a mano. Si es
  // null, mostramos la sugerencia derivada de tipoEntrega + fechaIngreso.
  // Esta forma evita el patrón setState-en-effect (la sugerencia se computa
  // durante el render, no se sincroniza vía useEffect).
  const [fechaEntregaEditada, setFechaEntregaEditada] = useState<string | null>(null)
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('estandar')
  const fechaEntrega = fechaEntregaEditada ?? sugerirFechaEntrega(tipoEntrega, fechaIngreso)
  const fechaEntregaTocada = fechaEntregaEditada !== null
  const [estadoInicial, setEstadoInicial] = useState<EstadoPedido>('confirmado')
  const [notas, setNotas] = useState('')

  const [items, setItems] = useState<ItemForm[]>(() => [nuevoItemVacio()])

  // Override de total. Si null, se usa la suma. Si number, el override.
  const [precioTotalOverride, setPrecioTotalOverride] = useState<number | null>(null)

  // Bloque abono opcional
  const [conAbono, setConAbono] = useState(false)
  const [abonoMonto, setAbonoMonto] = useState<number>(0)
  const [abonoMetodo, setAbonoMetodo] = useState<MetodoPago>('efectivo')
  // Si el dueño NO edita esta fecha, espejea `fechaIngreso` automáticamente.
  // Caso retroactivo: registra abono histórico junto con el pedido viejo,
  // sin tener que tocar manualmente el campo de fecha. Coherente con el
  // patrón de `fechaEntrega`.
  const [abonoFechaEditada, setAbonoFechaEditada] = useState<string | null>(null)
  const abonoFecha = abonoFechaEditada ?? fechaIngreso

  // PDF
  const [generarPDF, setGenerarPDF] = useState(false)

  // Submit / errores
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Para dirty guard al cancelar
  const isDirty = useDirtyTracker({
    cliente,
    descripcion,
    items,
    abonoMonto: conAbono ? abonoMonto : 0,
    notas,
    precioTotalOverride
  })

  // --- Derivados ---
  const subtotalItems = useMemo(
    () => items.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0),
    [items]
  )
  const totalFinal = precioTotalOverride ?? subtotalItems
  const diferencia = subtotalItems > 0 && precioTotalOverride != null
    ? precioTotalOverride - subtotalItems
    : 0

  const itemsValidos = items.every(
    (it) => it.descripcion.trim().length > 0 && it.cantidad > 0 && it.precioUnitario >= 0
  )
  const formValido =
    cliente !== null &&
    items.length >= 1 &&
    itemsValidos &&
    totalFinal >= 0 &&
    (!conAbono || (abonoMonto > 0 && abonoMonto <= totalFinal))

  // --- Helpers items ---
  const addItem = useCallback(() => {
    setItems((prev) => [...prev, nuevoItemVacio()])
  }, [])

  const removeItem = useCallback((uid: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.uid !== uid)))
  }, [])

  const updateItem = useCallback((uid: string, patch: Partial<ItemForm>) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }, [])

  // --- Cancelar con guard ---
  const [confirmCancel, setConfirmCancel] = useState(false)
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setConfirmCancel(true)
    } else {
      navigate('/pedidos')
    }
  }, [isDirty, navigate])

  // --- Submit ---
  const handleSubmit = useCallback(async () => {
    if (!cliente) {
      setSubmitError('Debes seleccionar o crear un cliente')
      return
    }
    if (!itemsValidos) {
      setSubmitError('Revisa los items: descripción, cantidad y precio son requeridos')
      return
    }
    if (conAbono && (abonoMonto <= 0 || abonoMonto > totalFinal)) {
      setSubmitError('El abono debe ser mayor a 0 y menor o igual al total')
      return
    }

    setSubmitError(null)
    setSubmitting(true)

    const input: CrearPedidoDirectoInput = {
      cliente: { tipo: 'existente', id: cliente.id },
      pedido: {
        tipoTrabajo,
        descripcion: descripcion.trim() || null,
        anchoCm: anchoCm ?? null,
        altoCm: altoCm ?? null,
        fechaIngreso,
        fechaEntrega: fechaEntrega || null,
        tipoEntrega,
        estadoInicial,
        notas: notas.trim() || null
      },
      items: items.map<ItemPedidoDirecto>((it) => ({
        tipoItem: it.tipoItem,
        descripcion: it.descripcion.trim(),
        referencia: it.referencia.trim() || null,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        costoUnitarioEstimado: it.costoUnitarioEstimado
      })),
      precioTotalOverride: precioTotalOverride,
      factura: { fecha: fechaIngreso },
      abono: conAbono
        ? {
            monto: abonoMonto,
            metodoPago: abonoMetodo,
            fecha: abonoFecha
          }
        : null,
      generarPDF
    }

    // Tracker para evitar resetear submitting después de un navigate exitoso
    // (evita warning de "setState on unmounted component" si el dueño se va
    // de la página antes del cleanup de un timer).
    let navegado = false
    try {
      const res = await window.api.pedidos.crearDirecto(input)
      if (!res.ok) {
        setSubmitError(res.error)
        return
      }
      const { pedido, factura, pago, saldo } = res.data

      // PDF opcional. Si falla NO se hace rollback del pedido — solo se
      // muestra warning. Está envuelto en su propio try/catch dentro de
      // `generarYAbrirPDF` así que no propaga errores.
      if (generarPDF) {
        await generarYAbrirPDF({
          pedido,
          facturaNumero: factura.numero,
          facturaFecha: factura.fecha,
          cliente,
          pagos: pago ? [pago] : [],
          saldoFinal: saldo,
          showToast
        })
      }

      showToast({
        tone: 'success',
        title: `Pedido ${pedido.numero} creado`,
        message:
          conAbono && abonoMonto > 0
            ? `Saldo pendiente: ${formatCOP(saldo)}`
            : 'Pedido registrado correctamente.'
      })
      navigate(`/pedidos?focus=${pedido.numero}`)
      navegado = true
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Error inesperado al guardar el pedido'
      )
    } finally {
      // Garantizamos resetear `submitting` en TODOS los caminos: éxito,
      // res.ok=false, throw del IPC, o falla del PDF. Antes el spinner
      // quedaba infinito si algo después del IPC fallaba.
      if (!navegado) setSubmitting(false)
    }
  }, [
    cliente,
    itemsValidos,
    conAbono,
    abonoMonto,
    totalFinal,
    tipoTrabajo,
    descripcion,
    anchoCm,
    altoCm,
    fechaIngreso,
    fechaEntrega,
    tipoEntrega,
    estadoInicial,
    notas,
    items,
    precioTotalOverride,
    abonoMetodo,
    abonoFecha,
    generarPDF,
    navigate,
    showToast
  ])

  // Atajo Cmd/Ctrl+Enter para guardar — funciona desde cualquier input. Lo
  // ponemos DESPUÉS de definir handleSubmit para que el closure capture la
  // función correcta. Las dependencias del effect se actualizan junto con
  // handleSubmit, por lo que siempre llamamos la versión más reciente.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!formValido || submitting) return
        e.preventDefault()
        void handleSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSubmit, formValido, submitting])

  return (
    <OperationalBoard
      title={cliente ? `Nuevo pedido — ${cliente.nombre}` : 'Nuevo pedido directo'}
      subtitle="Registra un pedido sin pasar por el cotizador. Útil para precios fijos del momento o pedidos pasados."
      primaryAction={{
        label: submitting ? 'Guardando…' : 'Guardar pedido',
        onClick: () => void handleSubmit(),
        disabled: !formValido || submitting,
        tooltip: `Guardar pedido (${formatPrimaryShortcut('Enter')})`,
        icon: undefined
      }}
      secondaryActions={[
        {
          label: 'Cancelar',
          onClick: handleCancel,
          icon: ArrowLeft,
          variant: 'outline',
          disabled: submitting
        }
      ]}
    >
      <div className="space-y-6 max-w-4xl">
        {/* --------- 1. Cliente --------- */}
        <section
          aria-labelledby="seccion-cliente"
          className={cn(
            'rounded-lg border bg-surface p-5 space-y-3 transition-colors duration-base',
            cliente ? 'border-success/30 bg-success-bg/20' : 'border-border'
          )}
        >
          <h2
            id="seccion-cliente"
            className="text-base font-semibold text-text flex items-center gap-2"
          >
            Cliente
            {cliente && (
              <span className="text-xs font-normal text-success-strong" aria-hidden="true">
                ✓
              </span>
            )}
          </h2>
          <ClientePicker value={cliente} onChange={setCliente} />
          {!cliente && (
            <p className="text-xs text-text-muted">
              Busca un cliente existente o crea uno nuevo. Es obligatorio.
            </p>
          )}
        </section>

        {/* --------- 2. Datos del pedido --------- */}
        <section
          aria-labelledby="seccion-datos"
          className="rounded-lg border border-border bg-surface p-5 space-y-4"
        >
          <h2 id="seccion-datos" className="text-base font-semibold text-text">
            Datos del pedido
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de trabajo"
              value={tipoTrabajo}
              onChange={(e) => setTipoTrabajo(e.target.value as TipoTrabajo)}
              options={TIPOS_TRABAJO.map((t) => ({ value: t, label: TIPO_TRABAJO_LABEL[t] }))}
            />
            <Select
              label="Estado inicial"
              value={estadoInicial}
              onChange={(e) => setEstadoInicial(e.target.value as EstadoPedido)}
              options={ESTADOS_INICIALES.map((s) => ({
                value: s,
                label: ESTADO_PEDIDO_LABEL[s]
              }))}
            />
            <Input
              label="Fecha de ingreso"
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
            <Input
              label={
                fechaEntregaTocada
                  ? 'Fecha de entrega'
                  : `Fecha de entrega (sugerida +${DIAS_SUGERIDOS_ENTREGA[tipoEntrega]} días)`
              }
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntregaEditada(e.target.value)}
            />
            <Select
              label="Tipo de entrega"
              value={tipoEntrega}
              onChange={(e) => setTipoEntrega(e.target.value as TipoEntrega)}
              options={TIPOS_ENTREGA.map((t) => ({ value: t, label: TIPO_ENTREGA_LABEL[t] }))}
            />
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Ancho (opcional)"
                mode="decimal"
                value={anchoCm ?? 0}
                onChange={(n) => setAnchoCm(n > 0 ? n : null)}
                suffix="cm"
                placeholder="0"
                min={0}
                max={500}
              />
              <NumberField
                label="Alto (opcional)"
                mode="decimal"
                value={altoCm ?? 0}
                onChange={(n) => setAltoCm(n > 0 ? n : null)}
                suffix="cm"
                placeholder="0"
                min={0}
                max={500}
              />
            </div>
          </div>
          <TextField
            label="Descripción del trabajo (opcional)"
            value={descripcion}
            onChange={setDescripcion}
            placeholder="Ej: Marco rústico para foto de bautismo"
            maxLength={500}
            multiline
            rows={2}
          />
          <TextField
            label="Notas internas (opcional)"
            value={notas}
            onChange={setNotas}
            placeholder="Notas que solo tú ves"
            maxLength={500}
            multiline
            rows={2}
          />
        </section>

        {/* --------- 3. Items --------- */}
        <section
          aria-labelledby="seccion-items"
          className="rounded-lg border border-border bg-surface p-5 space-y-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 id="seccion-items" className="text-base font-semibold text-text">
              Items del pedido
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
            </h2>
            <Button variant="outline" onClick={addItem} type="button">
              <Plus size={16} />
              Agregar item
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <ItemRow
                key={item.uid}
                index={index}
                item={item}
                onUpdate={(patch) => updateItem(item.uid, patch)}
                onRemove={() => removeItem(item.uid)}
                canRemove={items.length > 1}
              />
            ))}
          </div>
        </section>

        {/* --------- 4. Total --------- */}
        <section
          aria-labelledby="seccion-total"
          className="rounded-lg border border-border bg-surface p-5 space-y-4"
        >
          <h2 id="seccion-total" className="text-base font-semibold text-text">
            Total
          </h2>

          {/* Suma de items — informativo, derivado de los items */}
          <div className="flex items-center justify-between text-sm border-b border-border pb-3">
            <span className="text-text-muted">Suma de items</span>
            <span className="tabular-nums text-text font-medium">
              {formatCOP(subtotalItems)}
            </span>
          </div>

          {/* Total final — bloque destacado con input integrado. El monto
              del input es lo que se va a cobrar al cliente y guardar como
              `precioTotal`. La etiqueta "Total final" arriba del input está
              integrada al bloque accent para reforzar visualmente que ESTE
              es el valor importante. */}
          <TotalFinalInput
            subtotalItems={subtotalItems}
            override={precioTotalOverride}
            onOverrideChange={setPrecioTotalOverride}
          />

          {diferencia !== 0 && (
            <GuidanceHint
              tone="info"
              title={
                diferencia < 0
                  ? `Estás cobrando ${formatCOP(Math.abs(diferencia))} menos que la suma de items`
                  : `Estás cobrando ${formatCOP(diferencia)} más que la suma de items`
              }
              message={
                'No se registra como descuento — esta diferencia se guarda como precio final del pedido (caso "precio histórico").'
              }
            />
          )}
        </section>

        {/* --------- 5. Pago inicial --------- */}
        <section className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer min-h-12">
            <input
              type="checkbox"
              checked={conAbono}
              onChange={(e) => setConAbono(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-base font-semibold text-text">Registrar abono ahora</span>
          </label>
          {conAbono && (
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <MoneyField
                label="Monto"
                value={abonoMonto}
                onChange={setAbonoMonto}
                max={totalFinal}
                placeholder="0"
              />
              <Select
                label="Método"
                value={abonoMetodo}
                onChange={(e) => setAbonoMetodo(e.target.value as MetodoPago)}
                options={METODOS_PAGO.map((m) => ({
                  value: m,
                  label:
                    m === 'efectivo'
                      ? 'Efectivo'
                      : m === 'transferencia'
                        ? 'Transferencia'
                        : m === 'tarjeta'
                          ? 'Tarjeta'
                          : 'Cheque'
                }))}
              />
              <Input
                label="Fecha del pago"
                type="date"
                value={abonoFecha}
                max={hoyISO()}
                onChange={(e) => setAbonoFechaEditada(e.target.value)}
              />
              {abonoMonto > totalFinal && totalFinal > 0 && (
                <div className="md:col-span-3 text-xs text-error-strong flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  El abono no puede ser mayor al total ({formatCOP(totalFinal)})
                </div>
              )}
            </div>
          )}
        </section>

        {/* --------- 6. PDF --------- */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <label className="flex items-center gap-3 cursor-pointer min-h-12">
            <input
              type="checkbox"
              checked={generarPDF}
              onChange={(e) => setGenerarPDF(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <FileText size={16} className="text-text-soft" />
            <span className="text-sm font-medium text-text">
              Generar PDF de la factura al guardar
            </span>
          </label>
        </section>

        {/* --------- Errores de submit --------- */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-error/30 bg-error-bg p-3 text-sm text-error-strong flex items-start gap-2 animate-fade-in-up"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        {/* aria-live polite para anunciar el subtotal a screen readers
            cuando el usuario edita items. Está visualmente oculto pero los
            lectores de pantalla lo leen. */}
        <div className="sr-only" aria-live="polite" role="status">
          Total final: {formatCOP(totalFinal)}
        </div>

        {/* Loading overlay sutil durante el submit — bloquea interacción y
            comunica que algo está pasando. */}
        {submitting && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Guardando pedido"
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/10 backdrop-blur-sm pointer-events-none"
          >
            <div className="bg-surface rounded-lg shadow-3 px-5 py-4 flex items-center gap-3">
              <Spinner size="sm" />
              <span className="text-sm font-medium text-text">Guardando pedido…</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirm cancel modal */}
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Descartar cambios"
        size="sm"
      >
        <p className="text-sm text-text">
          Tienes datos sin guardar. ¿Quieres salir y descartarlos?
        </p>
        <div className="flex gap-3 pt-4 justify-end">
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            Seguir editando
          </Button>
          <Button variant="primary" onClick={() => navigate('/pedidos')}>
            Descartar
          </Button>
        </div>
      </Modal>
    </OperationalBoard>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

type ItemRowProps = {
  index: number
  item: ItemForm
  onUpdate: (patch: Partial<ItemForm>) => void
  onRemove: () => void
  canRemove: boolean
}

// ---------------------------------------------------------------------------
// TotalFinalInput — input destacado para el precio total del pedido.
// El input vive dentro de un bloque accent que comunica visualmente que
// este es EL valor importante (lo que se cobra al cliente). Usa
// `useMoneyInput` para que al perder foco se vea con formato `$` + miles.
// ---------------------------------------------------------------------------

type TotalFinalInputProps = {
  subtotalItems: number
  override: number | null
  onOverrideChange: (n: number | null) => void
}

function TotalFinalInput({
  subtotalItems,
  override,
  onOverrideChange
}: TotalFinalInputProps): React.JSX.Element {
  // Si no hay override, mostramos la suma de items como valor "vivo" — al
  // momento que el usuario toque el input, ese mismo valor pasa a ser el
  // override (para que no se reinicie con cualquier change de items).
  const valorActivo = override ?? subtotalItems

  // El hook se encarga del formato visible (con $ y miles) al blur.
  const moneyInput = useMoneyInput(valorActivo, (n) => {
    onOverrideChange(n > 0 ? n : null)
  })

  const overrideActivo = override !== null

  return (
    <div className="rounded-md bg-accent/5 border border-accent/30 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="total-final-input"
          className="text-xs font-semibold uppercase tracking-wider text-accent-strong"
        >
          Total final
        </label>
        {overrideActivo && (
          <button
            type="button"
            onClick={() => onOverrideChange(null)}
            className="text-xs font-medium text-accent-strong/80 hover:text-accent underline cursor-pointer"
            title="Volver a la suma de items"
          >
            Restaurar suma
          </button>
        )}
      </div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-accent-strong/70 pointer-events-none"
        >
          $
        </span>
        <input
          id="total-final-input"
          type="text"
          inputMode="decimal"
          aria-label="Total final del pedido"
          value={moneyInput.raw.replace(/^\$\s*/, '')}
          onChange={moneyInput.handleChange}
          onBlur={moneyInput.handleBlur}
          placeholder="0"
          className={cn(
            'w-full h-11 pl-7 pr-3 rounded-md',
            'bg-surface border border-accent/30',
            'text-base font-semibold text-accent-strong tabular-nums',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'transition-colors duration-base'
          )}
        />
      </div>
      <p className="text-xs text-text-muted">
        {overrideActivo
          ? 'Precio personalizado — la diferencia con la suma NO se registra como descuento.'
          : 'Por defecto se cobra la suma de items. Edita para fijar un total distinto.'}
      </p>
    </div>
  )
}

function ItemRow({ index, item, onUpdate, onRemove, canRemove }: ItemRowProps): React.JSX.Element {
  const subtotal = item.cantidad * item.precioUnitario
  // `conceptoIcon` devuelve un componente de Lucide. Lo renderizamos vía
  // `createElement` para que React Compiler no lo trate como "componente
  // creado en render" (regla que prohíbe asignar componentes a variables
  // locales). El icono cambia con el tipoItem así que necesita ser dinámico.
  const iconoNode = createElement(
    conceptoIcon(item.tipoItem === 'otro' ? undefined : item.tipoItem),
    { size: 14, className: 'text-text-soft', 'aria-hidden': true }
  )
  // Validación inline: marca campos requeridos cuando se han tocado
  const [touched, setTouched] = useState({ descripcion: false, precio: false })
  const errDesc = touched.descripcion && !item.descripcion.trim()
  const errPrecio = touched.precio && (!Number.isFinite(item.precioUnitario) || item.precioUnitario < 0)
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface-muted/30 p-4 space-y-3',
        // Stagger sutil al montar — el delay se calcula con index para que
        // los items aparezcan en cascada cuando se cargan o agregan varios.
        'animate-fade-in-up relative'
      )}
      style={{ animationDelay: `calc(var(--stagger-base) * ${Math.min(index, 5)})` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
          {iconoNode}
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Eliminar item ${index + 1}`}
            className="text-text-soft hover:text-error transition-colors p-1 cursor-pointer min-w-12 min-h-12 flex items-center justify-center -mt-1 -mr-1"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-[200px_1fr]">
        <Select
          label="Tipo"
          value={item.tipoItem}
          onChange={(e) => onUpdate({ tipoItem: e.target.value as TipoItemPedido | 'otro' })}
          options={TIPOS_ITEM_VISIBLES.map((t) => ({ value: t.key, label: t.label }))}
        />
        <Input
          label="Descripción"
          value={item.descripcion}
          onChange={(e) => onUpdate({ descripcion: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, descripcion: true }))}
          placeholder={item.tipoItem === 'marco' ? 'Ej: Marco roble M-2003' : 'Descripción del item'}
          error={errDesc ? 'La descripción es requerida' : undefined}
          required
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <TextField
          label="Referencia (opcional)"
          value={item.referencia}
          onChange={(v) => onUpdate({ referencia: v })}
          maxLength={60}
        />
        <NumberField
          label="Cantidad"
          mode="decimal"
          value={item.cantidad}
          onChange={(n) => onUpdate({ cantidad: n })}
          min={0}
          max={9999}
        />
        <MoneyField
          label="Precio unitario"
          value={item.precioUnitario}
          onChange={(n) => onUpdate({ precioUnitario: n })}
          onBlur={() => setTouched((t) => ({ ...t, precio: true }))}
          placeholder="0"
          error={errPrecio ? 'Precio inválido' : undefined}
        />
        <MoneyField
          label="Costo estimado (opcional)"
          value={item.costoUnitarioEstimado ?? 0}
          onChange={(n) => onUpdate({ costoUnitarioEstimado: n > 0 ? n : null })}
          placeholder="Para calcular margen"
        />
      </div>
      <div className="flex items-center justify-end text-sm">
        <span className="text-text-muted mr-2">Subtotal:</span>
        <span className="font-semibold tabular-nums text-text">{formatCOP(subtotal)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook: dirty tracker para confirmar al cancelar
// ---------------------------------------------------------------------------

function useDirtyTracker(snapshot: {
  cliente: Cliente | null
  descripcion: string
  items: ItemForm[]
  abonoMonto: number
  notas: string
  precioTotalOverride: number | null
}): boolean {
  const current = JSON.stringify({
    clienteId: snapshot.cliente?.id ?? null,
    descripcion: snapshot.descripcion,
    items: snapshot.items.map((it) => ({
      tipoItem: it.tipoItem,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario
    })),
    abonoMonto: snapshot.abonoMonto,
    notas: snapshot.notas,
    precioTotalOverride: snapshot.precioTotalOverride
  })
  // El snapshot inicial se fija en el primer render usando useState lazy
  // initializer. Cualquier cambio posterior se compara contra ese baseline.
  const [initial] = useState(() => current)
  return initial !== current
}

// ---------------------------------------------------------------------------
// Helper: generar y abrir PDF tras un crearDirecto exitoso.
// Aislado para que el flujo principal de submit quede legible.
// ---------------------------------------------------------------------------

type ToastFn = ReturnType<typeof useToast>['showToast']

async function generarYAbrirPDF(opts: {
  pedido: { id: number; subtotal: number; totalMateriales: number; precioLista: number; descuentoMonto: number; descuentoMotivo: string | null; precioTotal: number; notas: string | null }
  facturaNumero: string
  facturaFecha: string
  cliente: Cliente | null
  pagos: Array<{ fecha: string; monto: number; metodoPago: string }>
  saldoFinal: number
  showToast: ToastFn
}): Promise<void> {
  try {
    // Refetch del pedido para obtener los items con shape correcto.
    const detalle = await window.api.pedidos.obtener(opts.pedido.id)
    if (!detalle.ok || !detalle.data) {
      opts.showToast({
        tone: 'warning',
        title: 'Pedido creado, pero no se pudo cargar para PDF',
        message: 'Puedes generar el PDF más tarde desde el detalle del pedido.'
      })
      return
    }
    const items =
      detalle.data.items?.map((it) => ({
        descripcion: it.descripcion ?? 'Item',
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario ?? it.subtotal,
        subtotal: it.subtotal
      })) ?? []

    const pdfPagos = opts.pagos.map((p) => ({
      fecha: p.fecha,
      monto: p.monto,
      metodo: p.metodoPago as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
    }))

    const result = await window.api.pdf.generarFactura({
      numero: opts.facturaNumero,
      fecha: opts.facturaFecha,
      clienteNombre: opts.cliente?.nombre ?? 'Sin cliente',
      clienteCedula: opts.cliente?.cedula ?? null,
      clienteTelefono: opts.cliente?.telefono ?? null,
      clienteDireccion: opts.cliente?.direccion ?? null,
      items,
      subtotal: opts.pedido.subtotal,
      totalMateriales: opts.pedido.totalMateriales,
      precioLista: opts.pedido.precioLista,
      descuentoMonto: opts.pedido.descuentoMonto ?? 0,
      descuentoMotivo: opts.pedido.descuentoMotivo,
      total: opts.pedido.precioTotal,
      pagos: pdfPagos,
      saldo: opts.saldoFinal,
      notas: opts.pedido.notas
    })
    if (result.ok) {
      await window.api.pdf.abrir(result.data)
    } else {
      opts.showToast({
        tone: 'warning',
        title: 'Pedido creado, pero el PDF falló',
        message: result.error
      })
    }
  } catch (err) {
    opts.showToast({
      tone: 'warning',
      title: 'Pedido creado, pero el PDF falló',
      message:
        'Puedes generarlo desde el detalle del pedido. ' +
        (err instanceof Error ? err.message : '')
    })
  }
}
