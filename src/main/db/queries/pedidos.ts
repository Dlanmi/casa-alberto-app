import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  not,
  or,
  sql,
  type SQL
} from 'drizzle-orm'
import { buildContainsPattern } from '../sql-helpers'
import type { DB } from '../index'
import type {
  CrearPedidoDirectoInput,
  CrearPedidoDirectoResult,
  EntregaDelDia,
  PedidoSinAbonoConSaldo
} from '@shared/types'
import { generarConsecutivo } from '../consecutivos'
import {
  clientes,
  configuracion,
  devoluciones,
  ESTADOS_PEDIDO,
  facturas,
  historialCambios,
  METODOS_PAGO,
  movimientosFinancieros,
  pagos,
  pedidoItems,
  pedidos,
  TIPOS_ENTREGA,
  TIPOS_TRABAJO,
  TIPOS_TRABAJO_CONCRETO,
  type EstadoPedido,
  type MetodoPago,
  type PedidoItemMetadata,
  type TipoEntrega,
  type TipoTrabajo
} from '../schema'
import { crearCliente } from './clientes'
import {
  cotizarAcolchado,
  cotizarAdherido,
  cotizarBastidor,
  cotizarEnmarcacionEstandar,
  cotizarEnmarcacionPaspartu,
  cotizarRetablo,
  cotizarTapa,
  cotizarVidrioEspejo,
  type ResultadoCotizacion
} from './cotizador'
import { TRANSICIONES_VALIDAS } from '@shared/pedido-transitions'
import { calcularEvaluacionComercial } from '@shared/comercial'
import { redondearPrecioFinal } from '@shared/redondeo'
import { validarFechaISO } from '../../lib/validar-fecha'
import { validarEnum } from '../../lib/validar-enum'
import { validarMonto } from '../../lib/validar-monto'

export { TRANSICIONES_VALIDAS }

const ESTADOS_TERMINALES: EstadoPedido[] = ['listo', 'entregado', 'cancelado']
const ESTADOS_NO_FACTURABLES: EstadoPedido[] = ['cotizado', 'cancelado']
const ESTADOS_ACTIVOS_MATRIZ: EstadoPedido[] = ['confirmado', 'en_proceso', 'listo']
const ESTADOS_ACTIVOS_AGENDA: EstadoPedido[] = ['confirmado', 'en_proceso', 'listo', 'sin_reclamar']
const DAY_MS = 24 * 60 * 60 * 1000

// Días tras los cuales un pedido entregado se considera archivado y
// se oculta por defecto del Kanban. Papá puede ver el histórico con el toggle.
// Declarado antes de listarPedidos para evitar TDZ si la función se llamara
// durante inicialización del módulo (ej. desde un test helper o seed eager).
const DIAS_ARCHIVADO = 30

export type NuevoPedidoDatos = {
  clienteId: number
  tipoTrabajo: TipoTrabajo
  descripcion?: string | null
  anchoCm?: number | null
  altoCm?: number | null
  muestraMarcoId?: number | null
  anchoPaspartuCm?: number | null
  tipoPaspartu?: 'pintado' | 'acrilico' | null
  conSuplemento?: boolean
  tipoVidrio?: string | null
  porcentajeMateriales?: number
  precioManual?: number
  costoManualEstimado?: number
  precioInstalacion?: number
  costoInstalacionEstimado?: number
  tipoEntrega?: TipoEntrega
  fechaIngreso: string
  fechaEntrega?: string | null
  notas?: string | null
}

export type CrearPedidoConfirmadoData = {
  datos: NuevoPedidoDatos
  cotizacion: ResultadoCotizacion
  descuento?: {
    monto: number
    motivo?: string | null
  } | null
  facturaFecha: string
  abono?: {
    monto: number
    metodoPago: MetodoPago
    fecha: string
    notas?: string | null
  } | null
}

export type CrearPedidoConfirmadoResult = {
  pedido: typeof pedidos.$inferSelect
  factura: typeof facturas.$inferSelect
  pago: typeof pagos.$inferSelect | null
  saldo: number
}

// ---------------------------------------------------------------------------
// Multi-trabajo (v2.2.0): un pedido con N trabajos de tipos potencialmente
// distintos en una sola visita. El cliente trae varios cuadros y se factura
// todo junto. Cada trabajo conserva su cotización y, al persistirlo, sus
// items se aplanan en `pedido_items` con `metadata.trabajoId` para poder
// reconstruir la agrupación visual al leer el pedido.
// ---------------------------------------------------------------------------

export type TrabajoCotizado = {
  /** Tipo concreto — nunca 'mixto'; ese es solo del pedido contenedor. */
  tipoTrabajo: Exclude<TipoTrabajo, 'mixto'>
  /** Datos del trabajo necesarios para validar la cotización contra el
   *  cotizador del backend (mismo flujo que `cotizacionAutorizada`). */
  datos: NuevoPedidoDatos
  /** Cotización ya calculada en el frontend; el backend la re-deriva y
   *  compara para impedir manipulación de precios vía IPC. */
  cotizacion: ResultadoCotizacion
}

export type CrearPedidoMultiTrabajoInput = {
  /** Reusa el shape de cliente del pedido directo: existente (id) o nuevo (data). */
  cliente: CrearPedidoDirectoInput['cliente']
  /** Mínimo 1 trabajo. Si solo hay 1, el pedido NO queda como 'mixto' — usa
   *  el tipoTrabajo del único trabajo (compatibilidad con reportes). */
  trabajos: TrabajoCotizado[]
  pedido: {
    fechaIngreso: string
    fechaEntrega?: string | null
    tipoEntrega: TipoEntrega
    notas?: string | null
  }
  /** Descuento global aplicado al total del pedido (decisión de producto:
   *  un solo descuento al pedido entero, no por trabajo). */
  descuento?: {
    monto: number
    motivo?: string | null
  } | null
  factura: {
    fecha: string
    notas?: string | null
  }
  abono?: {
    monto: number
    metodoPago: MetodoPago
    fecha: string
    notas?: string | null
  } | null
  generarPDF: boolean
}

export type CrearPedidoMultiTrabajoResult = {
  pedido: typeof pedidos.$inferSelect
  factura: typeof facturas.$inferSelect
  pago: typeof pagos.$inferSelect | null
  saldo: number
  /** trabajoId por trabajo — útil para que el frontend pueda highlight uno
   *  específico tras crear el pedido. Empieza en 1. */
  trabajoIds: number[]
}

function validarFechasPedido(datos: NuevoPedidoDatos): void {
  if (datos.fechaIngreso) {
    validarFechaISO(datos.fechaIngreso, 'YYYY-MM-DD', 'fechaIngreso')
  }
  if (datos.fechaEntrega) {
    validarFechaISO(datos.fechaEntrega, 'YYYY-MM-DD', 'fechaEntrega')
  }
  if (datos.fechaEntrega && datos.fechaIngreso && datos.fechaEntrega < datos.fechaIngreso) {
    throw new Error('La fecha de entrega no puede ser anterior a la fecha de ingreso')
  }
}

function assertNumeroFinito(valor: unknown, campo: string): asserts valor is number {
  if (!Number.isFinite(valor)) throw new Error(`${campo} no es un número válido`)
}

function getMedidas(datos: NuevoPedidoDatos): { anchoCm: number; altoCm: number } {
  assertNumeroFinito(datos.anchoCm, 'El ancho')
  assertNumeroFinito(datos.altoCm, 'El alto')
  return { anchoCm: datos.anchoCm, altoCm: datos.altoCm }
}

function requireMuestraMarcoId(datos: NuevoPedidoDatos): number {
  assertNumeroFinito(datos.muestraMarcoId, 'La muestra de marco')
  return datos.muestraMarcoId
}

const CLAVE_MARGEN_MINIMO_ALERTA = 'margen_minimo_alerta_pct'

function leerNumeroConfiguracion(db: DB, clave: string, fallback: number): number {
  const row = db
    .select({ valor: configuracion.valor })
    .from(configuracion)
    .where(eq(configuracion.clave, clave))
    .get()
  const valor = Number(row?.valor)
  return Number.isFinite(valor) ? valor : fallback
}

/**
 * Evalúa el pedido con la MISMA fórmula que el wizard. Usa el módulo
 * compartido `@shared/comercial` con `autoRedondear: false` porque el
 * frontend ya ajustó el descuento al llegar acá — el backend solo lo
 * aplica tal cual.
 */
function evaluarPedido(
  db: DB,
  precioSugerido: number,
  descuentoMonto: number,
  costoEstimadoTotal: number | null
) {
  const margenMinimoAlertaPct = leerNumeroConfiguracion(db, CLAVE_MARGEN_MINIMO_ALERTA, 20)
  return calcularEvaluacionComercial({
    precioSugerido,
    descuentoMonto,
    costoEstimado: costoEstimadoTotal,
    margenMinimoAlertaPct,
    autoRedondear: false
  })
}

function validarCotizacionAritmetica(cotizacion: ResultadoCotizacion): void {
  if (!cotizacion.items.length) throw new Error('La cotización no tiene ítems')
  for (const [index, item] of cotizacion.items.entries()) {
    assertNumeroFinito(item.cantidad, `La cantidad del ítem ${index + 1}`)
    assertNumeroFinito(item.subtotal, `El subtotal del ítem ${index + 1}`)
    if (item.precioUnitario !== null) {
      assertNumeroFinito(item.precioUnitario, `El precio unitario del ítem ${index + 1}`)
    }
    if (item.cantidad <= 0) throw new Error(`La cantidad del ítem ${index + 1} debe ser mayor a 0`)
    if (item.subtotal < 0)
      throw new Error(`El subtotal del ítem ${index + 1} no puede ser negativo`)
  }
  assertNumeroFinito(cotizacion.subtotal, 'El subtotal de la cotización')
  assertNumeroFinito(cotizacion.totalMateriales, 'Los materiales de la cotización')
  assertNumeroFinito(cotizacion.precioTotal, 'El total de la cotización')
}

function validarCotizacionesIguales(
  recibida: ResultadoCotizacion,
  esperada: ResultadoCotizacion
): void {
  validarCotizacionAritmetica(recibida)
  // Los campos sensibles (precioLista, brutoCotizado, costoEstimadoTotal,
  // margenEstimado, estadoRentabilidad) NO se validan acá: el caller
  // (insertarPedidoDesdeCotizacion) usa los de `esperada`, que vienen del
  // backend recalculado, e ignora los del cliente. Acá solo verificamos
  // que los items y los totales agregados coincidan.
  if (
    recibida.subtotal !== esperada.subtotal ||
    recibida.totalMateriales !== esperada.totalMateriales ||
    recibida.precioTotal !== esperada.precioTotal ||
    recibida.items.length !== esperada.items.length
  ) {
    throw new Error('La cotización no coincide con las listas de precios actuales')
  }

  for (let i = 0; i < esperada.items.length; i += 1) {
    const actual = recibida.items[i]
    const esperado = esperada.items[i]
    if (
      !actual ||
      actual.tipoItem !== esperado.tipoItem ||
      actual.cantidad !== esperado.cantidad ||
      actual.precioUnitario !== esperado.precioUnitario ||
      actual.subtotal !== esperado.subtotal ||
      (actual.referencia ?? null) !== (esperado.referencia ?? null)
    ) {
      throw new Error('La cotización no coincide con las listas de precios actuales')
    }
  }
}

