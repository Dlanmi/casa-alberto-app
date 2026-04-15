import { and, desc, eq, not, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import { generarConsecutivo } from '../consecutivos'
import {
  devoluciones,
  facturas,
  movimientosFinancieros,
  pagos,
  pedidos,
  type CategoriaMovimiento,
  type EstadoFactura,
  type MetodoPago
} from '../schema'

export type NuevaFactura = {
  pedidoId: number
  clienteId: number
  fecha: string
  total: number
  fechaEntrega?: string | null
  notas?: string | null
}

export function crearFactura(db: DB, data: NuevaFactura) {
  return db.transaction((tx) => {
    // SPEC-007 — Prevenir facturas duplicadas por pedido. Si ya existe una
    // factura activa (no anulada), devolvemos un error con el número para
    // que el usuario pueda encontrarla rápido en la vista de facturas.
    const existente = tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.pedidoId, data.pedidoId), not(eq(facturas.estado, 'anulada'))))
      .get()
    if (existente) {
      throw new Error(
        `Este pedido ya tiene una factura activa (${existente.numero}). ` +
          'Anúlala primero si necesitas reemplazarla.'
      )
    }

    // Validate pedido estado before creating factura
    const pedido = tx.select().from(pedidos).where(eq(pedidos.id, data.pedidoId)).get()
    if (!pedido) throw new Error('Pedido no encontrado')
    if (['cotizado', 'cancelado'].includes(pedido.estado)) {
      throw new Error(
        `No se puede facturar un pedido en estado "${pedido.estado}". ` +
          'Confirma el pedido antes de generar la factura.'
      )
    }

    const numero = generarConsecutivo(tx as unknown as DB, 'factura')
    return tx
      .insert(facturas)
      .values({
        numero,
        pedidoId: data.pedidoId,
        clienteId: data.clienteId,
        fecha: data.fecha,
        total: data.total,
        fechaEntrega: data.fechaEntrega ?? null,
        notas: data.notas ?? null
      })
      .returning()
      .get()
  })
}

export function obtenerFactura(db: DB, id: number) {
  const factura = db.select().from(facturas).where(eq(facturas.id, id)).get()
  if (!factura) return null
  const pagosList = db.select().from(pagos).where(eq(pagos.facturaId, id)).all()
  return { ...factura, pagos: pagosList }
}

export function listarFacturas(
  db: DB,
  opts: { clienteId?: number; estado?: EstadoFactura; limit?: number } = {}
) {
  const conds: SQL[] = []
  if (opts.clienteId) conds.push(eq(facturas.clienteId, opts.clienteId))
  if (opts.estado) conds.push(eq(facturas.estado, opts.estado))
  const where = conds.length > 0 ? and(...conds) : undefined
  const q = db.select().from(facturas).where(where).orderBy(desc(facturas.fecha))
  if (opts.limit) return q.limit(opts.limit).all()
  return q.all()
}

export function getSaldoFactura(db: DB, facturaId: number): number {
  const factura = obtenerFactura(db, facturaId)
  if (!factura) return 0
  const totalPagos = db
    .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
    .from(pagos)
    .where(eq(pagos.facturaId, facturaId))
    .get()
  const totalDev = db
    .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
    .from(devoluciones)
    .where(eq(devoluciones.facturaId, facturaId))
    .get()
  return factura.total - (totalPagos?.sum ?? 0) + (totalDev?.sum ?? 0)
}

function categoriaDesdePedido(tipoTrabajo: string): CategoriaMovimiento {
  if (tipoTrabajo === 'restauracion') return 'restauracion'
  return 'enmarcacion'
}

export type NuevoPago = {
  facturaId: number
  monto: number
  metodoPago: MetodoPago
  fecha: string
  notas?: string | null
}

