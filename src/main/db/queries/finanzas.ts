import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import {
  facturas,
  movimientosFinancieros,
  pagos,
  pedidos,
  type CategoriaMovimiento,
  type ReferenciaMovimiento,
  type TipoMovimientoFin,
  type TipoTrabajo
} from '../schema'

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
  // mes = 'YYYY-MM'
  const desde = `${mes}-01`
  const hasta = `${mes}-31`

  const totales = db
    .select({
      tipo: movimientosFinancieros.tipo,
      total: sql<number>`coalesce(sum(${movimientosFinancieros.monto}), 0)`.as('total')
    })
    .from(movimientosFinancieros)
    .where(and(gte(movimientosFinancieros.fecha, desde), lte(movimientosFinancieros.fecha, hasta)))
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
    .where(and(gte(movimientosFinancieros.fecha, desde), lte(movimientosFinancieros.fecha, hasta)))
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
  const hasta = `${mes}-31`

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
        lte(movimientosFinancieros.fecha, hasta)
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
        lte(movimientosFinancieros.fecha, hasta)
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