function cotizacionAutorizada(
  db: DB,
  datos: NuevoPedidoDatos,
  recibida: ResultadoCotizacion
): ResultadoCotizacion {
  const porcentajeMateriales = datos.porcentajeMateriales ?? 10
  const tipoVidrio = datos.tipoVidrio ?? 'ninguno'
  let esperada: ResultadoCotizacion

  if (datos.tipoTrabajo === 'restauracion') {
    validarCotizacionAritmetica(recibida)
    if (datos.precioManual !== undefined && datos.precioManual !== recibida.subtotal) {
      throw new Error('La cotización manual no coincide con el precio ingresado')
    }
    const costoManualEstimado =
      datos.costoManualEstimado !== undefined && Number.isFinite(datos.costoManualEstimado)
        ? Math.max(0, Math.round(datos.costoManualEstimado))
        : null
    // Backend re-deriva los campos sensibles ignorando lo que envía el cliente:
    //   - brutoCotizado = subtotal + totalMateriales
    //   - precioLista = redondear(brutoCotizado) al múltiplo de $1.000
    // Antes confiábamos en `recibida.precioLista || recibida.precioTotal`, lo
    // que dejaba la puerta abierta a manipulación vía IPC directo.
    // validarMonto sobre la SUMA: subtotal y totalMateriales individualmente
    // pueden ser finitos (chequeo de assertNumeroFinito) pero su suma puede
    // overflow a Infinity. Sin esta validación, redondearPrecioFinal devuelve
    // 0 silenciosamente y el bruto se filtraría a la DB en flujos como
    // crearPedidoMultiTrabajo que persisten subtotal/totalMateriales raw.
    const brutoCotizado = validarMonto(recibida.subtotal + recibida.totalMateriales, {
      campo: 'Bruto cotizado de la restauración',
      min: 0
    })
    const precioLista = redondearPrecioFinal(brutoCotizado)
    // Multi-item-safe: cuando hay un solo ítem (caso típico) el costo manual
    // va completo. Si en el futuro se permite multi-item en restauración,
    // solo el primero recibe el costo para no multiplicar la suma.
    const items = recibida.items.map((item, idx) => ({
      ...item,
      costoUnitarioEstimado: idx === 0 ? costoManualEstimado : 0,
      subtotalCostoEstimado: idx === 0 ? costoManualEstimado : 0
    }))
    const evaluacion = calcularEvaluacionComercial({
      precioSugerido: precioLista,
      descuentoMonto: 0,
      costoEstimado: costoManualEstimado,
      margenMinimoAlertaPct: leerNumeroConfiguracion(db, CLAVE_MARGEN_MINIMO_ALERTA, 20),
      autoRedondear: false
    })
    return {
      ...recibida,
      items,
      brutoCotizado,
      precioLista,
      precioTotal: precioLista,
      costoEstimadoTotal: costoManualEstimado,
      margenEstimado: evaluacion.margenEstimado,
      margenEstimadoPct: evaluacion.margenEstimadoPct,
      estadoRentabilidad: evaluacion.estadoRentabilidad
    }
  }

  const { anchoCm, altoCm } = getMedidas(datos)

  if (datos.tipoTrabajo === 'enmarcacion_estandar') {
    const muestraMarcoId = requireMuestraMarcoId(datos)
    if (datos.anchoPaspartuCm && datos.tipoPaspartu) {
      esperada = cotizarEnmarcacionPaspartu(db, {
        anchoCm,
        altoCm,
        anchoPaspartuCm: datos.anchoPaspartuCm,
        tipoPaspartu: datos.tipoPaspartu,
        muestraMarcoId,
        tipoVidrio,
        porcentajeMateriales,
        conSuplemento: datos.conSuplemento ?? false
      })
    } else {
      esperada = cotizarEnmarcacionEstandar(db, {
        anchoCm,
        altoCm,
        muestraMarcoId,
        tipoVidrio,
        porcentajeMateriales
      })
    }
  } else if (datos.tipoTrabajo === 'acolchado') {
    esperada = cotizarAcolchado(db, {
      anchoCm,
      altoCm,
      muestraMarcoId: datos.muestraMarcoId ?? null,
      porcentajeMateriales
    })
  } else if (datos.tipoTrabajo === 'adherido') {
    esperada = cotizarAdherido(db, { anchoCm, altoCm, porcentajeMateriales })
  } else if (datos.tipoTrabajo === 'retablo') {
    esperada = cotizarRetablo(db, { anchoCm, altoCm, porcentajeMateriales })
  } else if (datos.tipoTrabajo === 'bastidor') {
    esperada = cotizarBastidor(db, { anchoCm, altoCm, porcentajeMateriales })
  } else if (datos.tipoTrabajo === 'tapa') {
    esperada = cotizarTapa(db, { anchoCm, altoCm, porcentajeMateriales })
  } else if (datos.tipoTrabajo === 'vidrio_espejo') {
    if (!datos.tipoVidrio || datos.tipoVidrio === 'ninguno') {
      throw new Error('El tipo de vidrio es obligatorio para vidrio/espejo')
    }
    esperada = cotizarVidrioEspejo(db, {
      anchoCm,
      altoCm,
      tipoVidrio: datos.tipoVidrio,
      precioInstalacion: datos.precioInstalacion ?? 0,
      costoInstalacionEstimado: datos.costoInstalacionEstimado ?? null,
      descripcion: datos.descripcion ?? null
    })
  } else {
    throw new Error(`Tipo de trabajo no soportado: ${datos.tipoTrabajo}`)
  }

  validarCotizacionesIguales(recibida, esperada)
  return esperada
}

function insertarPedidoDesdeCotizacion(
  db: DB,
  datos: NuevoPedidoDatos,
  cotizacion: ResultadoCotizacion,
  descuento?: { monto: number; motivo?: string | null } | null
) {
  const descuentoMonto = descuento?.monto ?? 0
  const precioLista = cotizacion.precioLista
  const evaluacion = evaluarPedido(db, precioLista, descuentoMonto, cotizacion.costoEstimadoTotal)
  // Defense in depth (informe 318aa85): el cotizador no valida sus outputs
  // y la evaluacion comercial puede propagar Infinity. Validamos cada monto
  // antes del insert para que la DB no reciba valores no-finitos.
  validarMonto(cotizacion.subtotal, { campo: 'Subtotal del pedido', min: 0 })
  validarMonto(cotizacion.totalMateriales, { campo: 'Total de materiales', min: 0 })
  validarMonto(cotizacion.brutoCotizado, { campo: 'Bruto cotizado', min: 0 })
  validarMonto(precioLista, { campo: 'Precio de lista', min: 0 })
  validarMonto(evaluacion.descuentoMonto, { campo: 'Descuento', min: 0 })
  validarMonto(evaluacion.precioFinal, { campo: 'Precio total', min: 0 })
  if (cotizacion.costoEstimadoTotal != null) {
    validarMonto(cotizacion.costoEstimadoTotal, { campo: 'Costo estimado total', min: 0 })
  }
  const numero = generarConsecutivo(db, 'pedido')
  const motivo = descuento?.motivo?.trim() || null
  const pedido = db
    .insert(pedidos)
    .values({
      numero,
      clienteId: datos.clienteId,
      tipoTrabajo: datos.tipoTrabajo,
      descripcion: datos.descripcion ?? null,
      anchoCm: datos.anchoCm ?? null,
      altoCm: datos.altoCm ?? null,
      anchoPaspartuCm: datos.anchoPaspartuCm ?? null,
      tipoPaspartu: datos.tipoPaspartu ?? null,
      tipoVidrio: datos.tipoVidrio ?? null,
      porcentajeMateriales: datos.porcentajeMateriales ?? 10,
      subtotal: cotizacion.subtotal,
      totalMateriales: cotizacion.totalMateriales,
      brutoCotizado: cotizacion.brutoCotizado,
      precioLista,
      descuentoMonto: evaluacion.descuentoMonto,
      descuentoMotivo: motivo,
      costoEstimadoTotal: cotizacion.costoEstimadoTotal,
      margenEstimado: evaluacion.margenEstimado,
      margenEstimadoPct: evaluacion.margenEstimadoPct,
      estadoRentabilidad: evaluacion.estadoRentabilidad,
      precioTotal: evaluacion.precioFinal,
      estado: 'cotizado',
      tipoEntrega: datos.tipoEntrega ?? 'estandar',
      fechaIngreso: datos.fechaIngreso,
      fechaEntrega: datos.fechaEntrega ?? null,
      notas: datos.notas ?? null
    })
    .returning()
    .get()

  for (const item of cotizacion.items) {
    db.insert(pedidoItems)
      .values({
        pedidoId: pedido.id,
        tipoItem: item.tipoItem,
        descripcion: item.descripcion ?? null,
        referencia: item.referencia ?? null,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario ?? null,
        costoUnitarioEstimado: item.costoUnitarioEstimado ?? null,
        subtotal: item.subtotal,
        subtotalCostoEstimado: item.subtotalCostoEstimado ?? null,
        metadata: item.metadata ?? null
      })
      .run()
  }

  // Ítem descuento: solo aporta `subtotal` negativo. `precioUnitario` queda
  // null porque el descuento no es un producto cobrable — antes guardábamos
  // el monto positivo en precioUnitario y subtotal negativo, lo que producía
  // líneas contradictorias en el PDF (ej "Cliente frecuente · 1 · $5.000 · -$5.000").
  // El motivo va al campo `descuentoMotivo` del pedido (fuente única de verdad)
  // y se replica en el ítem solo como descripción legible.
  if (evaluacion.descuentoMonto > 0) {
    db.insert(pedidoItems)
      .values({
        pedidoId: pedido.id,
        tipoItem: 'descuento',
        descripcion: motivo || 'Descuento manual',
        cantidad: 1,
        precioUnitario: null,
        costoUnitarioEstimado: null,
        subtotal: -evaluacion.descuentoMonto,
        subtotalCostoEstimado: null,
        metadata: null
      })
      .run()
  }

  return pedido
}

export function crearPedidoDesdeCotizacion(
  db: DB,
  datos: NuevoPedidoDatos,
  cotizacion: ResultadoCotizacion
) {
  validarFechasPedido(datos)
  const cotizacionValidada = cotizacionAutorizada(db, datos, cotizacion)

  return db.transaction((tx) => {
    return insertarPedidoDesdeCotizacion(tx as unknown as DB, datos, cotizacionValidada, null)
  })
}

function categoriaDesdePedido(tipoTrabajo: TipoTrabajo) {
  if (tipoTrabajo === 'restauracion') return 'restauracion'
  return 'enmarcacion'
}

// ===========================================================================
// crearPedidoDirecto — feature "pedido sin pasar por cotizador"
//
// Permite registrar un pedido completo (cliente + items + factura + pago
// opcional) en una sola transacción atómica, SIN validar precios contra las
// listas actuales (a diferencia de `crearPedidoConfirmadoConFactura` que
// re-autoriza vía `cotizacionAutorizada`).
//
// Casos de uso (P1 de la spec):
//   - Pedido rápido del momento donde el dueño ya sabe el precio.
//   - Registro retroactivo de pedidos pasados (incluso `entregado`).
//   - Pedidos con precios "históricos" que no calzan con la lista actual.
//
// Decisión P16 (modo B): el override de precio total NO se materializa como
// descuento. `descuentoMonto = 0` siempre. Los items mantienen sus precios
// reales; `precioTotal` se guarda directo. Esto refleja la realidad del
// negocio (precio histórico ≠ descuento) y mantiene los reportes de
// descuentos limpios.
// ===========================================================================

const ITEMS_OBLIGATORIOS_MIN = 1

