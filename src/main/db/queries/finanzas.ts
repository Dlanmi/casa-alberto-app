import { and, desc, eq, gte, lt, lte, ne, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import {
  clientes,
  cuentasCobro,
  facturas,
  movimientosFinancieros,
  pagos,
  pagosClasesDetalle,
  pedidoItems,
  pedidos,
  ventasKits,
  type CategoriaMovimiento,
  type ReferenciaMovimiento,
  type TipoMovimientoFin,
  type TipoTrabajo
} from '../schema'
import { validarFechaISO } from '../../lib/validar-fecha'

// Helpers de mes — delegan formato + rango razonable [2000, 2100] al
// validador central (`validarFechaISO`). Antes este módulo tenía su propio
// regex que solo validaba forma; un mes como '0000-01' pasaba el check y
// luego `new Date(0, 1, 1)` se convertía en 1900-02-01 (quirk de JS con
// años 0-99), generando un rango de 1900 años → OOM al expandir el heatmap
// diario. Ver informe 3b31841.
function validarMesISO(mes: string, contexto: string): { y: number; m: number } {
  validarFechaISO(mes, 'YYYY-MM', contexto)
  const [y, m] = mes.split('-').map((n) => Number.parseInt(n, 10))
  return { y, m }
}

/**
 * Calcula el primer día del mes siguiente. Usado para filtros de rango
 * exclusivo `fecha < siguiente-mes-01`, más correcto que `fecha <= ${mes}-31`
 * (que falla en febrero o meses de 30 días con strings tipo '2026-02-30').
 *
 * Aritmética pura sobre strings — sin `new Date(y, m, 1)`. El constructor
 * numérico de Date interpreta años 0-99 como 1900-1999, lo que producía un
 * rango distorsionado para entradas malformadas. La validación de rango ya
 * cubre eso, pero esta versión es además trivialmente correcta y más rápida.
 */
function primerDiaMesSiguiente(mes: string): string {
  const { y, m } = validarMesISO(mes, 'primerDiaMesSiguiente')
  const yNext = m === 12 ? y + 1 : y
  const mNext = m === 12 ? 1 : m + 1
  return `${String(yNext).padStart(4, '0')}-${String(mNext).padStart(2, '0')}-01`
}

export type NuevoMovimientoManual = {
  tipo: TipoMovimientoFin
  categoria: CategoriaMovimiento
  descripcion?: string | null
  monto: number
  fecha: string
  referenciaTipo?: ReferenciaMovimiento | null
  referenciaId?: number | null
  proveedorId?: number | null
}

export function registrarMovimientoManual(db: DB, data: NuevoMovimientoManual) {
  return db
    .insert(movimientosFinancieros)
    .values({
      tipo: data.tipo,
      categoria: data.categoria,
      descripcion: data.descripcion ?? null,
      monto: data.monto,
      fecha: data.fecha,
      referenciaTipo: data.referenciaTipo ?? 'manual',
      referenciaId: data.referenciaId ?? null,
      proveedorId: data.proveedorId ?? null
    })
    .returning()
    .get()
}

export type OpcionesListarMovimientos = {
  tipo?: TipoMovimientoFin
  categoria?: CategoriaMovimiento
  desde?: string
  hasta?: string
  proveedorId?: number
  limit?: number
}

export function listarMovimientos(db: DB, opts: OpcionesListarMovimientos = {}) {
  const conds: SQL[] = []
  if (opts.tipo) conds.push(eq(movimientosFinancieros.tipo, opts.tipo))
  if (opts.categoria) conds.push(eq(movimientosFinancieros.categoria, opts.categoria))
  if (opts.desde) conds.push(gte(movimientosFinancieros.fecha, opts.desde))
  if (opts.hasta) conds.push(lte(movimientosFinancieros.fecha, opts.hasta))
  if (opts.proveedorId) conds.push(eq(movimientosFinancieros.proveedorId, opts.proveedorId))
  const where = conds.length > 0 ? and(...conds) : undefined
  const q = db
    .select()
    .from(movimientosFinancieros)
    .where(where)
    .orderBy(desc(movimientosFinancieros.fecha))
  if (opts.limit) return q.limit(opts.limit).all()
  return q.all()
}

export type ResumenMensual = {
  mes: string
  ingresos: number
  gastos: number
  balance: number
  porCategoria: { categoria: CategoriaMovimiento; tipo: TipoMovimientoFin; total: number }[]
}

export function resumenMensual(db: DB, mes: string): ResumenMensual {
  // mes = 'YYYY-MM'. Filtro de rango EXCLUSIVO `fecha < primer-día-mes-siguiente`
  // para evitar el bug de meses con menos de 31 días (ej. febrero).
  const desde = `${mes}-01`
  const hastaExcl = primerDiaMesSiguiente(mes)

  const totales = db
    .select({
      tipo: movimientosFinancieros.tipo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .where(
      and(gte(movimientosFinancieros.fecha, desde), lt(movimientosFinancieros.fecha, hastaExcl))
    )
    .groupBy(movimientosFinancieros.tipo)
    .all()

  const ingresos = totales.find((t) => t.tipo === 'ingreso')?.total ?? 0
  const gastos = totales.find((t) => t.tipo === 'gasto')?.total ?? 0

  const porCategoria = db
    .select({
      categoria: movimientosFinancieros.categoria,
      tipo: movimientosFinancieros.tipo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .where(
      and(gte(movimientosFinancieros.fecha, desde), lt(movimientosFinancieros.fecha, hastaExcl))
    )
    .groupBy(movimientosFinancieros.categoria, movimientosFinancieros.tipo)
    .all()

  return {
    mes,
    ingresos,
    gastos,
    balance: ingresos - gastos,
    porCategoria
  }
}

export type ResumenComercialMensual = {
  mes: string
  /** Suma de pedidos.precioLista del mes (lo que cotizamos antes de descuento). */
  ventasBrutasPedidos: number
  /** Descuentos aplicados a esos pedidos. */
  descuentos: number
  /** Ventas netas de pedidos = facturas.total no anuladas (precio_lista − descuento). */
  ventasNetasPedidos: number
  /** Ingresos del mes por clases (suma de pagos_clases_detalle). */
  ventasClases: number
  /** Ingresos del mes por venta de kits. */
  ventasKits: number
  /** Total comercial del mes = pedidos + clases + kits. */
  ventasTotalesMes: number
  /**
   * Costo estimado SOLO de pedidos cuyo costoEstimadoTotal NO es null
   * (pedidos con costo completo). Antes sumábamos null como 0, lo que
   * subestimaba el costo y sobreestimaba el margen.
   */
  costoEstimadoCompletos: number
  /** Ventas netas SOLO de pedidos completos (los que tienen costo). */
  ventasNetasCompletos: number
  /** Margen estimado calculado únicamente sobre pedidos completos. */
  margenEstimadoCompletos: number
  /** Cantidad de pedidos del mes (con factura activa). */
  pedidosTotal: number
  /** Pedidos con costo estimado completo (estadoRentabilidad ≠ 'incompleta'). */
  pedidosCompletos: number
  /** Pedidos sin costo estimado completo. */
  pedidosIncompletos: number
  /** Pedidos con descuento > 0. */
  pedidosConDescuento: number
  /** Pedidos con margen crítico (≤ 0). */
  pedidosRentabilidadCritica: number
}

/**
 * Vista comercial del mes — separa caja real (`resumenMensual`) de la lectura
 * comercial (lo facturado en pedidos + lo cobrado en clases/kits, agregado).
 *
 * Decisión clave: el margen se calcula EXCLUYENDO pedidos con costo
 * incompleto. Antes los tratábamos como `costo=0`, lo que daba márgenes
 * inflados. Ahora reportamos costo y margen "sobre N pedidos completos"
 * y mostramos la cantidad de incompletos por separado para que el dueño
 * sepa cuántos faltan por completar.
 */
export function resumenComercialMensual(db: DB, mes: string): ResumenComercialMensual {
  const desde = `${mes}-01`
  const hastaExcl = primerDiaMesSiguiente(mes)

  // Pedidos facturados del mes (con factura activa).
  const rows = db
    .select({
      precioLista: pedidos.precioLista,
      descuentoMonto: pedidos.descuentoMonto,
      costoEstimadoTotal: pedidos.costoEstimadoTotal,
      estadoRentabilidad: pedidos.estadoRentabilidad,
      totalFactura: facturas.total
    })
    .from(facturas)
    .innerJoin(pedidos, eq(pedidos.id, facturas.pedidoId))
    .where(
      and(
        gte(facturas.fecha, desde),
        lt(facturas.fecha, hastaExcl),
        sql`${facturas.estado} != 'anulada'`
      )
    )
    .all()

  let ventasBrutasPedidos = 0
  let descuentos = 0
  let ventasNetasPedidos = 0
  let costoEstimadoCompletos = 0
  let ventasNetasCompletos = 0
  let pedidosTotal = 0
  let pedidosCompletos = 0
  let pedidosIncompletos = 0
  let pedidosConDescuento = 0
  let pedidosRentabilidadCritica = 0

  for (const row of rows) {
    const precioLista = row.precioLista ?? 0
    const descuento = row.descuentoMonto ?? 0
    const totalFactura = row.totalFactura ?? 0
    ventasBrutasPedidos += precioLista
    descuentos += descuento
    ventasNetasPedidos += totalFactura
    pedidosTotal += 1
    if (descuento > 0) pedidosConDescuento += 1
    if (row.estadoRentabilidad === 'critica') pedidosRentabilidadCritica += 1
    if (row.estadoRentabilidad === 'incompleta' || row.costoEstimadoTotal === null) {
      pedidosIncompletos += 1
    } else {
      pedidosCompletos += 1
      costoEstimadoCompletos += row.costoEstimadoTotal
      ventasNetasCompletos += totalFactura
    }
  }

  // Clases del mes (suma de detalles de pago en el rango).
  const totalClases =
    db
      .select({
        sum: sql<number>`coalesce(sum(${pagosClasesDetalle.monto}), 0)`.as('sum')
      })
      .from(pagosClasesDetalle)
      .where(and(gte(pagosClasesDetalle.fecha, desde), lt(pagosClasesDetalle.fecha, hastaExcl)))
      .get()?.sum ?? 0

  // Kits del mes.
  const totalKits =
    db
      .select({
        sum: sql<number>`coalesce(sum(${ventasKits.precio}), 0)`.as('sum')
      })
      .from(ventasKits)
      .where(and(gte(ventasKits.fecha, desde), lt(ventasKits.fecha, hastaExcl)))
      .get()?.sum ?? 0

  return {
    mes,
    ventasBrutasPedidos,
    descuentos,
    ventasNetasPedidos,
    ventasClases: totalClases,
    ventasKits: totalKits,
    ventasTotalesMes: ventasNetasPedidos + totalClases + totalKits,
    costoEstimadoCompletos,
    ventasNetasCompletos,
    margenEstimadoCompletos: ventasNetasCompletos - costoEstimadoCompletos,
    pedidosTotal,
    pedidosCompletos,
    pedidosIncompletos,
    pedidosConDescuento,
    pedidosRentabilidadCritica
  }
}

export type FilaMargenTipo = {
  tipoTrabajo: TipoTrabajo | 'sin_asignar'
  ingresos: number
  gastos: number
  margen: number
}

export type ReporteMargenPorTipo = {
  mes: string
  filas: FilaMargenTipo[]
  totalIngresos: number
  totalGastos: number
  margenTotal: number
}

/**
 * Fase 1 P-006 — margen por tipo de trabajo para el mes dado.
 *
 * Ingresos: los pagos registrados como movimientos financieros cruzan con
 * pagos → facturas → pedidos para asignar el tipo de trabajo.
 *
 * Gastos: se atribuyen a un tipo de trabajo sólo si el movimiento trae
 * `referenciaTipo='pedido'` o `referenciaTipo='pago'` (cuando coincide con
 * una factura). Los demás quedan en la fila `sin_asignar` para no inflar
 * ningún tipo específico.
 */
export function reporteMargenPorTipo(db: DB, mes: string): ReporteMargenPorTipo {
  const desde = `${mes}-01`
  const hastaExcl = primerDiaMesSiguiente(mes)

  const ingresosPorTipo = db
    .select({
      tipoTrabajo: pedidos.tipoTrabajo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .innerJoin(pagos, eq(pagos.id, movimientosFinancieros.referenciaId))
    .innerJoin(facturas, eq(facturas.id, pagos.facturaId))
    .innerJoin(pedidos, eq(pedidos.id, facturas.pedidoId))
    .where(
      and(
        eq(movimientosFinancieros.tipo, 'ingreso'),
        eq(movimientosFinancieros.referenciaTipo, 'pago'),
        gte(movimientosFinancieros.fecha, desde),
        lt(movimientosFinancieros.fecha, hastaExcl)
      )
    )
    .groupBy(pedidos.tipoTrabajo)
    .all()

  // Gastos: el schema actual de movimientos_financieros no permite atribuir
  // un gasto a un pedido específico (referenciaTipo no incluye 'pedido').
  // Por eso todos los gastos del mes se agrupan bajo "sin_asignar" para que
  // el usuario los vea sumados pero no inflen ningún tipo de trabajo.
  const gastosTotales = db
    .select({
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .where(
      and(
        eq(movimientosFinancieros.tipo, 'gasto'),
        gte(movimientosFinancieros.fecha, desde),
        lt(movimientosFinancieros.fecha, hastaExcl)
      )
    )
    .get()

  const mapa = new Map<TipoTrabajo | 'sin_asignar', { ingresos: number; gastos: number }>()
  for (const row of ingresosPorTipo) {
    const key = row.tipoTrabajo as TipoTrabajo
    mapa.set(key, { ingresos: row.total ?? 0, gastos: 0 })
  }
  const gastosOtros = gastosTotales?.total ?? 0
  if (gastosOtros > 0) {
    mapa.set('sin_asignar', { ingresos: 0, gastos: gastosOtros })
  }

  const filas: FilaMargenTipo[] = [...mapa.entries()]
    .map(([tipoTrabajo, v]) => ({
      tipoTrabajo,
      ingresos: v.ingresos,
      gastos: v.gastos,
      margen: v.ingresos - v.gastos
    }))
    .sort((a, b) => b.ingresos - a.ingresos)

  const totalIngresos = filas.reduce((s, f) => s + f.ingresos, 0)
  const totalGastos = filas.reduce((s, f) => s + f.gastos, 0)

  return {
    mes,
    filas,
    totalIngresos,
    totalGastos,
    margenTotal: totalIngresos - totalGastos
  }
}

// ===========================================================================
// CHARTS — series temporales y top-N para finanzas visual
// ===========================================================================

/** Helper compartido: rango exclusivo para "los últimos N meses incluyendo
 *  el mes actual". Devuelve `[desdeISO, hastaExclISO]` listos para WHERE.
 *  El cálculo se hace con Date local — strftime de SQLite respeta el rango
 *  inclusive/exclusive sin saber de zonas horarias.
 *
 *  Cap de seguridad: 1 ≤ mesesAtras ≤ 120 (10 años). Valores fuera de rango
 *  o no enteros se normalizan al cap más cercano para evitar overflow del
 *  cálculo de Date (mes muy negativo) y queries que escanean toda la DB.
 */
const MAX_MESES_ATRAS = 120

function rangoUltimosMeses(mesesAtras: number): { desde: string; hastaExcl: string } {
  if (!Number.isFinite(mesesAtras)) mesesAtras = 1
  mesesAtras = Math.max(1, Math.min(Math.trunc(mesesAtras), MAX_MESES_ATRAS))
  const ahora = new Date()
  const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioVentana = new Date(
    inicioMesActual.getFullYear(),
    inicioMesActual.getMonth() - (mesesAtras - 1),
    1
  )
  const inicioSiguiente = new Date(inicioMesActual.getFullYear(), inicioMesActual.getMonth() + 1, 1)
  const fmt = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  return { desde: fmt(inicioVentana), hastaExcl: fmt(inicioSiguiente) }
}

export type FilaSerieMensual = {
  /** 'YYYY-MM' */
  mes: string
  ingresos: number
  gastos: number
  balance: number
}

/**
 * Serie de los últimos N meses agrupada por mes y tipo. Usada por el chart
 * "Mes vs Mes". Si un mes no tiene movimientos, igual aparece con ceros para
 * que el chart no salte huecos en el eje X.
 *
 * Implementación:
 *   1. Una sola query SQL con GROUP BY mes/tipo.
 *   2. Pos-procesado JS para rellenar meses sin actividad y calcular balance.
 *
 * Decisión: rellenar en JS y no en SQL. SQLite no tiene generate_series
 * nativo y el costo de N≤12 meses en JS es despreciable.
 */
export function serieMensual(db: DB, mesesAtras = 6): FilaSerieMensual[] {
  const { desde, hastaExcl } = rangoUltimosMeses(mesesAtras)
  const rows = db
    .select({
      mes: sql<string>`strftime('%Y-%m', ${movimientosFinancieros.fecha})`.as('mes'),
      tipo: movimientosFinancieros.tipo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .where(
      and(gte(movimientosFinancieros.fecha, desde), lt(movimientosFinancieros.fecha, hastaExcl))
    )
    .groupBy(sql`strftime('%Y-%m', ${movimientosFinancieros.fecha})`, movimientosFinancieros.tipo)
    .all()

  // Construir el set completo de meses esperados para garantizar gaps llenos.
  const mapa = new Map<string, { ingresos: number; gastos: number }>()
  const cursor = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hastaExcl}T12:00:00`)
  while (cursor < fin) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    mapa.set(key, { ingresos: 0, gastos: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const row of rows) {
    const slot = mapa.get(row.mes)
    if (!slot) continue
    if (row.tipo === 'ingreso') slot.ingresos = row.total
    else if (row.tipo === 'gasto') slot.gastos = row.total
  }

  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, v]) => ({
      mes,
      ingresos: v.ingresos,
      gastos: v.gastos,
      balance: v.ingresos - v.gastos
    }))
}

export type FilaSerieDiaria = {
  /** 'YYYY-MM-DD' */
  fecha: string
  ingresos: number
  gastos: number
  transacciones: number
}

/**
 * Serie diaria del mes — usada por el heatmap calendario. Devuelve TODOS los
 * días del mes en orden, incluso aquellos sin movimientos (con ceros), para
 * que el heatmap pueda renderizar la grilla completa sin lógica de relleno
 * en el componente.
 */
export function serieDiariaMensual(db: DB, mes: string): FilaSerieDiaria[] {
  const desde = `${mes}-01`
  const hastaExcl = primerDiaMesSiguiente(mes)

  const rows = db
    .select({
      fecha: movimientosFinancieros.fecha,
      tipo: movimientosFinancieros.tipo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total'),
      n: sql<number>`count(*)`.as('n')
    })
    .from(movimientosFinancieros)
    .where(
      and(gte(movimientosFinancieros.fecha, desde), lt(movimientosFinancieros.fecha, hastaExcl))
    )
    .groupBy(movimientosFinancieros.fecha, movimientosFinancieros.tipo)
    .all()

  const mapa = new Map<string, FilaSerieDiaria>()
  const cursor = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hastaExcl}T12:00:00`)
  // Cap absoluto: ningún mes tiene más de 31 días. Defensa-en-profundidad
  // contra un futuro bug aguas arriba que produjera un rango fuera de
  // invariante (timezone inesperado, validador nuevo permisivo, etc.).
  const MAX_DIAS_MES = 31
  let iter = 0
  while (cursor < fin) {
    if (iter >= MAX_DIAS_MES) {
      throw new Error(`serieDiariaMensual: rango del mes excede ${MAX_DIAS_MES} días`)
    }
    const fecha = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    mapa.set(fecha, { fecha, ingresos: 0, gastos: 0, transacciones: 0 })
    cursor.setDate(cursor.getDate() + 1)
    iter++
  }
  for (const row of rows) {
    const slot = mapa.get(row.fecha)
    if (!slot) continue
    if (row.tipo === 'ingreso') slot.ingresos = row.total
    else if (row.tipo === 'gasto') slot.gastos = row.total
    slot.transacciones += row.n
  }
  return [...mapa.values()]
}

export type FilaTopCliente = {
  clienteId: number
  nombre: string
  total: number
  facturas: number
}

/**
 * Top N clientes por monto facturado en el rango. Excluye facturas anuladas.
 * Si no hay facturas en el rango, devuelve [].
 *
 * Convención de rango: `[desde, hasta]` INCLUSIVO en ambos extremos. Las
 * fechas en `facturas.fecha` se guardan como `YYYY-MM-DD` puros (sin hora),
 * por lo que `lte(hasta)` incluye exactamente las facturas del día `hasta`
 * sin riesgo de cortes a 00:00. Esto es DIFERENTE a `serieMensual` que usa
 * `[desde, hastaExclusivo)` porque su `hastaExcl` es el primer día del mes
 * siguiente — convención más apropiada para series por mes.
 */
export function topClientes(
  db: DB,
  opts: { desde: string; hasta: string; limit?: number }
): FilaTopCliente[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 50))
  const rows = db
    .select({
      clienteId: facturas.clienteId,
      nombre: clientes.nombre,
      total: sql<number>`coalesce(sum(${facturas.total}), 0)`.as('total'),
      facturas: sql<number>`count(*)`.as('facturas')
    })
    .from(facturas)
    .innerJoin(clientes, eq(clientes.id, facturas.clienteId))
    .where(
      and(
        gte(facturas.fecha, opts.desde),
        lte(facturas.fecha, opts.hasta),
        ne(facturas.estado, 'anulada')
      )
    )
    .groupBy(facturas.clienteId, clientes.nombre)
    .orderBy(desc(sql`sum(${facturas.total})`))
    .limit(limit)
    .all()
  return rows.map((r) => ({
    clienteId: r.clienteId,
    nombre: r.nombre,
    total: r.total ?? 0,
    facturas: r.facturas ?? 0
  }))
}

export type FilaTopMarco = {
  /** Referencia tal como la registró el cotizador. Si null/vacía, agrupa
   *  bajo 'Sin referencia'. */
  referencia: string
  cantidad: number
  total: number
}

/**
 * Top N marcos vendidos en el rango — agrupa por `pedido_items.referencia`
 * (string copiado al item al cotizar) cuando `tipo_item='marco'`. El filtro
 * de fecha se aplica al pedido (`pedidos.fechaIngreso`) — más estable que la
 * fecha del item, que viene del createdAt del row.
 *
 * Pedidos cancelados se excluyen — un cancelado no es venta.
 */
export function topMarcosVendidos(
  db: DB,
  opts: { desde: string; hasta: string; limit?: number }
): FilaTopMarco[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 50))
  // SQLite COALESCE para mapear NULL/'' a 'Sin referencia' antes del GROUP BY.
  const refExpr = sql<string>`coalesce(nullif(${pedidoItems.referencia}, ''), 'Sin referencia')`
  const rows = db
    .select({
      referencia: refExpr.as('referencia'),
      cantidad: sql<number>`count(*)`.as('cantidad'),
      total: sql<number>`coalesce(sum(${pedidoItems.subtotal}), 0)`.as('total')
    })
    .from(pedidoItems)
    .innerJoin(pedidos, eq(pedidos.id, pedidoItems.pedidoId))
    .where(
      and(
        eq(pedidoItems.tipoItem, 'marco'),
        gte(pedidos.fechaIngreso, opts.desde),
        lte(pedidos.fechaIngreso, opts.hasta),
        ne(pedidos.estado, 'cancelado')
      )
    )
    .groupBy(refExpr)
    .orderBy(desc(sql`count(*)`), desc(sql`sum(${pedidoItems.subtotal})`))
    .limit(limit)
    .all()
  return rows.map((r) => ({
    referencia: r.referencia,
    cantidad: r.cantidad ?? 0,
    total: r.total ?? 0
  }))
}

export type FilaIngresoTipo = {
  /** Categoría comercial. Para pedidos viene de `tipo_trabajo`. Las clases,
   *  kits y cuentas de cobro se mapean a categorías sintéticas con prefijo
   *  para que el donut las pueda diferenciar visualmente del resto. */
  categoria: TipoTrabajo | 'clases' | 'kits' | 'contratos'
  total: number
  cantidad: number
}

/**
 * Distribución de ingresos por categoría comercial — usada por el donut chart.
 *
 * Combina cuatro fuentes:
 *   1. Pedidos (`facturas.total` no anuladas) agrupado por `pedidos.tipoTrabajo`.
 *   2. Clases (`pagos_clases_detalle.monto`).
 *   3. Kits (`ventas_kits.precio`).
 *   4. Cuentas de cobro pagadas (`cuentasCobro.totalNeto` con estado 'pagada').
 *
 * Decisión: trabajamos sobre `facturas.fecha` para pedidos (consistente con
 * `resumenComercialMensual`) y `fecha` directa para clases/kits/cuentas.
 * Esto refleja "cuándo se cobró" — no cuándo se cotizó.
 *
 * Sobre duplicación: el `INNER JOIN facturas → pedidos` NO duplica porque
 * `pedidos.id` es PK y cada factura tiene exactamente un pedido. Si en el
 * futuro se agrega un JOIN adicional con `pagos`, será necesario reescribir
 * con subquery DISTINCT para evitar fan-out.
 */
export function ingresosPorTipoTrabajo(
  db: DB,
  opts: { desde: string; hasta: string }
): FilaIngresoTipo[] {
  // 1. Pedidos por tipo de trabajo
  const pedidosRows = db
    .select({
      tipoTrabajo: pedidos.tipoTrabajo,
      total: sql<number>`coalesce(sum(${facturas.total}), 0)`.as('total'),
      cantidad: sql<number>`count(*)`.as('cantidad')
    })
    .from(facturas)
    .innerJoin(pedidos, eq(pedidos.id, facturas.pedidoId))
    .where(
      and(
        gte(facturas.fecha, opts.desde),
        lte(facturas.fecha, opts.hasta),
        ne(facturas.estado, 'anulada')
      )
    )
    .groupBy(pedidos.tipoTrabajo)
    .all()

  const filas: FilaIngresoTipo[] = pedidosRows.map((r) => ({
    categoria: r.tipoTrabajo as TipoTrabajo,
    total: r.total ?? 0,
    cantidad: r.cantidad ?? 0
  }))

  // 2. Clases
  const clasesAgg = db
    .select({
      total: sql<number>`coalesce(sum(${pagosClasesDetalle.monto}), 0)`.as('total'),
      cantidad: sql<number>`count(*)`.as('cantidad')
    })
    .from(pagosClasesDetalle)
    .where(
      and(gte(pagosClasesDetalle.fecha, opts.desde), lte(pagosClasesDetalle.fecha, opts.hasta))
    )
    .get()
  if ((clasesAgg?.total ?? 0) > 0) {
    filas.push({
      categoria: 'clases',
      total: clasesAgg!.total!,
      cantidad: clasesAgg!.cantidad ?? 0
    })
  }

  // 3. Kits
  const kitsAgg = db
    .select({
      total: sql<number>`coalesce(sum(${ventasKits.precio}), 0)`.as('total'),
      cantidad: sql<number>`count(*)`.as('cantidad')
    })
    .from(ventasKits)
    .where(and(gte(ventasKits.fecha, opts.desde), lte(ventasKits.fecha, opts.hasta)))
    .get()
  if ((kitsAgg?.total ?? 0) > 0) {
    filas.push({
      categoria: 'kits',
      total: kitsAgg!.total!,
      cantidad: kitsAgg!.cantidad ?? 0
    })
  }

  // 4. Cuentas de cobro pagadas (contratos corporativos)
  const cuentasAgg = db
    .select({
      total: sql<number>`coalesce(sum(${cuentasCobro.totalNeto}), 0)`.as('total'),
      cantidad: sql<number>`count(*)`.as('cantidad')
    })
    .from(cuentasCobro)
    .where(
      and(
        eq(cuentasCobro.estado, 'pagada'),
        gte(cuentasCobro.fecha, opts.desde),
        lte(cuentasCobro.fecha, opts.hasta)
      )
    )
    .get()
  if ((cuentasAgg?.total ?? 0) > 0) {
    filas.push({
      categoria: 'contratos',
      total: cuentasAgg!.total!,
      cantidad: cuentasAgg!.cantidad ?? 0
    })
  }

  return filas.sort((a, b) => b.total - a.total)
}
