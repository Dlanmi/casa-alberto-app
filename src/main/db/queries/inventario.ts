import { and, eq, sql } from 'drizzle-orm'
import type { DB } from '../index'
import {
  inventario,
  movimientosInventario,
  type MotivoMovInventario,
  type TipoInventario,
  type TipoMovInventario,
  type UnidadInventario
} from '../schema'

export type NuevoInventarioItem = {
  nombre: string
  referencia?: string | null
  tipo: TipoInventario
  unidad: UnidadInventario
  stockActual?: number
  stockMinimo?: number
}

export function listarInventario(db: DB, soloActivos = true) {
  const q = db.select().from(inventario)
  if (soloActivos) return q.where(eq(inventario.activo, true)).orderBy(inventario.nombre).all()
  return q.orderBy(inventario.nombre).all()
}

export function crearItemInventario(db: DB, data: NuevoInventarioItem) {
  return db
    .insert(inventario)
    .values({
      nombre: data.nombre,
      referencia: data.referencia ?? null,
      tipo: data.tipo,
      unidad: data.unidad,
      stockActual: data.stockActual ?? 0,
      stockMinimo: data.stockMinimo ?? 0
    })
    .returning()
    .get()
}

export type NuevoMovimientoInventario = {
  inventarioId: number
  tipo: TipoMovInventario
  cantidad: number
  motivo?: MotivoMovInventario | null
  pedidoId?: number | null
  proveedorId?: number | null
  fecha: string
  notas?: string | null
}

export function registrarMovimientoInventario(db: DB, data: NuevoMovimientoInventario) {
  return db.transaction((tx) => {
    const item = tx.select().from(inventario).where(eq(inventario.id, data.inventarioId)).get()
    if (!item) throw new Error(`Inventario ${data.inventarioId} no encontrado`)

    const delta = data.tipo === 'entrada' ? data.cantidad : -data.cantidad
    const nuevoStock = item.stockActual + delta
    if (nuevoStock < 0) {
      throw new Error(
        `Stock insuficiente: ${item.nombre} tiene ${item.stockActual}, se intentan sacar ${data.cantidad}`
      )
    }

    const mov = tx
      .insert(movimientosInventario)
      .values({
        inventarioId: data.inventarioId,
        tipo: data.tipo,
        cantidad: data.cantidad,
        motivo: data.motivo ?? null,
        pedidoId: data.pedidoId ?? null,
        proveedorId: data.proveedorId ?? null,
        fecha: data.fecha,
        notas: data.notas ?? null
      })
      .returning()
      .get()

    tx.update(inventario)
      .set({ stockActual: nuevoStock, updatedAt: sql`(datetime('now'))` })
      .where(eq(inventario.id, data.inventarioId))
      .run()

    return { mov, nuevoStock }
  })
}

export function alertasStockBajo(db: DB) {
  return db
    .select()
    .from(inventario)
    .where(
      and(eq(inventario.activo, true), sql`${inventario.stockActual} <= ${inventario.stockMinimo}`)
    )
    .orderBy(inventario.nombre)
    .all()
}
