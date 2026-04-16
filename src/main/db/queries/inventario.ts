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
  // Fase 2 §E.2 — los marcos NO se almacenan, se piden bajo demanda al
  // proveedor. Filtramos cualquier registro legado que pudiera existir con
  // tipo 'marco' para que no aparezca en la UI.
  if (soloActivos) {
    return q
      .where(and(eq(inventario.activo, true), sql`${inventario.tipo} != 'marco'`))
      .orderBy(inventario.nombre)
      .all()
  }
  return q
    .where(sql`${inventario.tipo} != 'marco'`)
    .orderBy(inventario.nombre)
    .all()
}

export function crearItemInventario(db: DB, data: NuevoInventarioItem) {
  // Fase 2 §E.2 — los marcos se piden a Alberto/Edimol los lunes y miércoles.
  // Nunca se almacenan, así que rechazamos explícitamente crear inventario
  // de tipo 'marco' (aunque el enum lo incluye para compatibilidad histórica).
  if (data.tipo === 'marco') {
    throw new Error(
      'Los marcos no se almacenan en inventario. Se piden al proveedor cuando entra el trabajo.'
    )
  }
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

    // Validación explícita en TS. El CHECK constraint de SQLite (schema.ts)
    // también lo enforza, pero preferimos error claro en español antes de
    // que SQLite tire un mensaje técnico ("CHECK constraint failed").
    if (!Number.isInteger(data.cantidad) || data.cantidad <= 0) {
      throw new Error('La cantidad debe ser un entero mayor a 0')
    }

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
