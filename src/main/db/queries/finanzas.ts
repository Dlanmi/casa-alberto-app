import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import {
  movimientosFinancieros,
  type CategoriaMovimiento,
  type ReferenciaMovimiento,
  type TipoMovimientoFin
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
