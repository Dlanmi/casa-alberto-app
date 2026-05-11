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
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Pencil,
  Check,
  X
} from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Modal } from '@renderer/components/ui/modal'
import { Spinner } from '@renderer/components/ui/spinner'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { MuestraMarcoPickerCargado } from '@renderer/components/shared/muestra-marco-picker'
import { useToast } from '@renderer/contexts/toast-context'
import { useIpc } from '@renderer/hooks/use-ipc'
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
  TIPOS_TRABAJO_CONCRETO,
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
  // v2.3.0 — agrupación opcional en "trabajos". `null` = item suelto
  // (comportamiento pre-v2.3.0). Si tiene valor, debe coincidir con un
  // entry en el estado `trabajos[]` del padre.
  trabajoIdLocal: string | null
}

// v2.3.0 — un "trabajo" agrupa items que pertenecen a un mismo cuadro o
// pieza dentro del pedido (ej. "Cuadro de la abuela", "Espejo del baño").
// El idLocal es un UUID generado en el cliente; el backend lo mapea a
// trabajoId 1-indexed al persistir en pedido_items.metadata.
type TrabajoLocal = {
  idLocal: string
  nombre: string
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

function nuevoItemVacio(trabajoIdLocal: string | null = null): ItemForm {
  return {
    uid: nextUid(),
    tipoItem: 'otro',
    descripcion: '',
    referencia: '',
    cantidad: 1,
    precioUnitario: 0,
    costoUnitarioEstimado: null,
    trabajoIdLocal
  }
}

// Genera un UUID corto para el idLocal de un trabajo. No usamos
// crypto.randomUUID directo porque queda muy largo en localStorage; un
// hash corto base36 alcanza para no colisionar dentro de un pedido (≤30
// trabajos típico).
function nextTrabajoUid(): string {
  return `t-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36).slice(-4)}`
}

// Días sugeridos desde hoy para auto-fecha de entrega según tipo de entrega.
// Los valores son configurables desde la pantalla de Configuración (claves
// `dias_entrega_urgente/_estandar/_sin_afan`). Aquí solo definimos fallbacks
// por si la lectura IPC todavía no resolvió o un valor quedó vacío.
const DIAS_SUGERIDOS_FALLBACK: Record<TipoEntrega, number> = {
  urgente: 3,
  estandar: 7,
  sin_afan: 14
}

function sugerirFechaEntrega(
  tipoEntrega: TipoEntrega,
  fechaIngreso: string,
  dias: Record<TipoEntrega, number>
): string {
  const base = new Date(`${fechaIngreso}T12:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + dias[tipoEntrega])
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

  // Días sugeridos por tipo de entrega — se leen de la tabla `configuracion`.
  // El dueño los edita desde la pantalla de Configuración. Usamos fallbacks
  // mientras el IPC carga (3/7/14) para que la sugerencia funcione desde el
  // primer render.
  const { data: diasUrgente } = useIpc<number>(
    () =>
      window.api.configuracion.getNumber('dias_entrega_urgente', DIAS_SUGERIDOS_FALLBACK.urgente),
    []
  )
  const { data: diasEstandar } = useIpc<number>(
    () =>
      window.api.configuracion.getNumber('dias_entrega_estandar', DIAS_SUGERIDOS_FALLBACK.estandar),
    []
  )
  const { data: diasSinAfan } = useIpc<number>(
    () =>
      window.api.configuracion.getNumber('dias_entrega_sin_afan', DIAS_SUGERIDOS_FALLBACK.sin_afan),
    []
  )
  const diasSugeridos = useMemo<Record<TipoEntrega, number>>(
    () => ({
      urgente: diasUrgente ?? DIAS_SUGERIDOS_FALLBACK.urgente,
      estandar: diasEstandar ?? DIAS_SUGERIDOS_FALLBACK.estandar,
      sin_afan: diasSinAfan ?? DIAS_SUGERIDOS_FALLBACK.sin_afan
    }),
    [diasUrgente, diasEstandar, diasSinAfan]
  )

  const fechaEntrega =
    fechaEntregaEditada ?? sugerirFechaEntrega(tipoEntrega, fechaIngreso, diasSugeridos)
  const fechaEntregaTocada = fechaEntregaEditada !== null
  const [estadoInicial, setEstadoInicial] = useState<EstadoPedido>('confirmado')
  const [notas, setNotas] = useState('')

  const [items, setItems] = useState<ItemForm[]>(() => [nuevoItemVacio()])

  // v2.3.0 — trabajos definidos por el dueño para agrupar items dentro del
  // pedido (ej. "Cuadro de la abuela", "Espejo del baño"). Por defecto
  // vacío: el pedido se comporta como hasta v2.2.x (items planos sueltos).
  // El dueño agrega trabajos con el botón "+ Agregar trabajo" en la
  // sección de items.
  const [trabajos, setTrabajos] = useState<TrabajoLocal[]>([])

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

  // v2.3.0 — todo trabajo definido debe tener ≥1 item asociado. Si el dueño
  // crea un trabajo y deja vacíos sus items, no se puede guardar — usar la
  // X del trabajo para eliminarlo, o agregar al menos un item.
  const trabajosSinItems = useMemo(
    () =>
      trabajos.filter((t) => !items.some((it) => it.trabajoIdLocal === t.idLocal)),
    [trabajos, items]
  )

  // Items agrupados para el render. Iteramos `trabajos[]` en orden de
  // creación; los items "sueltos" (trabajoIdLocal=null) van al final como
  // grupo aparte. Reutiliza el mismo array `items` (mismas referencias),
  // así el patrón de update por uid sigue funcionando.
  const itemsPorTrabajo = useMemo(() => {
    const map = new Map<string, ItemForm[]>()
    for (const t of trabajos) map.set(t.idLocal, [])
    const sueltos: ItemForm[] = []
    for (const it of items) {
      if (it.trabajoIdLocal && map.has(it.trabajoIdLocal)) {
        map.get(it.trabajoIdLocal)!.push(it)
      } else {
        sueltos.push(it)
      }
    }
    return { porTrabajo: map, sueltos }
  }, [items, trabajos])

  const subtotalPorTrabajo = useCallback(
    (idLocal: string): number => {
      const list = itemsPorTrabajo.porTrabajo.get(idLocal) ?? []
      return list.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0)
    },
    [itemsPorTrabajo]
  )

  const formValido =
    cliente !== null &&
    items.length >= 1 &&
    itemsValidos &&
    trabajosSinItems.length === 0 &&
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

  // --- Helpers trabajos (v2.3.0) ---

  // Agrega un nuevo trabajo con nombre default "Trabajo N" + un item vacío
  // dentro (para que no quede "vacío" desde el inicio). El dueño puede
  // renombrarlo después tocando el ícono ✎ en el header del bloque.
  const addTrabajo = useCallback(() => {
    const idLocal = nextTrabajoUid()
    setTrabajos((prev) => {
      const nombre = `Trabajo ${prev.length + 1}`
      return [...prev, { idLocal, nombre }]
    })
    setItems((prev) => [...prev, nuevoItemVacio(idLocal)])
  }, [])

  const updateTrabajoNombre = useCallback((idLocal: string, nombre: string) => {
    setTrabajos((prev) => prev.map((t) => (t.idLocal === idLocal ? { ...t, nombre } : t)))
  }, [])

  // Elimina un trabajo Y sus items asociados. La UI llama esto solo después
  // de confirmar con el usuario si el trabajo tiene items (ver render).
  const removeTrabajo = useCallback((idLocal: string) => {
    setTrabajos((prev) => prev.filter((t) => t.idLocal !== idLocal))
    setItems((prev) => prev.filter((it) => it.trabajoIdLocal !== idLocal))
  }, [])

  const addItemATrabajo = useCallback((idLocal: string) => {
    setItems((prev) => [...prev, nuevoItemVacio(idLocal)])
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
    if (trabajosSinItems.length > 0) {
      const nombres = trabajosSinItems.map((t) => `"${t.nombre}"`).join(', ')
      setSubmitError(
        `Cada trabajo debe tener al menos un item. Trabajos sin items: ${nombres}. Agrégales items o elimínalos.`
      )
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
      items: items.map<ItemPedidoDirecto>((it) => {
        const trabajo = it.trabajoIdLocal
          ? trabajos.find((t) => t.idLocal === it.trabajoIdLocal)
          : null
        return {
          tipoItem: it.tipoItem,
          descripcion: it.descripcion.trim(),
          referencia: it.referencia.trim() || null,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          costoUnitarioEstimado: it.costoUnitarioEstimado,
          // v2.3.0 — propagamos la agrupación al backend. Si el item no
          // está en ningún trabajo, pasan como null y se persiste sin
          // metadata.trabajoId (item suelto).
          trabajoIdLocal: it.trabajoIdLocal,
          trabajoNombre: trabajo?.nombre ?? null
        }
      }),
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
              options={TIPOS_TRABAJO_CONCRETO.map((t) => ({
                value: t,
                label: TIPO_TRABAJO_LABEL[t]
              }))}
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
                  : `Fecha de entrega (sugerida +${diasSugeridos[tipoEntrega]} días)`
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

        {/* --------- 3. Items y/o Trabajos --------- */}
        <section
          aria-labelledby="seccion-items"
          className="rounded-lg border border-border bg-surface p-5 space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 id="seccion-items" className="text-base font-semibold text-text">
              {trabajos.length > 0 ? 'Trabajos y items' : 'Items del pedido'}
              <span className="ml-2 text-xs font-normal text-text-muted">
                ({items.length} {items.length === 1 ? 'item' : 'items'}
                {trabajos.length > 0 &&
                  `, ${trabajos.length} ${trabajos.length === 1 ? 'trabajo' : 'trabajos'}`}
                )
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={addTrabajo} type="button">
                <Plus size={16} />
                Agregar trabajo
              </Button>
              <Button variant="outline" onClick={addItem} type="button">
                <Plus size={16} />
                Agregar item
              </Button>
            </div>
          </div>

          {trabajos.length === 0 && (
            <p className="text-xs text-text-muted">
              ¿El cliente trae varios cuadros distintos? Toca <strong>Agregar trabajo</strong>{' '}
              para agrupar los items de cada uno por separado.
            </p>
          )}

          {/* Bloques de trabajo (si hay) */}
          {trabajos.map((trabajo, idx) => {
            const itemsDelTrabajo = itemsPorTrabajo.porTrabajo.get(trabajo.idLocal) ?? []
            const subtotal = subtotalPorTrabajo(trabajo.idLocal)
            return (
              <TrabajoBlock
                key={trabajo.idLocal}
                index={idx}
                trabajo={trabajo}
                items={itemsDelTrabajo}
                subtotal={subtotal}
                onUpdateNombre={(nombre) => updateTrabajoNombre(trabajo.idLocal, nombre)}
                onRemove={() => {
                  const tieneItems = itemsDelTrabajo.length > 0
                  if (
                    !tieneItems ||
                    window.confirm(
                      `¿Eliminar el trabajo "${trabajo.nombre}" y sus ${itemsDelTrabajo.length} ${
                        itemsDelTrabajo.length === 1 ? 'item' : 'items'
                      }?`
                    )
                  ) {
                    removeTrabajo(trabajo.idLocal)
                  }
                }}
                onAddItem={() => addItemATrabajo(trabajo.idLocal)}
                onUpdateItem={(uid, patch) => updateItem(uid, patch)}
                onRemoveItem={(uid) => removeItem(uid)}
                canRemoveItem={items.length > 1}
              />
            )
          })}

          {/* Items sueltos (sin trabajo) — siempre se muestran. Cuando no hay
              trabajos definidos, esta es la única sección y NO se muestra
              header (queda como pedido directo tradicional). */}
          <div className="space-y-3">
            {trabajos.length > 0 && itemsPorTrabajo.sueltos.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
                  Items sueltos
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Items que no pertenecen a ningún trabajo en particular (ej. transporte,
                  cinta colgadora, materiales sueltos).
                </p>
              </div>
            )}
            {itemsPorTrabajo.sueltos.map((item) => {
              const indiceGlobal = items.indexOf(item)
              return (
                <ItemRow
                  key={item.uid}
                  index={indiceGlobal}
                  item={item}
                  onUpdate={(patch) => updateItem(item.uid, patch)}
                  onRemove={() => removeItem(item.uid)}
                  canRemove={items.length > 1}
                />
              )
            })}
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
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/10 backdrop-blur-(--backdrop-blur) pointer-events-none"
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

// v2.3.0 — Bloque visual que agrupa los items pertenecientes a un mismo
// "trabajo" (ej. "Cuadro de la abuela"). Header con nombre editable
// inline, botón X para eliminar (con confirmación si tiene items),
// items hijos con la misma ItemRow del flujo plano, y subtotal al final.
type TrabajoBlockProps = {
  index: number
  trabajo: TrabajoLocal
  items: ItemForm[]
  subtotal: number
  onUpdateNombre: (nombre: string) => void
  onRemove: () => void
  onAddItem: () => void
  onUpdateItem: (uid: string, patch: Partial<ItemForm>) => void
  onRemoveItem: (uid: string) => void
  canRemoveItem: boolean
}

function TrabajoBlock({
  index,
  trabajo,
  items,
  subtotal,
  onUpdateNombre,
  onRemove,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  canRemoveItem
}: TrabajoBlockProps): React.JSX.Element {
  const sinItems = items.length === 0
  return (
    <div
      className={cn(
        'rounded-md border-2 bg-surface-muted/40 p-4 space-y-3',
        // Highlight si está vacío: bloquea el guardado, hay que avisar
        sinItems ? 'border-error/60' : 'border-border'
      )}
    >
      <TrabajoHeader
        index={index}
        nombre={trabajo.nombre}
        onUpdateNombre={onUpdateNombre}
        onRemove={onRemove}
        subtotal={subtotal}
        cantidadItems={items.length}
      />

      {sinItems ? (
        <p className="text-xs text-error-strong px-2 py-2 flex items-center gap-1.5">
          <AlertCircle size={14} />
          Este trabajo no tiene items. Agrega al menos uno o elimina el trabajo.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ItemRow
              key={item.uid}
              index={idx}
              item={item}
              onUpdate={(patch) => onUpdateItem(item.uid, patch)}
              onRemove={() => onRemoveItem(item.uid)}
              canRemove={canRemoveItem}
            />
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onAddItem} type="button">
        <Plus size={14} />
        Agregar item a este trabajo
      </Button>
    </div>
  )
}

// Header del bloque de trabajo: número + nombre editable inline + botón
// para eliminar todo el trabajo. El subtotal se muestra a la derecha
// como indicador del precio del trabajo (no editable).
type TrabajoHeaderProps = {
  index: number
  nombre: string
  onUpdateNombre: (nombre: string) => void
  onRemove: () => void
  subtotal: number
  cantidadItems: number
}

function TrabajoHeader({
  index,
  nombre,
  onUpdateNombre,
  onRemove,
  subtotal,
  cantidadItems
}: TrabajoHeaderProps): React.JSX.Element {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(nombre)

  function guardar(): void {
    const limpio = borrador.trim()
    onUpdateNombre(limpio.length > 0 ? limpio : `Trabajo ${index + 1}`)
    setEditando(false)
  }

  function cancelar(): void {
    setBorrador(nombre)
    setEditando(false)
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
          Trabajo {index + 1}
          <span className="ml-2 normal-case font-normal text-text-soft">
            · {cantidadItems} {cantidadItems === 1 ? 'item' : 'items'}
          </span>
        </p>
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardar()
                if (e.key === 'Escape') cancelar()
              }}
              autoFocus
              maxLength={200}
              placeholder={`Trabajo ${index + 1}`}
              className={cn(
                'h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text',
                'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              )}
            />
            <Button variant="ghost" size="sm" onClick={guardar} aria-label="Guardar nombre">
              <Check size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelar} aria-label="Cancelar">
              <X size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-h-10">
            <span className="text-base font-semibold text-text truncate">{nombre}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBorrador(nombre)
                setEditando(true)
              }}
              aria-label="Editar nombre del trabajo"
              title="Editar nombre"
            >
              <Pencil size={14} />
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-mono tabular-nums text-sm font-semibold text-text">
          {formatCOP(subtotal)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Eliminar trabajo ${index + 1}`}
          title="Eliminar trabajo"
          className="text-error hover:text-error-strong hover:bg-error-bg"
        >
          <Trash2 size={14} />
        </Button>
      </div>
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
  // Modal de selección de muestra de marco (catálogo). Solo se ofrece para
  // tipoItem='marco' — para otros conceptos no aplica. El usuario puede
  // seguir tipeando libremente si la muestra no está registrada.
  const [pickerMarcoOpen, setPickerMarcoOpen] = useState(false)
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
      {item.tipoItem === 'marco' && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-accent/5 border border-accent/20 px-3 py-2">
          <p className="text-xs text-text-muted">
            ¿La muestra está en el catálogo? Selecciónala para enlazar referencia y precio.
          </p>
          <button
            type="button"
            onClick={() => setPickerMarcoOpen(true)}
            className="text-xs font-medium text-accent-strong hover:underline whitespace-nowrap"
          >
            Elegir del catálogo
          </button>
        </div>
      )}
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

      {/* Modal: catálogo de muestras de marco. Sólo se monta cuando el item
          es de tipo 'marco' Y el picker está abierto — `Modal` renderiza
          {children} aunque open=false, así que sin este gate cada ItemRow
          montaría MuestraMarcoPickerCargado y dispararía un IPC
          listarMuestrasMarcos en el render inicial, multiplicando trabajo
          por fila × tamaño de catálogo. */}
      {item.tipoItem === 'marco' && pickerMarcoOpen && (
        <Modal
          open={pickerMarcoOpen}
          onClose={() => setPickerMarcoOpen(false)}
          title="Elegir marco del catálogo"
          size="lg"
        >
          <MuestraMarcoPickerCargado
            selectedId={null}
            onSelect={(marco) => {
              onUpdate({
                descripcion: marco.descripcion || `Marco ${marco.referencia}`,
                referencia: marco.referencia,
                // El costo unitario para un marco se aproxima como el costo/m
                // (asumiendo cantidad=1 metro). Si el papá ajusta cantidad
                // después, el costo total se recalcula al persistir.
                costoUnitarioEstimado:
                  marco.costoMetroEstimado ?? item.costoUnitarioEstimado,
                // El precio unitario también sale del catálogo (precio/metro).
                precioUnitario: marco.precioMetro
              })
              setPickerMarcoOpen(false)
            }}
            // Sin `compacto`: el Modal ya provee scroll (max-h-[85vh]) y el
            // grid no necesita su propio overflow. Con doble scroll (modal +
            // grid) se sentía "scroll infinito" al llegar al final del grid.
          />
        </Modal>
      )}
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
    // v2.3.0 — propagar metadata.trabajoId + trabajoNombre al PDF para
    // que la factura agrupe los items por trabajo cuando el dueño definió
    // varios trabajos en el pedido directo. Pedidos sin trabajos (la
    // mayoría) traen metadata=null y el PDF los renderiza plano.
    const items =
      detalle.data.items?.map((it) => {
        const md = (it as {
          metadata?: {
            trabajoId?: number
            tipoTrabajoOrigen?: string
            medidas?: { anchoCm: number; altoCm: number }
            trabajoNombre?: string
          } | null
        }).metadata ?? null
        return {
          descripcion: it.descripcion ?? 'Item',
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario ?? it.subtotal,
          subtotal: it.subtotal,
          ...(md?.trabajoId != null ? { trabajoId: md.trabajoId } : {}),
          ...(md?.tipoTrabajoOrigen
            ? { tipoTrabajoOrigen: md.tipoTrabajoOrigen as never }
            : {}),
          ...(md?.medidas ? { medidasTrabajo: md.medidas } : {}),
          ...(md?.trabajoNombre ? { trabajoNombre: md.trabajoNombre } : {})
        }
      }) ?? []

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