export function registrarPago(db: DB, data: NuevoPago) {
  return db.transaction((tx) => {
    if (data.monto <= 0) {
      throw new Error('El monto del pago debe ser mayor a 0')
    }

    const factura = tx.select().from(facturas).where(eq(facturas.id, data.facturaId)).get()
    if (!factura) throw new Error(`Factura ${data.facturaId} no encontrada`)

    const pedido = tx.select().from(pedidos).where(eq(pedidos.id, factura.pedidoId)).get()
    if (!pedido) throw new Error(`Pedido ${factura.pedidoId} no encontrado`)

    // Validar que el monto no exceda el saldo pendiente
    const currentPagos = tx
      .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
      .from(pagos)
      .where(eq(pagos.facturaId, data.facturaId))
      .get()
    const currentDev = tx
      .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
      .from(devoluciones)
      .where(eq(devoluciones.facturaId, data.facturaId))
      .get()
    const saldoActual = factura.total - (currentPagos?.sum ?? 0) + (currentDev?.sum ?? 0)
    if (data.monto > saldoActual) {
      throw new Error(`El monto excede el saldo pendiente de ${saldoActual}`)
    }

    const pago = tx
      .insert(pagos)
      .values({
        facturaId: data.facturaId,
        monto: data.monto,
        metodoPago: data.metodoPago,
        fecha: data.fecha,
        notas: data.notas ?? null
      })
      .returning()
      .get()

    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'ingreso',
        categoria: categoriaDesdePedido(pedido.tipoTrabajo),
        descripcion: `Pago factura ${factura.numero}`,
        monto: data.monto,
        fecha: data.fecha,
        referenciaTipo: 'pago',
        referenciaId: pago.id
      })
      .run()

    // Recalcular estado de la factura
    const totalPagos = tx
      .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
      .from(pagos)
      .where(eq(pagos.facturaId, data.facturaId))
      .get()
    const totalDev = tx
      .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
      .from(devoluciones)
      .where(eq(devoluciones.facturaId, data.facturaId))
      .get()
    const saldo = factura.total - (totalPagos?.sum ?? 0) + (totalDev?.sum ?? 0)
    const nuevoEstado: EstadoFactura = saldo <= 0 ? 'pagada' : factura.estado

    if (nuevoEstado !== factura.estado) {
      tx.update(facturas)
        .set({ estado: nuevoEstado, updatedAt: sql`(datetime('now'))` })
        .where(eq(facturas.id, data.facturaId))
        .run()
    }

    return { pago, saldo, estadoFactura: nuevoEstado }
  })
}

export type NuevaDevolucion = {
  facturaId: number
  monto: number
  motivo: string
  fecha: string
}

export function registrarDevolucion(db: DB, data: NuevaDevolucion) {
  return db.transaction((tx) => {
    const factura = tx.select().from(facturas).where(eq(facturas.id, data.facturaId)).get()
    if (!factura) throw new Error(`Factura ${data.facturaId} no encontrada`)

    const dev = tx
      .insert(devoluciones)
      .values({
        facturaId: data.facturaId,
        monto: data.monto,
        motivo: data.motivo,
        fecha: data.fecha
      })
      .returning()
      .get()

    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'gasto',
        categoria: 'devolucion',
        descripcion: `Devolución factura ${factura.numero}: ${data.motivo}`,
        monto: data.monto,
        fecha: data.fecha,
        referenciaTipo: 'devolucion',
        referenciaId: dev.id
      })
      .run()

    // Recalculate factura estado after devolucion
    const totalPagos = tx
      .select({ sum: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
      .from(pagos)
      .where(eq(pagos.facturaId, data.facturaId))
      .get()
    const totalDev = tx
      .select({ sum: sql<number>`coalesce(sum(${devoluciones.monto}), 0)` })
      .from(devoluciones)
      .where(eq(devoluciones.facturaId, data.facturaId))
      .get()
    const saldo = factura.total - (totalPagos?.sum ?? 0) + (totalDev?.sum ?? 0)
    const nuevoEstado = saldo <= 0 ? 'pagada' : 'pendiente'
    if (nuevoEstado !== factura.estado) {
      tx.update(facturas)
        .set({ estado: nuevoEstado, updatedAt: sql`(datetime('now'))` })
        .where(eq(facturas.id, data.facturaId))
        .run()
    }

    return dev
  })
}

export function anularFactura(db: DB, id: number) {
  return (
    db
      .update(facturas)
      .set({ estado: 'anulada', updatedAt: sql`(datetime('now'))` })
      .where(eq(facturas.id, id))
      .returning()
      .get() ?? null
  )
}
