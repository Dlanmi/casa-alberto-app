import { and, desc, eq, gte, inArray, isNull, lt, lte, not, or, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import { generarConsecutivo } from '../consecutivos'
import {
  clientes,
  facturas,
  historialCambios,
  pagos,
  pedidoItems,
  pedidos,
  type EstadoPedido,
  type TipoEntrega,
  type TipoTrabajo
} from '../schema'
import type { ResultadoCotizacion } from './cotizador'

const ESTADOS_TERMINALES: EstadoPedido[] = ['listo', 'entregado', 'cancelado']
const ESTADOS_NO_FACTURABLES: EstadoPedido[] = ['cotizado', 'cancelado']

export type NuevoPedidoDatos = {
  clienteId: number
  tipoTrabajo: TipoTrabajo
  descripcion?: string | null
  anchoCm?: number | null
  altoCm?: number | null
  anchoPaspartuCm?: number | null
  tipoPaspartu?: 'pintado' | 'acrilico' | null
  tipoVidrio?: 'claro' | 'antirreflectivo' | 'ninguno' | null
  porcentajeMateriales?: number
  tipoEntrega?: TipoEntrega
  fechaIngreso: string
  fechaEntrega?: string | null
  notas?: string | null
}

export function crearPedidoDesdeCotizacion(
  db: DB,
  datos: NuevoPedidoDatos,
  cotizacion: ResultadoCotizacion
) {
  if (datos.fechaEntrega && datos.fechaIngreso && datos.fechaEntrega < datos.fechaIngreso) {
    throw new Error('La fecha de entrega no puede ser anterior a la fecha de ingreso')
  }

  return db.transaction((tx) => {
    const numero = generarConsecutivo(tx as unknown as DB, 'pedido')
    const pedido = tx
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
        precioTotal: cotizacion.precioTotal,
        estado: 'cotizado',
        tipoEntrega: datos.tipoEntrega ?? 'estandar',
        fechaIngreso: datos.fechaIngreso,
        fechaEntrega: datos.fechaEntrega ?? null,
        notas: datos.notas ?? null
      })
      .returning()
      .get()

    for (const item of cotizacion.items) {
      tx.insert(pedidoItems)
        .values({
          pedidoId: pedido.id,
          tipoItem: item.tipoItem,
          descripcion: item.descripcion ?? null,
          referencia: item.referencia ?? null,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario ?? null,
          subtotal: item.subtotal,
          metadata: item.metadata ?? null
        })
        .run()
    }

    return pedido
  })
}

export function listarPedidos(
  db: DB,
  opts: { estado?: EstadoPedido; clienteId?: number; limit?: number } = {}
) {
  // Asegura que la reclasificación automática (listo → sin_reclamar tras +15 días)
  // esté aplicada antes de devolver resultados. Idempotente, sin costo si no hay
  // candidatos.
  reclasificarPedidos(db)
  const conds: SQL[] = []
  if (opts.estado) conds.push(eq(pedidos.estado, opts.estado))
  if (opts.clienteId) conds.push(eq(pedidos.clienteId, opts.clienteId))
  const where = conds.length > 0 ? and(...conds) : undefined
  const q = db.select().from(pedidos).where(where).orderBy(desc(pedidos.createdAt))
  if (opts.limit) return q.limit(opts.limit).all()
  return q.all()
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

export const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  cotizado: ['confirmado', 'cancelado'],
  confirmado: ['en_proceso', 'cancelado'],
  en_proceso: ['listo', 'cancelado'],
  listo: ['entregado', 'sin_reclamar', 'cancelado'],
  entregado: [],
  sin_reclamar: ['entregado', 'cancelado'],
  cancelado: []
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

    const updated = tx
      .update(pedidos)
      .set({ estado: nuevoEstado, updatedAt: sql`(datetime('now'))` })
      .where(eq(pedidos.id, id))
      .returning()
      .get()

    if (nuevoEstado === 'cancelado') {
      const facturasActivas = tx
        .select()
        .from(facturas)
        .where(and(eq(facturas.pedidoId, id), not(eq(facturas.estado, 'anulada'))))
        .all()
      for (const f of facturasActivas) {
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
        lte(
          sql`julianday(${pedidos.fechaEntrega}) - julianday('now')`,
          sql.raw(String(diasLimite))
        ),
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

export function pedidosSinAbono(db: DB) {
  // Pedidos con factura pero sin pagos registrados (saldo total = factura.total).
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
    .where(not(inArray(pedidos.estado, ESTADOS_NO_FACTURABLES)))
    .groupBy(pedidos.id)
    .having(sql`coalesce(sum(${pagos.monto}), 0) = 0`)
    .all()
  return rows
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
          sql`julianday('now') - julianday(${pedidos.updatedAt}) > ${sql.raw(String(diasLimite))}`
        )
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
          sql`julianday('now') - julianday(${pedidos.updatedAt}) > ${sql.raw(String(diasLimite))}`
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

export function obtenerMatrizUrgencia(db: DB, diasUrgencia = 2): MatrizUrgencia {
  const activos = db
    .select()
    .from(pedidos)
    .where(inArray(pedidos.estado, ['confirmado', 'en_proceso', 'listo']))
    .all()

  // Conjunto de pedidoId que NO tienen pagos (sin_abono)
  const sinAbonoRows = db
    .select({ pedidoId: pedidos.id })
    .from(pedidos)
    .leftJoin(facturas, eq(facturas.pedidoId, pedidos.id))
    .leftJoin(pagos, eq(pagos.facturaId, facturas.id))
    .where(
      and(
        inArray(pedidos.estado, ['confirmado', 'en_proceso', 'listo']),
        // factura existe y no anulada, pero sin pagos registrados
        or(isNull(facturas.id), not(eq(facturas.estado, 'anulada')))
      )
    )
    .groupBy(pedidos.id)
    .having(sql`coalesce(sum(${pagos.monto}), 0) = 0`)
    .all()
  const sinAbonoSet = new Set(sinAbonoRows.map((r) => r.pedidoId))

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limiteUrgente = hoy.getTime() + diasUrgencia * 86400000

  let urgenteSinAbono = 0
  let urgenteConAbono = 0
  let normalSinAbono = 0
  let normalConAbono = 0
  let atrasados = 0

  for (const p of activos) {
    const sinAbono = sinAbonoSet.has(p.id)
    let esUrgente = false
    if (p.fechaEntrega) {
      const entrega = new Date(`${p.fechaEntrega}T12:00:00`).getTime()
      esUrgente = entrega <= limiteUrgente
      if (entrega < hoy.getTime()) atrasados++
    }
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
    total: activos.length,
    diasUrgencia
  }
}