export function crearPedidoDirecto(
  db: DB,
  input: CrearPedidoDirectoInput
): CrearPedidoDirectoResult {
  // ---- 1. Validaciones síncronas (antes de abrir transacción) ----
  validarFechaISO(input.pedido.fechaIngreso, 'YYYY-MM-DD', 'fechaIngreso')
  if (input.pedido.fechaEntrega) {
    validarFechaISO(input.pedido.fechaEntrega, 'YYYY-MM-DD', 'fechaEntrega')
    if (input.pedido.fechaEntrega < input.pedido.fechaIngreso) {
      throw new Error('La fecha de entrega no puede ser anterior a la fecha de ingreso')
    }
  }
  validarFechaISO(input.factura.fecha, 'YYYY-MM-DD', 'facturaFecha')
  validarEnum(input.pedido.tipoTrabajo, TIPOS_TRABAJO, 'tipoTrabajo')
  validarEnum(input.pedido.tipoEntrega, TIPOS_ENTREGA, 'tipoEntrega')
  validarEnum(input.pedido.estadoInicial, ESTADOS_PEDIDO, 'estadoInicial')
  if (input.pedido.estadoInicial === 'cancelado') {
    throw new Error('No se puede crear un pedido directamente en estado cancelado')
  }

  if (!Array.isArray(input.items) || input.items.length < ITEMS_OBLIGATORIOS_MIN) {
    throw new Error('El pedido debe tener al menos un item')
  }
  for (const [i, item] of input.items.entries()) {
    if (!item.descripcion || !item.descripcion.trim()) {
      throw new Error(`Item #${i + 1}: descripción requerida`)
    }
    // validarMonto rechaza Infinity/NaN/no-números — protege contra payloads
    // de IPC corruptos que pasen el typing de TypeScript (ver informe 318aa85).
    validarMonto(item.cantidad, {
      campo: `Item #${i + 1}: cantidad`,
      // > 0 estricto: validarMonto valida `>= min`, así que 0.0001 actúa como
      // "estrictamente mayor a 0" para cantidades fraccionarias permitidas.
      min: Number.MIN_VALUE
    })
    validarMonto(item.precioUnitario, {
      campo: `Item #${i + 1}: precio unitario`,
      min: 0
    })
    if (item.costoUnitarioEstimado != null) {
      validarMonto(item.costoUnitarioEstimado, {
        campo: `Item #${i + 1}: costo estimado`,
        min: 0
      })
    }
    // v2.3.0 — validar trabajoNombre si está presente (longitud razonable,
    // protege la factura PDF de strings absurdamente largos que rompan el
    // layout). Si llega null/undefined, se permite (item suelto).
    if (item.trabajoNombre != null) {
      if (typeof item.trabajoNombre !== 'string') {
        throw new Error(`Item #${i + 1}: trabajoNombre debe ser texto`)
      }
      if (item.trabajoNombre.length > 200) {
        throw new Error(`Item #${i + 1}: el nombre del trabajo no puede exceder 200 caracteres`)
      }
    }
  }

  // v2.3.0 — Mapeo de trabajos: el frontend usa UUIDs (`trabajoIdLocal`) para
  // agrupar items que pertenecen al mismo "trabajo" (ej. "Cuadro de la
  // abuela"). Aquí los convertimos a `trabajoId` numérico 1-indexed (el
  // formato que ya usa el flujo multi-trabajo del cotizador desde v2.2.0).
  // Items sin `trabajoIdLocal` son "sueltos" — no llevan `trabajoId` en
  // metadata, comportamiento idéntico al pre-v2.3.0.
  const mapaTrabajos = new Map<string, { trabajoId: number; nombre: string }>()
  let trabajoIdCounter = 0
  for (const [i, item] of input.items.entries()) {
    if (!item.trabajoIdLocal) continue
    if (!mapaTrabajos.has(item.trabajoIdLocal)) {
      // Nombre del trabajo: viene del primer item con este idLocal. Si está
      // vacío o es solo whitespace, default a "Trabajo N" (consistente con
      // la regla de UX). Items subsiguientes con el mismo idLocal pueden
      // venir con otro nombre — usamos el primero (defense + log).
      trabajoIdCounter += 1
      const nombreCrudo = (item.trabajoNombre ?? '').trim()
      const nombre = nombreCrudo.length > 0 ? nombreCrudo : `Trabajo ${trabajoIdCounter}`
      mapaTrabajos.set(item.trabajoIdLocal, { trabajoId: trabajoIdCounter, nombre })
    } else {
      // Defense in depth: si dos items con el mismo trabajoIdLocal traen
      // nombres distintos, conservamos el primero pero advertimos. Un
      // frontend bien implementado nunca debería caer aquí.
      const existente = mapaTrabajos.get(item.trabajoIdLocal)!
      const nombreActual = (item.trabajoNombre ?? '').trim()
      if (nombreActual && nombreActual !== existente.nombre) {
        console.warn(
          `[crearPedidoDirecto] Item #${i + 1} tiene trabajoNombre "${nombreActual}" pero el trabajo ${existente.trabajoId} ya estaba registrado con nombre "${existente.nombre}". Usando el primero.`
        )
      }
    }
  }

  // Si hay trabajos definidos, validar que cada uno tenga ≥1 item. (Por
  // construcción del map siempre hay ≥1, pero por defense lo verificamos.)
  // Además: si hay ≥2 trabajos distintos, el tipoTrabajo del pedido se
  // reemplaza por 'mixto' (consistente con `crearPedidoMultiTrabajo`).
  const hayMultipleTrabajos = mapaTrabajos.size >= 2
  const tipoTrabajoPedido: typeof input.pedido.tipoTrabajo = hayMultipleTrabajos
    ? 'mixto'
    : input.pedido.tipoTrabajo

  // ---- 2. Cálculos derivados ----
  // Cada producto/suma se re-valida con validarMonto. Inputs finitos pueden
  // multiplicarse a Infinity (1e308 * 1e308) o sumarse a Infinity sin que los
  // chequeos individuales lo detecten — ese es el bug del informe 318aa85.
  const subtotalItems = validarMonto(
    input.items.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0),
    { campo: 'Subtotal de items', min: 0 }
  )
  const precioFinal = validarMonto(
    input.precioTotalOverride != null ? input.precioTotalOverride : subtotalItems,
    { campo: 'Precio total', min: 0 }
  )

  // costoEstimadoTotal: si TODOS los items tienen costo, sumamos. Si alguno
  // viene en `null`, marcamos `null` (rentabilidad = 'incompleta').
  const todosTienenCosto = input.items.every(
    (it) => typeof it.costoUnitarioEstimado === 'number'
  )
  const costoEstimadoTotal = todosTienenCosto
    ? validarMonto(
        input.items.reduce((s, it) => s + it.cantidad * (it.costoUnitarioEstimado ?? 0), 0),
        { campo: 'Costo estimado total', min: 0 }
      )
    : null

  // ---- 3. Validación de abono (antes de abrir tx) ----
  const abono = input.abono?.monto ?? 0
  if (input.abono) {
    validarMonto(abono, { campo: 'Abono', min: 0 })
    if (abono > precioFinal) {
      throw new Error(`El abono excede el total del pedido (${precioFinal})`)
    }
    if (abono > 0) {
      validarEnum(input.abono.metodoPago, METODOS_PAGO, 'metodoPago')
      validarFechaISO(input.abono.fecha, 'YYYY-MM-DD', 'fechaPago')
      // Una fecha de pago en el futuro no tiene sentido — el cobro
      // todavía no ha ocurrido. Reportes de finanzas contarían ingresos
      // que no existen. Comparación lexicográfica funciona porque ambas
      // son ISO `YYYY-MM-DD`.
      const hoy = new Date()
      const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      if (input.abono.fecha > hoyISO) {
        throw new Error('La fecha del pago no puede ser posterior a hoy')
      }
    }
  }

  // Re-evaluar margen con la lógica compartida del cotizador (mismas reglas).
  const evaluacion = evaluarPedido(db, precioFinal, 0, costoEstimadoTotal)

  // ---- 4. Transacción atómica ----
  return db.transaction((tx) => {
    const txDb = tx as unknown as DB

    // 4a. Resolver cliente: existente o crear nuevo.
    let clienteId: number
    if (input.cliente.tipo === 'existente') {
      const existe = txDb
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.id, input.cliente.id))
        .get()
      if (!existe) throw new Error(`El cliente ${input.cliente.id} no existe`)
      clienteId = input.cliente.id
    } else {
      const nuevo = crearCliente(txDb, input.cliente.data)
      clienteId = nuevo.id
    }

    // 4b. Insertar pedido en estado 'cotizado' (consistente con el flujo
    //     del wizard — todas las transiciones pasan por aquí).
    const numero = generarConsecutivo(txDb, 'pedido')
    const pedidoCreado = tx
      .insert(pedidos)
      .values({
        numero,
        clienteId,
        tipoTrabajo: tipoTrabajoPedido,
        descripcion: input.pedido.descripcion ?? null,
        anchoCm: input.pedido.anchoCm ?? null,
        altoCm: input.pedido.altoCm ?? null,
        // En pedido directo el papá define el precio final por item — los
        // materiales (5-10%) NO se calculan automáticamente. Mínimo 5 para
        // satisfacer el CHECK constraint del schema.
        porcentajeMateriales: 5,
        subtotal: subtotalItems,
        totalMateriales: 0,
        brutoCotizado: subtotalItems,
        precioLista: precioFinal,
        descuentoMonto: 0,
        descuentoMotivo: null,
        costoEstimadoTotal,
        margenEstimado: evaluacion.margenEstimado,
        margenEstimadoPct: evaluacion.margenEstimadoPct,
        estadoRentabilidad: evaluacion.estadoRentabilidad,
        precioTotal: precioFinal,
        estado: 'cotizado',
        tipoEntrega: input.pedido.tipoEntrega,
        fechaIngreso: input.pedido.fechaIngreso,
        fechaEntrega: input.pedido.fechaEntrega ?? null,
        notas: input.pedido.notas ?? null
      })
      .returning()
      .get()

    // 4c. Insertar items.
    for (const item of input.items) {
      // Defense in depth: aunque subtotalItems global ya está validado, cada
      // producto por-item también podría overflow si los inputs son extremos.
      // Validar antes del insert evita filas con `Infinity` en pedido_items.
      const descripcionItem = item.descripcion.trim()
      const subtotalItem = validarMonto(item.cantidad * item.precioUnitario, {
        campo: `Item "${descripcionItem}": subtotal`,
        min: 0
      })
      const subtotalCosto =
        item.costoUnitarioEstimado != null
          ? validarMonto(item.cantidad * item.costoUnitarioEstimado, {
              campo: `Item "${descripcionItem}": subtotal de costo`,
              min: 0
            })
          : null
      // v2.3.0 — Enriquecer metadata con info del trabajo si el item lo trae.
      // Mergeamos sobre cualquier metadata previa (geometría, etc.). Items
      // sin trabajoIdLocal quedan con su metadata original (o null) —
      // comportamiento pre-v2.3.0 intacto para pedidos directos "simples".
      const trabajoInfo = item.trabajoIdLocal ? mapaTrabajos.get(item.trabajoIdLocal) : undefined
      const metadataFinal = trabajoInfo
        ? {
            ...(item.metadata ?? {}),
            trabajoId: trabajoInfo.trabajoId,
            trabajoNombre: trabajoInfo.nombre
          }
        : (item.metadata ?? null)
      // Mapeo: si el caller manda 'otro', guardamos 'otro' en el enum.
      // Ese valor ya está en TIPOS_ITEM_PEDIDO por compatibilidad histórica.
      tx.insert(pedidoItems)
        .values({
          pedidoId: pedidoCreado.id,
          tipoItem: item.tipoItem === 'otro' ? 'otro' : item.tipoItem,
          descripcion: descripcionItem,
          referencia: item.referencia ?? null,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          costoUnitarioEstimado: item.costoUnitarioEstimado ?? null,
          subtotal: subtotalItem,
          subtotalCostoEstimado: subtotalCosto,
          metadata: metadataFinal
        })
        .run()
    }

    // 4d. Aplicar transiciones de estado hasta `estadoInicial`.
    // Ej. si estadoInicial='entregado', recorremos cotizado → confirmado →
    // en_proceso → listo → entregado, validando cada paso e insertando
    // historial. Para casos retroactivos, usamos `fechaIngreso` como
    // timestamp del historial (no `now()`) para que las fechas reflejen
    // cuándo ocurrió realmente el cambio.
    const estadoFinal = input.pedido.estadoInicial
    let estadoActual: EstadoPedido = 'cotizado'
    if (estadoFinal !== 'cotizado') {
      const camino = construirCaminoTransiciones('cotizado', estadoFinal)
      const fechaHistorial = input.pedido.fechaIngreso
      for (const siguiente of camino) {
        tx.insert(historialCambios)
          .values({
            tabla: 'pedidos',
            registroId: pedidoCreado.id,
            campo: 'estado',
            valorAnterior: estadoActual,
            valorNuevo: siguiente,
            fecha: sql`(datetime(${fechaHistorial}))`
          })
          .run()
        estadoActual = siguiente
      }
      // En retroactivos, `updatedAt` debe reflejar la fecha histórica del
      // pedido (consistente con `historialCambios`). Sin esto, un pedido
      // creado para 2025-03-01 aparecía como "modificado hoy" en reportes
      // y filtros por última actualización.
      tx.update(pedidos)
        .set({
          estado: estadoFinal,
          updatedAt: sql`(datetime(${fechaHistorial}))`
        })
        .where(eq(pedidos.id, pedidoCreado.id))
        .run()
    }

    // Re-leemos el pedido para obtener el estado actualizado y todos los
    // campos auto-calculados que quedaron en la fila.
    const pedido = txDb
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, pedidoCreado.id))
      .get()!

    // 4e. Insertar factura.
    const factura = tx
      .insert(facturas)
      .values({
        numero: generarConsecutivo(txDb, 'factura'),
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        fecha: input.factura.fecha,
        total: precioFinal,
        fechaEntrega: pedido.fechaEntrega ?? null,
        notas: input.factura.notas ?? null
      })
      .returning()
      .get()

    let pago: typeof pagos.$inferSelect | null = null
    let saldo = factura.total

    // 4f. Caso especial: si total = 0 (regalo), factura → pagada inmediato.
    if (precioFinal === 0) {
      tx.update(facturas)
        .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
        .where(eq(facturas.id, factura.id))
        .run()
      factura.estado = 'pagada'
      saldo = 0
    } else if (input.abono && abono > 0) {
      // 4g. Insertar pago + movimiento financiero.
      pago = tx
        .insert(pagos)
        .values({
          facturaId: factura.id,
          monto: abono,
          metodoPago: input.abono.metodoPago,
          fecha: input.abono.fecha,
          notas: input.abono.notas ?? null
        })
        .returning()
        .get()

      tx.insert(movimientosFinancieros)
        .values({
          tipo: 'ingreso',
          categoria: categoriaDesdePedido(pedido.tipoTrabajo as TipoTrabajo),
          descripcion: `Pago factura ${factura.numero}`,
          monto: abono,
          fecha: input.abono.fecha,
          referenciaTipo: 'pago',
          referenciaId: pago.id
        })
        .run()

      saldo = factura.total - abono
      if (saldo <= 0) {
        tx.update(facturas)
          .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
          .where(eq(facturas.id, factura.id))
          .run()
        factura.estado = 'pagada'
      }
    }

    return { pedido, factura, pago, saldo }
  })
}

