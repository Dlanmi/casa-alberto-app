// Tipos del state local del pedido directo + validador del draft
// persistido en localStorage. Vive en archivo separado del componente
// para poder testear el validator aislado (sin instanciar React).
//
// Origen del rigor: el bug del informe de seguridad sobre commit
// `65762f0` demostró que la versión inicial del validator (shallow,
// solo top-level) aceptaba items malformados que después crashean
// `it.descripcion.trim()` en el render. Aquí se cierra esa puerta:
// cada item y cada trabajo se valida campo a campo, y si CUALQUIERA
// no pasa el validator devuelve null → loadAutoSaveDraft limpia la key
// → la app arranca limpia en lugar de quedarse atascada.
import {
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  TIPOS_ENTREGA,
  TIPOS_ITEM_PEDIDO,
  TIPOS_TRABAJO,
  type EstadoPedido,
  type MetodoPago,
  type TipoEntrega,
  type TipoItemPedido,
  type TipoTrabajo
} from '@shared/types'
import {
  esArrayDe,
  esBool,
  esEnum,
  esNumeroFinito,
  esObjeto,
  esString,
  esStringNoVacio
} from '@renderer/lib/runtime-validators'

export type ItemForm = {
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
export type TrabajoLocal = {
  idLocal: string
  nombre: string
}

// v2.3.0 — clave del draft auto-guardado en localStorage. Si el papá cierra
// la app o reload accidental, el form se reconstruye con lo que tenía.
export const DRAFT_KEY = 'pedido-directo:wip'

// Shape del draft persistido. Se valida con `validarPedidoDirectoDraft`
// antes de aplicarlo — si llega corrupto (storage manipulado, mismatch de
// versión, parsing parcial), se descarta entero y el form arranca limpio.
export type PedidoDirectoDraft = {
  // Solo guardamos clienteId para no clavar una snapshot del cliente que
  // luego puede haber sido editado o eliminado. Al cargar el draft, la
  // lógica re-fetcha el cliente fresco (o lo deja en null si ya no existe).
  clienteId: number | null
  tipoTrabajo: TipoTrabajo
  descripcion: string
  anchoCm: number | null
  altoCm: number | null
  fechaIngreso: string
  fechaEntregaEditada: string | null
  tipoEntrega: TipoEntrega
  estadoInicial: EstadoPedido
  notas: string
  items: ItemForm[]
  trabajos: TrabajoLocal[]
  precioTotalOverride: number | null
  conAbono: boolean
  abonoMonto: number
  abonoMetodo: MetodoPago
  abonoFechaEditada: string | null
  generarPDF: boolean
}

// Valida un item del draft. Política "todo o nada": si CUALQUIER campo
// falla, devuelve null y `esArrayDe` aborta el array entero, lo que
// hace que el validator del draft descarte la persistencia completa.
// Origen del rigor: el bug del informe de seguridad sobre `65762f0` mostró
// que aceptar items con shape incompleto (ej. `{}`) causaba TypeError en
// render al deref `it.descripcion.trim()`. Aquí cerramos esa puerta.
function validarItemFormDraft(v: unknown): ItemForm | null {
  if (!esObjeto(v)) return null
  if (!esString(v.uid)) return null
  if (!esString(v.tipoItem)) return null
  if (
    v.tipoItem !== 'otro' &&
    !(TIPOS_ITEM_PEDIDO as readonly string[]).includes(v.tipoItem)
  ) {
    return null
  }
  // `descripcion` puede estar vacía mientras se llena el form, pero TIENE
  // que ser string. El bug del informe era exactamente esto: `undefined`
  // pasaba el validator shallow y crasheaba `it.descripcion.trim()`.
  if (!esString(v.descripcion, { maxLen: 500 })) return null
  if (!esString(v.referencia, { maxLen: 200 })) return null
  if (!esNumeroFinito(v.cantidad, { min: 0 })) return null
  if (!esNumeroFinito(v.precioUnitario, { min: 0 })) return null
  if (v.costoUnitarioEstimado !== null && !esNumeroFinito(v.costoUnitarioEstimado, { min: 0 })) {
    return null
  }
  if (v.trabajoIdLocal !== null && !esStringNoVacio(v.trabajoIdLocal, { maxLen: 100 })) {
    return null
  }
  return {
    uid: v.uid,
    tipoItem: v.tipoItem as TipoItemPedido | 'otro',
    descripcion: v.descripcion,
    referencia: v.referencia,
    cantidad: v.cantidad,
    precioUnitario: v.precioUnitario,
    costoUnitarioEstimado: v.costoUnitarioEstimado as number | null,
    trabajoIdLocal: v.trabajoIdLocal as string | null
  }
}

function validarTrabajoLocalDraft(v: unknown): TrabajoLocal | null {
  if (!esObjeto(v)) return null
  // idLocal: requerido no-vacío (el frontend lo usa como key + lookup).
  // Si llega vacío o falta, el render `items.indexOf` y la asociación
  // item↔trabajo se rompen silenciosamente.
  if (!esStringNoVacio(v.idLocal, { maxLen: 100 })) return null
  // nombre: string (puede estar vacío — el backend default a "Trabajo N"),
  // pero acotado a 200 chars (mismo límite del backend).
  if (!esString(v.nombre, { maxLen: 200 })) return null
  return { idLocal: v.idLocal, nombre: v.nombre }
}

/**
 * Valida un draft persistido del pedido directo. Retorna `null` si
 * CUALQUIER campo está malformado — `loadAutoSaveDraft` se encarga de
 * limpiar la key cuando el validator devuelve null, así un draft corrupto
 * no se queda atascado causando crashes persistentes (bug v2.3.0 del
 * informe de seguridad sobre `65762f0`).
 *
 * Política "todo o nada": preferimos perder el draft entero a aceptar
 * uno parcialmente correcto que después crashea el render. Si el shape
 * de `PedidoDirectoDraft` cambia entre versiones, drafts viejos serán
 * descartados — eso es deseable.
 */
export function validarPedidoDirectoDraft(raw: unknown): PedidoDirectoDraft | null {
  if (!esObjeto(raw)) return null

  // Enums acotados.
  if (!esEnum(raw.tipoTrabajo, TIPOS_TRABAJO)) return null
  if (!esEnum(raw.tipoEntrega, TIPOS_ENTREGA)) return null
  if (!esEnum(raw.estadoInicial, ESTADOS_PEDIDO)) return null
  if (!esEnum(raw.abonoMetodo, METODOS_PAGO)) return null

  // Strings.
  if (!esString(raw.descripcion, { maxLen: 500 })) return null
  if (!esString(raw.notas, { maxLen: 2000 })) return null
  if (!esString(raw.fechaIngreso, { maxLen: 50 })) return null
  if (raw.fechaEntregaEditada !== null && !esString(raw.fechaEntregaEditada, { maxLen: 50 })) {
    return null
  }
  if (raw.abonoFechaEditada !== null && !esString(raw.abonoFechaEditada, { maxLen: 50 })) {
    return null
  }

  // Nullable numbers.
  if (raw.clienteId !== null && !esNumeroFinito(raw.clienteId, { min: 1, entero: true })) {
    return null
  }
  if (raw.anchoCm !== null && !esNumeroFinito(raw.anchoCm, { min: 0 })) return null
  if (raw.altoCm !== null && !esNumeroFinito(raw.altoCm, { min: 0 })) return null
  if (
    raw.precioTotalOverride !== null &&
    !esNumeroFinito(raw.precioTotalOverride, { min: 0 })
  ) {
    return null
  }

  // Numbers requeridos.
  if (!esNumeroFinito(raw.abonoMonto, { min: 0 })) return null

  // Booleans.
  if (!esBool(raw.conAbono)) return null
  if (!esBool(raw.generarPDF)) return null

  // Arrays — política "todo o nada" por elemento.
  const items = esArrayDe(raw.items, validarItemFormDraft)
  if (items === null) return null
  // trabajos: array obligatorio (puede estar vacío).
  const trabajos = esArrayDe(raw.trabajos, validarTrabajoLocalDraft)
  if (trabajos === null) return null

  return {
    clienteId: raw.clienteId as number | null,
    tipoTrabajo: raw.tipoTrabajo,
    descripcion: raw.descripcion,
    anchoCm: raw.anchoCm as number | null,
    altoCm: raw.altoCm as number | null,
    fechaIngreso: raw.fechaIngreso,
    fechaEntregaEditada: raw.fechaEntregaEditada as string | null,
    tipoEntrega: raw.tipoEntrega,
    estadoInicial: raw.estadoInicial,
    notas: raw.notas,
    items,
    trabajos,
    precioTotalOverride: raw.precioTotalOverride as number | null,
    conAbono: raw.conAbono,
    abonoMonto: raw.abonoMonto,
    abonoMetodo: raw.abonoMetodo,
    abonoFechaEditada: raw.abonoFechaEditada as string | null,
    generarPDF: raw.generarPDF
  }
}

/**
 * Acota un valor leído de configuración de días al rango válido (entero
 * entre 0 y 365). Si el valor está fuera de rango, devuelve `fallback`.
 *
 * Defense in depth (capa 3 del fix del informe sobre 7f37f5b): si por
 * cualquier razón la DB ya tiene un valor corrupto cuando esta versión
 * arranca (Excel viejo importado pre-fix, manipulación directa de SQLite,
 * downgrade-upgrade de versión), `sugerirFechaEntrega` no propaga el
 * valor absurdo a `Date.setDate(...)`. La función arriba (`setConfig` +
 * `parseConfiguracion` + `sanitizeConfigOnBoot`) ya previene que llegue
 * a la DB, pero este clamp cubre el caso transicional sin riesgo de
 * crashes en la pantalla principal del papá.
 *
 * Rango: 0-365 días, debe ser entero. Mismo rango que `SPEC_NUMERICAS`
 * en main/db/queries/configuracion.ts — coordinado intencionalmente.
 */
export function clampearDias(n: number | null | undefined, fallback: number): number {
  if (n == null) return fallback
  if (!Number.isInteger(n)) return fallback
  if (n < 0 || n > 365) return fallback
  return n
}
