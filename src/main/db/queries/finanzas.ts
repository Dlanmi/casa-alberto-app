import { and, desc, eq, gte, lt, lte, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import {
  facturas,
  movimientosFinancieros,
  pagos,
  pagosClasesDetalle,
  pedidos,
  ventasKits,
  type CategoriaMovimiento,
  type ReferenciaMovimiento,
  type TipoMovimientoFin,
  type TipoTrabajo
} from '../schema'

/**
 * Calcula el primer día del mes siguiente. Usado para filtros de rango
 * exclusivo `fecha < siguiente-mes-01`, más correcto que `fecha <= ${mes}-31`
 * (que falla en febrero o meses de 30 días con strings tipo '2026-02-30').
 */
function primerDiaMesSiguiente(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const next = new Date(y, m, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
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