/**
 * Construye un camino válido de transiciones desde `desde` hasta `hasta` usando
 * `TRANSICIONES_VALIDAS`. Para los estados normales (cotizado → confirmado →
 * en_proceso → listo → entregado) hay un único camino lineal. Para casos
 * especiales (cancelado, sin_reclamar) se busca el primer camino válido.
 */
function construirCaminoTransiciones(
  desde: EstadoPedido,
  hasta: EstadoPedido
): EstadoPedido[] {
  if (desde === hasta) return []
  // BFS simple con cap de profundidad — el grafo de transiciones es chico.
  const cola: { estado: EstadoPedido; camino: EstadoPedido[] }[] = [
    { estado: desde, camino: [] }
  ]
  const visitados = new Set<EstadoPedido>([desde])
  while (cola.length > 0) {
    const { estado, camino } = cola.shift()!
    const siguientes = TRANSICIONES_VALIDAS[estado] ?? []
    for (const sig of siguientes) {
      if (visitados.has(sig)) continue
      const nuevoCamino = [...camino, sig]
      if (sig === hasta) return nuevoCamino
      visitados.add(sig)
      cola.push({ estado: sig, camino: nuevoCamino })
    }
  }
  throw new Error(
    `No existe camino válido de transiciones de "${desde}" a "${hasta}"`
  )
}

export function crearPedidoConfirmadoConFactura(
  db: DB,
  input: CrearPedidoConfirmadoData
): CrearPedidoConfirmadoResult {
  validarFechasPedido(input.datos)
  validarFechaISO(input.facturaFecha, 'YYYY-MM-DD', 'facturaFecha')
  const cotizacionValidada = cotizacionAutorizada(db, input.datos, input.cotizacion)
  const descuento = input.descuento ?? null
  const descuentoMonto = descuento?.monto ?? 0
  validarMonto(descuentoMonto, { campo: 'Descuento', min: 0 })
  validarMonto(cotizacionValidada.precioLista, { campo: 'Precio de lista', min: 0 })
  if (descuentoMonto > cotizacionValidada.precioLista) {
    throw new Error(`El descuento excede el precio sugerido del pedido (${cotizacionValidada.precioLista})`)
  }
  // Re-validar el total derivado: aunque ambos operandos están validados, el
  // resultado podría ser no-finito si los inputs son extremos (informe 318aa85).
  const totalFinal = validarMonto(cotizacionValidada.precioLista - descuentoMonto, {
    campo: 'Total del pedido',
    min: 0
  })
  const abono = input.abono?.monto ?? 0
  validarMonto(abono, { campo: 'Abono', min: 0 })
  if (abono > totalFinal) {
    throw new Error(`El abono excede el total del pedido (${totalFinal})`)
  }
  if (input.abono && abono > 0) {
    validarEnum(input.abono.metodoPago, METODOS_PAGO, 'metodoPago')
    validarFechaISO(input.abono.fecha, 'YYYY-MM-DD', 'fechaPago')
  }

  return db.transaction((tx) => {
    const txDb = tx as unknown as DB
    const pedidoCotizado = insertarPedidoDesdeCotizacion(txDb, input.datos, cotizacionValidada, descuento)
    const pedido = tx
      .update(pedidos)
      .set({ estado: 'confirmado', updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, pedidoCotizado.id))
      .returning()
      .get()

    tx.insert(historialCambios)
      .values({
        tabla: 'pedidos',
        registroId: pedido.id,
        campo: 'estado',
        valorAnterior: 'cotizado',
        valorNuevo: 'confirmado',
        fecha: sql`(datetime('now'))`
      })
      .run()

    const factura = tx
      .insert(facturas)
      .values({
        numero: generarConsecutivo(txDb, 'factura'),
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        fecha: input.facturaFecha,
        total: totalFinal,
        fechaEntrega: pedido.fechaEntrega ?? null
      })
      .returning()
      .get()

    let pago: typeof pagos.$inferSelect | null = null
    let saldo = factura.total

    // D3 — Regalo: si el descuento equivale al precio total (totalFinal=0)
    // marcamos la factura como pagada inmediatamente. NO se crea movimiento
    // financiero porque no hubo ingreso real, y NO se acepta abono (ya
    // bloqueado por la validación `abono > totalFinal`).
    if (totalFinal === 0) {
      tx.update(facturas)
        .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
        .where(eq(facturas.id, factura.id))
        .run()
      factura.estado = 'pagada'
      saldo = 0
    } else if (input.abono && abono > 0) {
      pago = tx
        .insert(pagos)
        .values({
          facturaId: factura.id,
          monto: abono,
          metodoPago: input.abono.metodoPago,
          fecha: input.abono.fecha,
          notas: input.abono.notas ?? null
        })
        .returning()
        .get()

      tx.insert(movimientosFinancieros)
        .values({
          tipo: 'ingreso',
          categoria: categoriaDesdePedido(pedido.tipoTrabajo as TipoTrabajo),
          descripcion: `Pago factura ${factura.numero}`,
          monto: abono,
          fecha: input.abono.fecha,
          referenciaTipo: 'pago',
          referenciaId: pago.id
        })
        .run()

      saldo = factura.total - abono
      if (saldo <= 0) {
        tx.update(facturas)
          .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
          .where(eq(facturas.id, factura.id))
          .run()
        factura.estado = 'pagada'
      }
    }

    return { pedido, factura, pago, saldo }
  })
}

/**
 * Crea un pedido con N trabajos en una sola transacción atómica. Soporta
 * tipos de trabajo distintos en el mismo pedido (caso real: cliente que
 * llega con un cuadro estándar y una restauración). Cada trabajo aporta
 * sus items aplanados a `pedido_items` con `metadata.trabajoId` para que
 * la UI y el PDF puedan agruparlos visualmente.
 *
 * El descuento es global al total del pedido (decisión de producto P19).
 * El abono también es a nivel pedido — todo o nada, no por trabajo.
 *
 * Estado inicial: 'confirmado' (skipea cotizado, igual que crearPedidoDirecto
 * cuando estadoInicial === 'confirmado'). Multi-trabajo asume que el cliente
 * ya aprobó al ver el desglose en pantalla.
 */
