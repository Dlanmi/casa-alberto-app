import { and, eq, like, or, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import { proveedores, type TipoProveedor } from '../schema'

export type NuevoProveedor = {
  nombre: string
  producto?: string | null
  tipo?: TipoProveedor
  telefono?: string | null
  diasPedido?: string | null
  formaPago?: string | null
  formaEntrega?: string | null
  notas?: string | null
}

export type ActualizarProveedor = Partial<NuevoProveedor> & { activo?: boolean }

export function listarProveedores(
  db: DB,
  opts: { busqueda?: string; soloActivos?: boolean; tipo?: TipoProveedor } = {}
) {
  const conditions: SQL[] = []
  if (opts.soloActivos !== false) conditions.push(eq(proveedores.activo, true))
  if (opts.tipo) conditions.push(eq(proveedores.tipo, opts.tipo))
  if (opts.busqueda) {
    const q = `%${opts.busqueda}%`
    conditions.push(or(like(proveedores.nombre, q), like(proveedores.producto, q))!)
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return db.select().from(proveedores).where(where).orderBy(proveedores.nombre).all()
}

export function obtenerProveedor(db: DB, id: number) {
  return db.select().from(proveedores).where(eq(proveedores.id, id)).get() ?? null
}

export function crearProveedor(db: DB, data: NuevoProveedor) {
  return db
    .insert(proveedores)
    .values({
      nombre: data.nombre,
      producto: data.producto ?? null,
      tipo: data.tipo ?? 'otro',
      telefono: data.telefono ?? null,
      diasPedido: data.diasPedido ?? null,
      formaPago: data.formaPago ?? null,
      formaEntrega: data.formaEntrega ?? null,
      notas: data.notas ?? null
    })
    .returning()
    .get()
}

export function actualizarProveedor(db: DB, id: number, data: ActualizarProveedor) {
  return (
    db
      .update(proveedores)
      .set({ ...data, updatedAt: sql`(datetime('now'))` })
      .where(eq(proveedores.id, id))
      .returning()
      .get() ?? null
  )
}

export function desactivarProveedor(db: DB, id: number) {
  return actualizarProveedor(db, id, { activo: false })
}