export function crearPedidoMultiTrabajo(
  db: DB,
  input: CrearPedidoMultiTrabajoInput
): CrearPedidoMultiTrabajoResult {
  // ---- 1. Validaciones síncronas (antes de abrir transacción) ----
  validarFechaISO(input.pedido.fechaIngreso, 'YYYY-MM-DD', 'fechaIngreso')
  if (input.pedido.fechaEntrega) {
    validarFechaISO(input.pedido.fechaEntrega, 'YYYY-MM-DD', 'fechaEntrega')
    if (input.pedido.fechaEntrega < input.pedido.fechaIngreso) {
      throw new Error('La fecha de entrega no puede ser anterior a la fecha de ingreso')
    }
  }
  validarFechaISO(input.factura.fecha, 'YYYY-MM-DD', 'facturaFecha')
  validarEnum(input.pedido.tipoEntrega, TIPOS_ENTREGA, 'tipoEntrega')

  if (!Array.isArray(input.trabajos) || input.trabajos.length < 1) {
    throw new Error('El pedido debe tener al menos un trabajo')
  }

  // ---- 2. Validar y autorizar cada cotización (mismo guard que el flujo
  //         de cotización individual: re-deriva la cotización desde los
  //         datos y compara, impide manipulación de precios vía IPC).
  const trabajosValidados = input.trabajos.map((trabajo, idx) => {
    validarEnum(
      trabajo.tipoTrabajo,
      TIPOS_TRABAJO_CONCRETO,
      `Trabajo #${idx + 1}: tipoTrabajo`
    )
    if (trabajo.datos.tipoTrabajo !== trabajo.tipoTrabajo) {
      throw new Error(
        `Trabajo #${idx + 1}: tipoTrabajo del trabajo (${trabajo.tipoTrabajo}) no coincide con datos.tipoTrabajo (${trabajo.datos.tipoTrabajo})`
      )
    }
    const cotizacion = cotizacionAutorizada(db, trabajo.datos, trabajo.cotizacion)
    // Defense in depth (mismo patrón que insertarPedidoDesdeCotizacion):
    // validamos cada monto persistido — no solo precioLista — para que
    // valores no-finitos derivados de la cotización (ej. restauración con
    // overflow) no entren a la DB. Sin esto, los aggregates de las líneas
    // de abajo podrían sumar Infinity en pedidos.{subtotal,totalMateriales,
    // brutoCotizado} a pesar de que el CHECK SQLite >= 0 acepta Infinity.
    validarMonto(cotizacion.subtotal, {
      campo: `Trabajo #${idx + 1}: subtotal`,
      min: 0
    })
    validarMonto(cotizacion.totalMateriales, {
      campo: `Trabajo #${idx + 1}: total de materiales`,
      min: 0
    })
    validarMonto(cotizacion.brutoCotizado, {
      campo: `Trabajo #${idx + 1}: bruto cotizado`,
      min: 0
    })
    validarMonto(cotizacion.precioLista, {
      campo: `Trabajo #${idx + 1}: precio de lista`,
      min: 0
    })
    return { ...trabajo, cotizacion }
  })

  // ---- 3. Calcular agregados del pedido ----
  const subtotalTrabajos = validarMonto(
    trabajosValidados.reduce((s, t) => s + t.cotizacion.precioLista, 0),
    { campo: 'Subtotal del pedido', min: 0 }
  )
  const descuento = input.descuento ?? null
  const descuentoMonto = descuento?.monto ?? 0
  validarMonto(descuentoMonto, { campo: 'Descuento', min: 0 })
  if (descuentoMonto > subtotalTrabajos) {
    throw new Error(
      `El descuento (${descuentoMonto}) excede el subtotal del pedido (${subtotalTrabajos})`
    )
  }
  const totalFinal = validarMonto(subtotalTrabajos - descuentoMonto, {
    campo: 'Total del pedido',
    min: 0
  })

  // ---- 4. Validar abono ----
  const abono = input.abono?.monto ?? 0
  validarMonto(abono, { campo: 'Abono', min: 0 })
  if (abono > totalFinal) {
    throw new Error(`El abono excede el total del pedido (${totalFinal})`)
  }
  if (input.abono && abono > 0) {
    validarEnum(input.abono.metodoPago, METODOS_PAGO, 'metodoPago')
    validarFechaISO(input.abono.fecha, 'YYYY-MM-DD', 'fechaPago')
  }

  // ---- 5. Decidir tipoTrabajo del pedido contenedor ----
  const tiposUnicos = Array.from(new Set(trabajosValidados.map((t) => t.tipoTrabajo)))
  const tipoTrabajoPedido: TipoTrabajo =
    tiposUnicos.length === 1 ? tiposUnicos[0]! : 'mixto'

  // ---- 6. Costo y evaluación del pedido completo ----
  // Si CUALQUIER trabajo no tiene costo, costoEstimadoTotal queda null
  // (rentabilidad = 'incompleta'), igual que en crearPedidoDirecto.
  const costos = trabajosValidados.map((t) => t.cotizacion.costoEstimadoTotal)
  const todosTienenCosto = costos.every((c) => c !== null && c !== undefined)
  const costoEstimadoTotal = todosTienenCosto
    ? validarMonto(
        costos.reduce((s, c) => s + (c ?? 0), 0),
        { campo: 'Costo estimado total', min: 0 }
      )
    : null
  const evaluacion = evaluarPedido(db, subtotalTrabajos, descuentoMonto, costoEstimadoTotal)
  // evaluarPedido puede propagar no-finitos en margenEstimado/precioFinal
  // si los inputs derivan en cancelaciones extremas; revalidamos antes del
  // insert (paridad con insertarPedidoDesdeCotizacion líneas 424-425).
  validarMonto(evaluacion.descuentoMonto, { campo: 'Descuento aplicado', min: 0 })
  validarMonto(evaluacion.precioFinal, { campo: 'Precio total del pedido', min: 0 })

  // Aggregates de los campos crudos del pedido contenedor. Cada operando
  // ya pasó por validarMonto en el .map anterior, pero la SUMA puede
  // overflow a Infinity entre múltiples trabajos. Re-validamos.
  const subtotalAgregado = validarMonto(
    trabajosValidados.reduce((s, t) => s + t.cotizacion.subtotal, 0),
    { campo: 'Subtotal agregado del pedido', min: 0 }
  )
  const totalMaterialesAgregado = validarMonto(
    trabajosValidados.reduce((s, t) => s + t.cotizacion.totalMateriales, 0),
    { campo: 'Total de materiales agregado', min: 0 }
  )
  const brutoCotizadoAgregado = validarMonto(
    trabajosValidados.reduce((s, t) => s + t.cotizacion.brutoCotizado, 0),
    { campo: 'Bruto cotizado agregado', min: 0 }
  )

  // ---- 7. Transacción atómica ----
  return db.transaction((tx) => {
    const txDb = tx as unknown as DB

    // 7a. Resolver cliente: existente o nuevo.
    let clienteId: number
    if (input.cliente.tipo === 'existente') {
      const existe = txDb
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.id, input.cliente.id))
        .get()
      if (!existe) throw new Error(`El cliente ${input.cliente.id} no existe`)
      clienteId = input.cliente.id
    } else {
      const nuevo = crearCliente(txDb, input.cliente.data)
      clienteId = nuevo.id
    }

    // 7b. Insertar pedido contenedor. Para 1 trabajo, copiamos sus campos
    //     al encabezado (compatible con queries pre-mixto). Para varios,
    //     dejamos null y la info vive en metadata por item.
    const trabajoUnico = trabajosValidados.length === 1 ? trabajosValidados[0]! : null
    const numero = generarConsecutivo(txDb, 'pedido')
    const pedidoCreado = tx
      .insert(pedidos)
      .values({
        numero,
        clienteId,
        tipoTrabajo: tipoTrabajoPedido,
        descripcion:
          trabajosValidados.length > 1
            ? `${trabajosValidados.length} trabajos`
            : (trabajoUnico?.datos.descripcion ?? null),
        anchoCm: trabajoUnico?.datos.anchoCm ?? null,
        altoCm: trabajoUnico?.datos.altoCm ?? null,
        anchoPaspartuCm: trabajoUnico?.datos.anchoPaspartuCm ?? null,
        tipoPaspartu: trabajoUnico?.datos.tipoPaspartu ?? null,
        tipoVidrio: trabajoUnico?.datos.tipoVidrio ?? null,
        porcentajeMateriales: trabajoUnico?.datos.porcentajeMateriales ?? 10,
        subtotal: subtotalAgregado,
        totalMateriales: totalMaterialesAgregado,
        brutoCotizado: brutoCotizadoAgregado,
        precioLista: subtotalTrabajos,
        descuentoMonto,
        descuentoMotivo: descuento?.motivo?.trim() || null,
        costoEstimadoTotal,
        margenEstimado: evaluacion.margenEstimado,
        margenEstimadoPct: evaluacion.margenEstimadoPct,
        estadoRentabilidad: evaluacion.estadoRentabilidad,
        precioTotal: totalFinal,
        estado: 'confirmado',
        tipoEntrega: input.pedido.tipoEntrega,
        fechaIngreso: input.pedido.fechaIngreso,
        fechaEntrega: input.pedido.fechaEntrega ?? null,
        notas: input.pedido.notas ?? null
      })
      .returning()
      .get()

    // 7c. Insertar items por trabajo, anotando metadata.trabajoId.
    const trabajoIds: number[] = []
    trabajosValidados.forEach((trabajo, idx) => {
      const trabajoId = idx + 1
      trabajoIds.push(trabajoId)
      const metadataTrabajo: PedidoItemMetadata = {
        trabajoId,
        tipoTrabajoOrigen: trabajo.tipoTrabajo
      }
      if (trabajo.datos.anchoCm != null && trabajo.datos.altoCm != null) {
        metadataTrabajo.medidas = {
          anchoCm: trabajo.datos.anchoCm,
          altoCm: trabajo.datos.altoCm
        }
      }
      if (trabajo.datos.muestraMarcoId != null) {
        metadataTrabajo.muestraMarcoId = trabajo.datos.muestraMarcoId
      }
      if (trabajo.datos.tipoVidrio) metadataTrabajo.tipoVidrio = trabajo.datos.tipoVidrio
      if (trabajo.datos.anchoPaspartuCm != null) {
        metadataTrabajo.anchoPaspartuCm = trabajo.datos.anchoPaspartuCm
      }
      if (trabajo.datos.tipoPaspartu) metadataTrabajo.tipoPaspartu = trabajo.datos.tipoPaspartu

      for (const item of trabajo.cotizacion.items) {
        const baseMetadata = (item.metadata ?? {}) as PedidoItemMetadata
        tx.insert(pedidoItems)
          .values({
            pedidoId: pedidoCreado.id,
            tipoItem: item.tipoItem,
            descripcion: item.descripcion ?? null,
            referencia: item.referencia ?? null,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario ?? null,
            costoUnitarioEstimado: item.costoUnitarioEstimado ?? null,
            subtotal: item.subtotal,
            subtotalCostoEstimado: item.subtotalCostoEstimado ?? null,
            metadata: { ...baseMetadata, ...metadataTrabajo }
          })
          .run()
      }
    })

    // 7d. Item de descuento global (si > 0). Sin trabajoId — es del pedido
    //     entero, no de un trabajo específico.
    if (descuentoMonto > 0) {
      tx.insert(pedidoItems)
        .values({
          pedidoId: pedidoCreado.id,
          tipoItem: 'descuento',
          descripcion: descuento?.motivo?.trim() || 'Descuento manual',
          cantidad: 1,
          precioUnitario: null,
          costoUnitarioEstimado: null,
          subtotal: -descuentoMonto,
          subtotalCostoEstimado: null,
          metadata: null
        })
        .run()
    }

    // 7e. Historial: cotizado → confirmado.
    tx.insert(historialCambios)
      .values({
        tabla: 'pedidos',
        registroId: pedidoCreado.id,
        campo: 'estado',
        valorAnterior: 'cotizado',
        valorNuevo: 'confirmado',
        fecha: sql`(datetime('now'))`
      })
      .run()

    // 7f. Insertar factura.
    const factura = tx
      .insert(facturas)
      .values({
        numero: generarConsecutivo(txDb, 'factura'),
        pedidoId: pedidoCreado.id,
        clienteId,
        fecha: input.factura.fecha,
        total: totalFinal,
        fechaEntrega: input.pedido.fechaEntrega ?? null,
        notas: input.factura.notas ?? null
      })
      .returning()
      .get()

    let pago: typeof pagos.$inferSelect | null = null
    let saldo = factura.total

    // 7g. Regalo (totalFinal=0): factura pagada inmediato sin movimiento.
    if (totalFinal === 0) {
      tx.update(facturas)
        .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
        .where(eq(facturas.id, factura.id))
        .run()
      factura.estado = 'pagada'
      saldo = 0
    } else if (input.abono && abono > 0) {
      // 7h. Pago + movimiento financiero.
      pago = tx
        .insert(pagos)
        .values({
          facturaId: factura.id,
          monto: abono,
          metodoPago: input.abono.metodoPago,
          fecha: input.abono.fecha,
          notas: input.abono.notas ?? null
        })
        .returning()
        .get()

      // Categoría: para pedidos mixtos usamos 'enmarcacion' (caso típico).
      // Si en el futuro se quiere desagregar el ingreso por tipo de trabajo,
      // habría que crear N movimientos proporcionales — fuera de scope hoy.
      tx.insert(movimientosFinancieros)
        .values({
          tipo: 'ingreso',
          categoria:
            tipoTrabajoPedido === 'restauracion' ? 'restauracion' : 'enmarcacion',
          descripcion: `Pago factura ${factura.numero}`,
          monto: abono,
          fecha: input.abono.fecha,
          referenciaTipo: 'pago',
          referenciaId: pago.id
        })
        .run()

      saldo = factura.total - abono
      if (saldo <= 0) {
        tx.update(facturas)
          .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
          .where(eq(facturas.id, factura.id))
          .run()
        factura.estado = 'pagada'
      }
    }

    return { pedido: pedidoCreado, factura, pago, saldo, trabajoIds }
  })
}

export function listarPedidos(
  db: DB,
  opts: {
    estado?: EstadoPedido
    clienteId?: number
    limit?: number
    // Por defecto excluye pedidos entregados hace más de DIAS_ARCHIVADO
    // días para no inflar el Kanban con histórico. El toggle "Ver archivados"
    // de la UI pone esto en true cuando papá quiere ver el histórico completo.
    incluirArchivados?: boolean
    // Búsqueda case-insensitive (LIKE %q%) sobre número y descripción.
    // Usada por la búsqueda global del CommandPalette para escalar sin
    // traer toda la tabla al cliente.
    busqueda?: string
  } = {}
) {
  // Asegura que la reclasificación automática (listo → sin_reclamar tras +15 días)
  // esté aplicada antes de devolver resultados. Idempotente, sin costo si no hay
  // candidatos.
  reclasificarPedidos(db)
  const conds: SQL[] = []
  if (opts.estado) conds.push(eq(pedidos.estado, opts.estado))
  if (opts.clienteId) conds.push(eq(pedidos.clienteId, opts.clienteId))
  if (opts.busqueda) {
    // Escape de wildcards LIKE — ver helper buildContainsPattern.
    const q = buildContainsPattern(opts.busqueda)
    conds.push(
      or(
        sql`${pedidos.numero} LIKE ${q} ESCAPE '\\'`,
        sql`${pedidos.descripcion} LIKE ${q} ESCAPE '\\'`
      )!
    )
  }
  if (!opts.incluirArchivados) {
    // Esconde entregados con updatedAt de hace más de 30 días. No afecta a
    // cancelados ni a ningún estado activo — solo al "cementerio" de entregados.
    conds.push(
      or(
        not(eq(pedidos.estado, 'entregado')),
        sql`julianday('now') - julianday(${pedidos.updatedAt}) <= ${DIAS_ARCHIVADO}`
      )!
    )
  }
  const where = conds.length > 0 ? and(...conds) : undefined
  const q = db.select().from(pedidos).where(where).orderBy(desc(pedidos.createdAt))
  if (opts.limit) return q.limit(opts.limit).all()
  return q.all()
}

/**
 * Fase 1 — Devuelve saldo por pedido para todos los pedidos en una query-trip.
 * Antes el kanban-card no mostraba pago porque habría requerido N queries de
 * factura + saldo individuales.
 *
 * Implementación: en vez de un LEFT JOIN triple que sufre row fan-out cuando
 * un pedido tiene N facturas × M pagos (auditoría adversarial detectó este
 * bug: `sum(pagos)` se multiplicaba por la cantidad de facturas), hacemos
 * dos agregaciones independientes y las unimos en memoria. Es correcto, fácil
 * de leer y el costo extra es despreciable (≤3 queries sin joins vs 1 con
 * joins complejos). Papá tiene pocos miles de pedidos como máximo.
 *
 * Reglas de cálculo:
 *   - Solo consideramos facturas NO anuladas.
 *   - Pedido sin factura activa → total = precioTotal, pagado = 0, saldo = precioTotal.
 *   - Pedido con factura(s) activa(s) → total = sum(facturas.total), pagado = sum(pagos.monto).
 */
export function obtenerSaldosPorPedido(
  db: DB
): Array<{ pedidoId: number; total: number; pagado: number; saldo: number }> {
  const pedidosList = db
    .select({ id: pedidos.id, precioTotal: pedidos.precioTotal })
    .from(pedidos)
    .all()

  // Total facturado por pedido (suma de facturas activas). Agrupación simple
  // sobre la tabla de facturas — no hay fan-out posible.
  const facturaTotals = db
    .select({
      pedidoId: facturas.pedidoId,
      total: sql<number>`sum(${facturas.total})`.as('factura_total'),
      count: sql<number>`count(*)`.as('factura_count')
    })
    .from(facturas)
    .where(not(eq(facturas.estado, 'anulada')))
    .groupBy(facturas.pedidoId)
    .all()

  // Total pagado por pedido. INNER JOIN con facturas garantiza que excluimos
  // pagos de facturas anuladas. Agrupado por pedido_id (via factura.pedidoId)
  // para que no haya duplicación.
  const pagoTotals = db
    .select({
      pedidoId: facturas.pedidoId,
      total: sql<number>`sum(${pagos.monto})`.as('pago_total')
    })
    .from(pagos)
    .innerJoin(facturas, and(eq(facturas.id, pagos.facturaId), not(eq(facturas.estado, 'anulada'))))
    .groupBy(facturas.pedidoId)
    .all()

  const facturaMap = new Map<number, { total: number; count: number }>()
  for (const f of facturaTotals) {
    facturaMap.set(f.pedidoId, { total: Number(f.total), count: Number(f.count) })
  }
  const pagoMap = new Map<number, number>()
  for (const p of pagoTotals) {
    pagoMap.set(p.pedidoId, Number(p.total))
  }

  return pedidosList.map((p) => {
    const facturaInfo = facturaMap.get(p.id)
    const pagado = pagoMap.get(p.id) ?? 0
    // Sin factura activa → saldo = precio total (falta cobrar todo).
    const total = facturaInfo ? facturaInfo.total : Number(p.precioTotal)
    // Saldo SIN clamp a 0: cuando hay devoluciones que exceden el pago neto
    // o el cliente hizo un sobrepago legítimo, el resultado real es negativo
    // y representa un crédito a favor del cliente. La UI consumidora decide
    // cómo presentarlo (ej: "Crédito del cliente: $X" en lugar de "Saldo $0").
    // Si se clampeara a 0 aquí, papá perdería visibilidad de esa deuda inversa.
    const saldo = total - pagado
    return { pedidoId: p.id, total, pagado, saldo }
  })
}

export function obtenerPedido(db: DB, id: number) {
  const pedido = db.select().from(pedidos).where(eq(pedidos.id, id)).get()
  if (!pedido) return null
  const items = db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, id)).all()
  return { ...pedido, items }
}

export function obtenerPedidoPorNumero(db: DB, numero: string) {
  const pedido = db.select().from(pedidos).where(eq(pedidos.numero, numero)).get()
  if (!pedido) return null
  const items = db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, pedido.id)).all()
  return { ...pedido, items }
}

export function cambiarEstadoPedido(db: DB, id: number, nuevoEstado: EstadoPedido) {
  return db.transaction((tx) => {
    const prev = tx.select().from(pedidos).where(eq(pedidos.id, id)).get()
    if (!prev) throw new Error(`Pedido ${id} no encontrado`)
    if (prev.estado === nuevoEstado) return prev

    const permitidos = TRANSICIONES_VALIDAS[prev.estado as EstadoPedido]
    if (!permitidos || !permitidos.includes(nuevoEstado)) {
      throw new Error(`No se puede pasar de "${prev.estado}" a "${nuevoEstado}"`)
    }

    // C2 — Garantía de backend: no permitimos entregar un pedido si su factura
    // activa tiene saldo pendiente. El UI ya bloquea el botón, pero esta es la
    // última defensa contra IPC directo o clientes maliciosos que salten el UI.
    // Si el pedido no tiene factura activa, asumimos pago externo y permitimos.
    if (nuevoEstado === 'entregado') {
      const facturaActiva = tx
        .select()
        .from(facturas)
        .where(and(eq(facturas.pedidoId, id), not(eq(facturas.estado, 'anulada'))))
        .get()
      if (facturaActiva) {
        const totPagos = tx
          .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
          .from(pagos)
          .where(eq(pagos.facturaId, facturaActiva.id))
          .get()
        const totDev = tx
          .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
          .from(devoluciones)
          .where(eq(devoluciones.facturaId, facturaActiva.id))
          .get()
        const saldo = facturaActiva.total - (totPagos?.sum ?? 0) + (totDev?.sum ?? 0)
        if (saldo > 0) {
          throw new Error(
            `No se puede entregar: la factura ${facturaActiva.numero} tiene saldo pendiente de ${saldo}.`
          )
        }
      }
    }

    const updated = tx
      .update(pedidos)
      .set({ estado: nuevoEstado, updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, id))
      .returning()
      .get()

    if (nuevoEstado === 'cancelado') {
      // BR — Cancelación segura: si el cliente ya pagó algo, antes de anular
      // la factura registramos una devolución automática del monto cobrado
      // neto (pagos − devoluciones previas). Sin esto, el dinero del cliente
      // quedaba en `movimientos_financieros` como ingreso pero la factura
      // anulada no aparece en reportes, dejando el saldo del cliente
      // inconsistente.
      const facturasActivas = tx
        .select()
        .from(facturas)
        .where(and(eq(facturas.pedidoId, id), not(eq(facturas.estado, 'anulada'))))
        .all()
      for (const f of facturasActivas) {
        const totPagos = tx
          .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
          .from(pagos)
          .where(eq(pagos.facturaId, f.id))
          .get()
        const totDev = tx
          .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
          .from(devoluciones)
          .where(eq(devoluciones.facturaId, f.id))
          .get()
        const cobradoNeto = (totPagos?.sum ?? 0) - (totDev?.sum ?? 0)
        if (cobradoNeto > 0) {
          const dev = tx
            .insert(devoluciones)
            .values({
              facturaId: f.id,
              monto: cobradoNeto,
              motivo: `Cancelación de pedido ${prev.numero}`,
              fecha: sql`(date('now'))`
            })
            .returning()
            .get()
          tx.insert(movimientosFinancieros)
            .values({
              tipo: 'gasto',
              categoria: 'devolucion',
              descripcion: `Devolución por cancelación de pedido ${prev.numero}`,
              monto: cobradoNeto,
              fecha: sql`(date('now'))`,
              referenciaTipo: 'devolucion',
              referenciaId: dev.id
            })
            .run()
        }
        tx.update(facturas)
          .set({ estado: 'anulada', updatedAt: sql`(datetime('now'))` })
          .where(eq(facturas.id, f.id))
          .run()
      }
    }

    tx.insert(historialCambios)
      .values({
        tabla: 'pedidos',
        registroId: id,
        campo: 'estado',
        valorAnterior: prev.estado,
        valorNuevo: nuevoEstado,
        fecha: sql`(datetime('now'))`
      })
      .run()

    return updated
  })
}

// ---------------------------------------------------------------------------
// Edición comercial posterior del pedido
// ---------------------------------------------------------------------------

export type EditarPedidoComercialInput = {
  pedidoId: number
  descuentoMonto: number
  descuentoMotivo?: string | null
  /**
   * Costo estimado manual. Solo se respeta para pedidos que originalmente
   * usaron costo manual (restauración, vidrio_espejo). Para pedidos con
   * cálculo automático (enmarcación, retablo, etc.) se ignora porque el
   * costo viene de las listas de precios.
   */
  costoEstimadoTotal?: number | null
}

export type EditarPedidoComercialResult = {
  pedido: typeof pedidos.$inferSelect
  facturaActualizada: typeof facturas.$inferSelect | null
  devolucionGenerada: typeof devoluciones.$inferSelect | null
}

/**
 * Edita el descuento, motivo y costo estimado de un pedido ya creado.
 * Recalcula precio total, margen y estado de rentabilidad. Si hay factura
 * activa, ajusta su total. Si el nuevo total es menor que lo cobrado al
 * cliente, registra una devolución automática del exceso.
 *
 * Bloquea pedidos en estado terminal (entregado, cancelado): editar después
 * de entregado podría falsear el reporte; cancelado ya tiene factura anulada.
 */
export function editarPedidoComercial(
  db: DB,
  input: EditarPedidoComercialInput
): EditarPedidoComercialResult {
  return db.transaction((tx) => {
    const txDb = tx as unknown as DB
    const pedido = tx.select().from(pedidos).where(eq(pedidos.id, input.pedidoId)).get()
    if (!pedido) throw new Error(`Pedido ${input.pedidoId} no encontrado`)
    if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
      throw new Error(
        `No se puede editar un pedido en estado "${pedido.estado}". ` +
          'Para corregirlo, considera registrar una devolución manual.'
      )
    }

    validarMonto(input.descuentoMonto, { campo: 'Descuento', min: 0 })
    if (input.descuentoMonto > pedido.precioLista) {
      throw new Error(`El descuento excede el precio sugerido (${pedido.precioLista})`)
    }
    if (input.costoEstimadoTotal !== undefined && input.costoEstimadoTotal !== null) {
      validarMonto(input.costoEstimadoTotal, { campo: 'Costo estimado', min: 0 })
    }

    // Costo: si el pedido usa costo manual (restauración/vidrio_espejo), aceptamos
    // el override del input. Si usa cálculo automático, mantenemos el costo
    // calculado en su momento — editar a mano falsearía la rentabilidad.
    const usaCostoManual =
      pedido.tipoTrabajo === 'restauracion' || pedido.tipoTrabajo === 'vidrio_espejo'
    const nuevoCostoEstimadoTotal = usaCostoManual
      ? input.costoEstimadoTotal === undefined
        ? pedido.costoEstimadoTotal
        : input.costoEstimadoTotal
      : pedido.costoEstimadoTotal

    const evaluacion = evaluarPedido(
      txDb,
      pedido.precioLista,
      input.descuentoMonto,
      nuevoCostoEstimadoTotal
    )
    // Re-validar derivados de la evaluación comercial — si pedido.precioLista
    // o el costo estimado son no-finitos por corrupción previa, abortamos
    // antes de propagar el daño.
    const nuevoTotal = validarMonto(evaluacion.precioFinal, {
      campo: 'Nuevo precio total del pedido',
      min: 0
    })
    const motivo = input.descuentoMotivo?.trim() || null

    const pedidoActualizado = tx
      .update(pedidos)
      .set({
        descuentoMonto: evaluacion.descuentoMonto,
        descuentoMotivo: motivo,
        costoEstimadoTotal: nuevoCostoEstimadoTotal,
        margenEstimado: evaluacion.margenEstimado,
        margenEstimadoPct: evaluacion.margenEstimadoPct,
        estadoRentabilidad: evaluacion.estadoRentabilidad,
        precioTotal: nuevoTotal,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(pedidos.id, input.pedidoId))
      .returning()
      .get()

    // Sincroniza el ítem `descuento` en pedido_items: si ahora hay descuento,
    // upsert; si era 0 y ya no, lo eliminamos para no dejar basura.
    const itemDescuentoExistente = tx
      .select()
      .from(pedidoItems)
      .where(and(eq(pedidoItems.pedidoId, input.pedidoId), eq(pedidoItems.tipoItem, 'descuento')))
      .get()
    if (evaluacion.descuentoMonto > 0) {
      if (itemDescuentoExistente) {
        tx.update(pedidoItems)
          .set({
            descripcion: motivo || 'Descuento manual',
            subtotal: -evaluacion.descuentoMonto
          })
          .where(eq(pedidoItems.id, itemDescuentoExistente.id))
          .run()
      } else {
        tx.insert(pedidoItems)
          .values({
            pedidoId: input.pedidoId,
            tipoItem: 'descuento',
            descripcion: motivo || 'Descuento manual',
            cantidad: 1,
            precioUnitario: null,
            costoUnitarioEstimado: null,
            subtotal: -evaluacion.descuentoMonto,
            subtotalCostoEstimado: null,
            metadata: null
          })
          .run()
      }
    } else if (itemDescuentoExistente) {
      tx.delete(pedidoItems).where(eq(pedidoItems.id, itemDescuentoExistente.id)).run()
    }

    // Sincroniza la factura activa si existe.
    let facturaActualizada: typeof facturas.$inferSelect | null = null
    let devolucionGenerada: typeof devoluciones.$inferSelect | null = null
    const facturaActiva = tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.pedidoId, input.pedidoId), not(eq(facturas.estado, 'anulada'))))
      .get()
    if (facturaActiva) {
      const totPagos = tx
        .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
        .from(pagos)
        .where(eq(pagos.facturaId, facturaActiva.id))
        .get()
      const totDev = tx
        .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
        .from(devoluciones)
        .where(eq(devoluciones.facturaId, facturaActiva.id))
        .get()
      const cobradoNeto = (totPagos?.sum ?? 0) - (totDev?.sum ?? 0)
      // Si el nuevo total es menor que lo cobrado, devolvemos el exceso al
      // cliente automáticamente (mantiene la factura saldable y el saldo
      // consistente).
      if (nuevoTotal < cobradoNeto) {
        const exceso = cobradoNeto - nuevoTotal
        devolucionGenerada = tx
          .insert(devoluciones)
          .values({
            facturaId: facturaActiva.id,
            monto: exceso,
            motivo: `Ajuste comercial: ${motivo || 'descuento aumentado'}`,
            fecha: sql`(date('now'))`
          })
          .returning()
          .get()
        tx.insert(movimientosFinancieros)
          .values({
            tipo: 'gasto',
            categoria: 'devolucion',
            descripcion: `Devolución por ajuste de pedido ${pedido.numero}`,
            monto: exceso,
            fecha: sql`(date('now'))`,
            referenciaTipo: 'devolucion',
            referenciaId: devolucionGenerada.id
          })
          .run()
      }

      const cobradoFinal = nuevoTotal < cobradoNeto ? nuevoTotal : cobradoNeto
      const nuevoEstadoFactura = cobradoFinal >= nuevoTotal && nuevoTotal >= 0 ? 'pagada' : 'pendiente'
      facturaActualizada = tx
        .update(facturas)
        .set({
          total: nuevoTotal,
          estado: nuevoEstadoFactura,
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(facturas.id, facturaActiva.id))
        .returning()
        .get()
    }

    tx.insert(historialCambios)
      .values({
        tabla: 'pedidos',
        registroId: input.pedidoId,
        campo: 'descuento_monto',
        valorAnterior: String(pedido.descuentoMonto),
        valorNuevo: String(evaluacion.descuentoMonto),
        fecha: sql`(datetime('now'))`
      })
      .run()

    return { pedido: pedidoActualizado, facturaActualizada, devolucionGenerada }
  })
}

// ---------------------------------------------------------------------------
// Quick-pay: cobrar saldo pendiente y entregar en una sola operación atómica
// ---------------------------------------------------------------------------

export type CobrarYEntregarInput = {
  pedidoId: number
  monto: number
  metodoPago: MetodoPago
  fecha: string
  notas?: string | null
}

export type CobrarYEntregarResult = {
  pedido: typeof pedidos.$inferSelect
  pago: typeof pagos.$inferSelect
  factura: typeof facturas.$inferSelect
  saldoFinal: number
  facturaPagada: boolean
}

/**
 * Quick-pay: registra el pago del saldo pendiente Y mueve el pedido a
 * estado 'entregado' en una sola transacción atómica. Pensado para el
 * flujo "cliente paga + recoge" del kanban (drag a Entregado).
 *
 * Reglas:
 *   - Pedido debe estar en estado 'listo' (la transición a entregado solo
 *     es válida desde ahí — TRANSICIONES_VALIDAS lo enforce)
 *   - Debe tener exactamente UNA factura activa (no anulada)
 *   - El monto debe cubrir el saldo pendiente exacto. Si el cliente solo
 *     puede dejar abono parcial, debe usar el endpoint `registrarPago`
 *     normal en lugar de este (la card NO debe pasar a entregado)
 *   - Crea un movimiento_financiero de ingreso con la categoría correcta
 *     según el tipo de trabajo (enmarcacion / restauracion)
 *   - Si la transacción falla en cualquier paso, rollback completo
 *
 * @throws si pedido no existe, no está en 'listo', no tiene factura activa,
 *         monto inválido o transición rechazada
 */
export function cobrarYEntregar(db: DB, input: CobrarYEntregarInput): CobrarYEntregarResult {
  validarMonto(input.monto, { campo: 'Monto del cobro', min: Number.MIN_VALUE })
  validarEnum(input.metodoPago, METODOS_PAGO, 'metodoPago')
  validarFechaISO(input.fecha, 'YYYY-MM-DD', 'fecha')

  return db.transaction((tx) => {
    const pedido = tx.select().from(pedidos).where(eq(pedidos.id, input.pedidoId)).get()
    if (!pedido) throw new Error(`Pedido ${input.pedidoId} no encontrado`)
    if (pedido.estado !== 'listo') {
      throw new Error(
        `Solo se puede cobrar y entregar pedidos en estado "listo". Este está en "${pedido.estado}".`
      )
    }

    const facturaActiva = tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.pedidoId, pedido.id), not(eq(facturas.estado, 'anulada'))))
      .get()
    if (!facturaActiva) {
      throw new Error(
        'Este pedido no tiene factura activa. Genera la factura antes de cobrar.'
      )
    }

    // Calcular saldo actual (factura.total - pagos previos + devoluciones)
    const totPagos = tx
      .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
      .from(pagos)
      .where(eq(pagos.facturaId, facturaActiva.id))
      .get()
    const totDev = tx
      .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
      .from(devoluciones)
      .where(eq(devoluciones.facturaId, facturaActiva.id))
      .get()
    // Si la factura tuviera total no-finito por corrupción previa, abortamos
    // antes de propagar el daño al pago y al movimiento financiero.
    const saldoActual = validarMonto(
      facturaActiva.total - (totPagos?.sum ?? 0) + (totDev?.sum ?? 0),
      { campo: 'Saldo actual de la factura', min: 0 }
    )

    if (input.monto > saldoActual) {
      throw new Error(
        `El monto (${input.monto}) excede el saldo pendiente (${saldoActual})`
      )
    }
    // Decisión de UX: este endpoint exige cobro completo. Si el cliente
    // paga parcial, el frontend debe usar `registrarPago` y NO cambiar
    // estado (el pedido sigue en 'listo').
    if (input.monto < saldoActual) {
      throw new Error(
        `Para entregar el pedido debes cobrar el saldo completo (${saldoActual}). ` +
          `Si solo recibes un abono parcial, usa "Cobrar abono" en lugar de "Cobrar y entregar".`
      )
    }

    // 1. Insertar pago
    const pago = tx
      .insert(pagos)
      .values({
        facturaId: facturaActiva.id,
        monto: input.monto,
        metodoPago: input.metodoPago,
        fecha: input.fecha,
        notas: input.notas ?? null
      })
      .returning()
      .get()

    // 2. Movimiento financiero (ingreso)
    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'ingreso',
        categoria: categoriaDesdePedido(pedido.tipoTrabajo as TipoTrabajo),
        descripcion: `Pago factura ${facturaActiva.numero} (cobrar+entregar)`,
        monto: input.monto,
        fecha: input.fecha,
        referenciaTipo: 'pago',
        referenciaId: pago.id
      })
      .run()

    // 3. Marcar factura como pagada (saldoFinal = 0 garantizado por la
    //    validación de cobro completo arriba)
    const facturaActualizada = tx
      .update(facturas)
      .set({ estado: 'pagada', updatedAt: sql`(datetime('now'))` })
      .where(eq(facturas.id, facturaActiva.id))
      .returning()
      .get()

    // 4. Cambiar estado del pedido a 'entregado'. Validamos la transición
    //    explícitamente — `TRANSICIONES_VALIDAS` ya garantiza que listo→entregado
    //    es válido, pero re-checamos por defensa. NO usamos `cambiarEstadoPedido`
    //    aquí para evitar transacciones anidadas; replicamos su lógica:
    const permitidos = TRANSICIONES_VALIDAS[pedido.estado] ?? []
    if (!permitidos.includes('entregado')) {
      throw new Error(`No se puede pasar de "${pedido.estado}" a "entregado"`)
    }
    const pedidoActualizado = tx
      .update(pedidos)
      .set({ estado: 'entregado', updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, pedido.id))
      .returning()
      .get()

    // 5. Historial
    tx.insert(historialCambios)
      .values({
        tabla: 'pedidos',
        registroId: pedido.id,
        campo: 'estado',
        valorAnterior: pedido.estado,
        valorNuevo: 'entregado',
        fecha: sql`(datetime('now'))`
      })
      .run()

    return {
      pedido: pedidoActualizado,
      pago,
      factura: facturaActualizada,
      saldoFinal: 0,
      facturaPagada: true
    }
  })
}

/**
 * Actualiza el tipo de entrega (estandar / urgente / sin_afan). Permitido en
 * cualquier estado no terminal — el dueño puede marcar un pedido como urgente
 * en cualquier momento si el cliente lo pide.
 */
export function actualizarTipoEntrega(db: DB, id: number, tipoEntrega: TipoEntrega) {
  validarEnum(tipoEntrega, ['estandar', 'urgente', 'sin_afan'] as const, 'tipoEntrega')
  return (
    db
      .update(pedidos)
      .set({ tipoEntrega, updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, id))
      .returning()
      .get() ?? null
  )
}

export function actualizarFechaEntrega(db: DB, id: number, fechaEntrega: string | null) {
  return (
    db
      .update(pedidos)
      .set({ fechaEntrega, updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, id))
      .returning()
      .get() ?? null
  )
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export function pedidosAtrasados(db: DB) {
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        lt(pedidos.fechaEntrega, sql`date('now')`),
        not(inArray(pedidos.estado, ESTADOS_TERMINALES))
      )
    )
    .orderBy(pedidos.fechaEntrega)
    .all()
}

export function pedidosEntregaProxima(db: DB, diasLimite = 2) {
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        lte(sql`julianday(${pedidos.fechaEntrega}) - julianday('now')`, sql`${diasLimite}`),
        not(inArray(pedidos.estado, ESTADOS_TERMINALES))
      )
    )
    .orderBy(pedidos.fechaEntrega)
    .all()
}

export function pedidosPorRangoFecha(db: DB, desde: string, hasta: string) {
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        gte(pedidos.fechaEntrega, desde),
        lte(pedidos.fechaEntrega, hasta),
        not(inArray(pedidos.estado, ESTADOS_TERMINALES))
      )
    )
    .orderBy(pedidos.fechaEntrega)
    .all()
}

export function pedidosAgenda(db: DB) {
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        isNotNull(pedidos.fechaEntrega),
        inArray(pedidos.estado, ESTADOS_ACTIVOS_AGENDA)
      )
    )
    .orderBy(pedidos.fechaEntrega, pedidos.numero)
    .all()
}

// Vista aplanada de entregas en un rango (inclusivo en ambos extremos).
// Pensada para el HelpButton de /agenda: lista accionable con nombre +
// teléfono del cliente para poder llamar a confirmar que vienen. Excluye
// pedidos terminales (listo/entregado/cancelado) porque esos ya no
// requieren trabajo operativo.
export function entregasEnRango(db: DB, desde: string, hasta: string): EntregaDelDia[] {
  const rows = db
    .select({
      pedidoId: pedidos.id,
      pedidoNumero: pedidos.numero,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      fechaEntrega: pedidos.fechaEntrega,
      tipoTrabajo: pedidos.tipoTrabajo,
      estado: pedidos.estado
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        isNotNull(pedidos.fechaEntrega),
        gte(pedidos.fechaEntrega, desde),
        lte(pedidos.fechaEntrega, hasta),
        not(inArray(pedidos.estado, ESTADOS_TERMINALES))
      )
    )
    .orderBy(pedidos.fechaEntrega)
    .all()
  return rows.map((r) => ({
    pedidoId: r.pedidoId,
    pedidoNumero: r.pedidoNumero,
    clienteId: r.clienteId,
    clienteNombre: r.clienteNombre,
    clienteTelefono: r.clienteTelefono,
    // El filtro isNotNull ya garantiza que no sea null, pero el tipo
    // inferido es string | null — aseveramos no-null.
    fechaEntrega: r.fechaEntrega ?? '',
    tipoTrabajo: r.tipoTrabajo,
    estado: r.estado
  }))
}

export function pedidosSinAbono(db: DB) {
  // Pedidos con factura ACTIVA (no anulada) pero sin pagos registrados.
  // Filtrar facturas anuladas en el WHERE evita el edge case donde un pedido
  // tiene una factura anulada + una activa — si no filtramos, el groupBy
  // podría devolver la anulada según qué eligió SQLite.
  const rows = db
    .select({
      pedido: pedidos,
      cliente: clientes,
      factura: facturas,
      totalPagado: sql<number>`coalesce(sum(${pagos.monto}), 0)`.as('total_pagado')
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(facturas, eq(facturas.pedidoId, pedidos.id))
    .leftJoin(pagos, eq(pagos.facturaId, facturas.id))
    .where(
      and(not(inArray(pedidos.estado, ESTADOS_NO_FACTURABLES)), not(eq(facturas.estado, 'anulada')))
    )
    .groupBy(pedidos.id, clientes.id, facturas.id)
    .having(sql`coalesce(sum(${pagos.monto}), 0) = 0`)
    .all()
  return rows
}

// Vista aplanada de pedidos sin abono, con saldo calculado, nombre y
// teléfono del cliente, y días desde la emisión de la factura. Pensado
// para el HelpButton: necesita mostrar una lista accionable ordenada
// por antigüedad (los más viejos primero) y con todo lo que hace falta
// para llamar o mandar WhatsApp sin consultar más endpoints.
// El tipo vive en @shared/types para ser consumido por el renderer.
export function pedidosSinAbonoConSaldo(db: DB, limit = 10): PedidoSinAbonoConSaldo[] {
  // Los sin-abono puros son los que tienen `sum(pagos) = 0`. También
  // incluimos facturas con saldo > 0 pero algún abono parcial: el
  // HelpButton los muestra igual porque todavía hay deuda pendiente.
  // Para lo primero (sin abono completo) el filtro ya lo hace having=0;
  // aquí ampliamos a "con saldo > 0" para que incluya parciales.
  const rows = db
    .select({
      pedidoId: pedidos.id,
      pedidoNumero: pedidos.numero,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      total: facturas.total,
      fechaFactura: facturas.fecha,
      fechaEntrega: pedidos.fechaEntrega,
      totalPagado: sql<number>`coalesce(sum(${pagos.monto}), 0)`.as('total_pagado'),
      diasSinAbono:
        sql<number>`cast(julianday('now') - julianday(${facturas.fecha}) as integer)`.as(
          'dias_sin_abono'
        )
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(facturas, eq(facturas.pedidoId, pedidos.id))
    .leftJoin(pagos, eq(pagos.facturaId, facturas.id))
    .where(
      and(not(inArray(pedidos.estado, ESTADOS_NO_FACTURABLES)), not(eq(facturas.estado, 'anulada')))
    )
    .groupBy(pedidos.id, clientes.id, facturas.id)
    .having(sql`${facturas.total} - coalesce(sum(${pagos.monto}), 0) > 0`)
    .orderBy(desc(sql`dias_sin_abono`))
    .limit(limit)
    .all()

  return rows.map((r) => ({
    pedidoId: r.pedidoId,
    pedidoNumero: r.pedidoNumero,
    clienteId: r.clienteId,
    clienteNombre: r.clienteNombre,
    clienteTelefono: r.clienteTelefono,
    saldoPendiente: Math.max(0, Number(r.total) - Number(r.totalPagado)),
    diasSinAbono: Math.max(0, Number(r.diasSinAbono)),
    fechaEntrega: r.fechaEntrega
  }))
}

export function pedidosSinReclamar(db: DB, diasLimite = 15) {
  // Ejecuta la reclasificación automática primero (listo→sin_reclamar al pasar
  // el umbral). Luego devuelve todos los pedidos ya marcados como sin_reclamar
  // más cualquier pedido en estado listo que lleve más de `diasLimite` días
  // (defensivo por si el umbral aquí difiere del usado en reclasificarPedidos).
  reclasificarPedidos(db, diasLimite)
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      or(
        eq(pedidos.estado, 'sin_reclamar'),
        and(
          eq(pedidos.estado, 'listo'),
          sql`julianday('now') - julianday(${pedidos.updatedAt}) > ${diasLimite}`
        )
      )
    )
    .orderBy(pedidos.updatedAt)
    .all()
}

export function pedidosListosSinRecoger(db: DB, dias = 2) {
  // Pedidos en estado `listo` que llevan más de N días sin moverse. Alerta
  // intermedia antes de que reclasificarPedidos() los pase a sin_reclamar a
  // los 15 días — ayuda a papá a llamar al cliente a tiempo.
  return db
    .select()
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        eq(pedidos.estado, 'listo'),
        sql`julianday('now') - julianday(${pedidos.updatedAt}) > ${dias}`
      )
    )
    .orderBy(pedidos.updatedAt)
    .all()
}

export function resumenPedidosPorEstado(db: DB) {
  return db
    .select({
      estado: pedidos.estado,
      total: sql<number>`count(*)`.as('total')
    })
    .from(pedidos)
    .groupBy(pedidos.estado)
    .all()
}

// ---------------------------------------------------------------------------
// Reclasificación automática (BR-009)
// ---------------------------------------------------------------------------

/**
 * Marca automáticamente como `sin_reclamar` los pedidos que llevan más de N días
 * en estado `listo` sin moverse. Fase 2 §B especifica umbral 15 días.
 *
 * Idempotente: los pedidos ya reclasificados no se tocan. Escribe una entrada en
 * historial_cambios por cada transición para trazabilidad.
 *
 * Devuelve la cantidad de pedidos reclasificados.
 */
export function reclasificarPedidos(db: DB, diasLimite = 15): number {
  return db.transaction((tx) => {
    const candidatos = tx
      .select()
      .from(pedidos)
      .where(
        and(
          eq(pedidos.estado, 'listo'),
          sql`julianday('now') - julianday(${pedidos.updatedAt}) > ${diasLimite}`
        )
      )
      .all()

    for (const p of candidatos) {
      tx.update(pedidos)
        .set({ estado: 'sin_reclamar', updatedAt: sql`(datetime('now'))` })
        .where(eq(pedidos.id, p.id))
        .run()
      tx.insert(historialCambios)
        .values({
          tabla: 'pedidos',
          registroId: p.id,
          campo: 'estado',
          valorAnterior: 'listo',
          valorNuevo: 'sin_reclamar',
          fecha: sql`(datetime('now'))`
        })
        .run()
    }
    return candidatos.length
  })
}

// ---------------------------------------------------------------------------
// Matriz de urgencia (BR-001)
// ---------------------------------------------------------------------------

/**
 * Devuelve los cuatro cuadrantes de la matriz 2x2 (urgencia × estado de pago)
 * que el tablero del dashboard necesita para el componente UrgencyMatrix.
 *
 * Reglas (Fase 2 §B.1.2):
 *   - Pedido "urgente": fechaEntrega <= hoy + diasUrgencia (2 por defecto),
 *     o ya vencida, Y estado NO terminal.
 *   - Pedido "sin_abono": existe factura activa sin pagos registrados, O
 *     (como fallback) pedido confirmado/en_proceso/listo sin factura.
 *   - Sólo cuentan pedidos en estados ACTIVOS: confirmado, en_proceso, listo.
 */
export type MatrizUrgencia = {
  urgenteSinAbono: number
  urgenteConAbono: number
  normalSinAbono: number
  normalConAbono: number
  atrasados: number
  total: number
  diasUrgencia: number
}

export type PedidoUrgenciaLite = {
  id: number
  estado: EstadoPedido
  fechaEntrega: string | null
}

function inicioDelDiaLocal(base: Date): Date {
  const dia = new Date(base)
  dia.setHours(0, 0, 0, 0)
  return dia
}

function fechaISOAInicioDiaLocal(fechaISO: string): Date {
  // Parsear a mediodía evita corrimientos por zona horaria al convertir un
  // string YYYY-MM-DD; luego lo llevamos al inicio del día para comparar por fecha.
  return inicioDelDiaLocal(new Date(`${fechaISO}T12:00:00`))
}

export function clasificarPedidosPorUrgencia(
  rows: PedidoUrgenciaLite[],
  sinAbonoPedidoIds: ReadonlySet<number>,
  diasUrgencia = 2,
  hoy = new Date()
): MatrizUrgencia {
  const pedidosActivos = rows.filter((pedido) => ESTADOS_ACTIVOS_MATRIZ.includes(pedido.estado))
  const hoyInicio = inicioDelDiaLocal(hoy)

  let urgenteSinAbono = 0
  let urgenteConAbono = 0
  let normalSinAbono = 0
  let normalConAbono = 0
  let atrasados = 0

  for (const pedido of pedidosActivos) {
    const sinAbono = sinAbonoPedidoIds.has(pedido.id)

    if (!pedido.fechaEntrega) {
      if (sinAbono) normalSinAbono++
      else normalConAbono++
      continue
    }

    const entrega = fechaISOAInicioDiaLocal(pedido.fechaEntrega)
    const diasHastaEntrega = Math.round((entrega.getTime() - hoyInicio.getTime()) / DAY_MS)
    const esUrgente = diasHastaEntrega <= diasUrgencia

    if (entrega.getTime() < hoyInicio.getTime()) atrasados++

    if (esUrgente && sinAbono) urgenteSinAbono++
    else if (esUrgente) urgenteConAbono++
    else if (sinAbono) normalSinAbono++
    else normalConAbono++
  }

  return {
    urgenteSinAbono,
    urgenteConAbono,
    normalSinAbono,
    normalConAbono,
    atrasados,
    total: pedidosActivos.length,
    diasUrgencia
  }
}

export function obtenerMatrizUrgencia(db: DB, diasUrgencia = 2): MatrizUrgencia {
  const activos = db
    .select()
    .from(pedidos)
    .where(inArray(pedidos.estado, ESTADOS_ACTIVOS_MATRIZ))
    .all()

  // Conjunto de pedidoId que SÍ tienen factura activa pero sin pagos.
  // Bug previo: el `or(isNull(facturas.id), ...)` incluía pedidos sin factura
  // todavía, inflando el contador del dashboard — el dueño veía "15 sin abono"
  // cuando en realidad muchos apenas habían sido cotizados sin factura aún.
  // Tras el fix del wizard (siempre crea factura al confirmar), este guard
  // asegura que sólo contamos pedidos con deuda real y cobrable.
  const sinAbonoRows = db
    .select({ pedidoId: pedidos.id })
    .from(pedidos)
    .innerJoin(facturas, eq(facturas.pedidoId, pedidos.id))
    .leftJoin(pagos, eq(pagos.facturaId, facturas.id))
    .where(
      and(
        inArray(pedidos.estado, ESTADOS_ACTIVOS_MATRIZ),
        not(eq(facturas.estado, 'anulada')),
        isNotNull(facturas.id)
      )
    )
    .groupBy(pedidos.id, facturas.id)
    .having(sql`coalesce(sum(${pagos.monto}), 0) = 0`)
    .all()
  const sinAbonoSet = new Set(sinAbonoRows.map((r) => r.pedidoId))

  return clasificarPedidosPorUrgencia(activos, sinAbonoSet, diasUrgencia)
}
