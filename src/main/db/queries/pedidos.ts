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
import type { DB } from '../index'
import { generarConsecutivo } from '../consecutivos'
import {
  clientes,
  devoluciones,
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
import { TRANSICIONES_VALIDAS } from '@shared/pedido-transitions'

export { TRANSICIONES_VALIDAS }

const ESTADOS_TERMINALES: EstadoPedido[] = ['listo', 'entregado', 'cancelado']
const ESTADOS_NO_FACTURABLES: EstadoPedido[] = ['cotizado', 'cancelado']
const ESTADOS_ACTIVOS_MATRIZ: EstadoPedido[] = ['confirmado', 'en_proceso', 'listo']
const DAY_MS = 24 * 60 * 60 * 1000

// Fase 6 — días tras los cuales un pedido entregado se considera archivado y
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
  anchoPaspartuCm?: number | null
  tipoPaspartu?: 'pintado' | 'acrilico' | null
  tipoVidrio?: string | null
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
  opts: {
    estado?: EstadoPedido
    clienteId?: number
    limit?: number
    // Fase 6 — por defecto excluye pedidos entregados hace más de DIAS_ARCHIVADO
    // días para no inflar el Kanban con histórico. El toggle "Ver archivados"
    // de la UI pone esto en true cuando papá quiere ver el histórico completo.
    incluirArchivados?: boolean
  } = {}
) {
  // Asegura que la reclasificación automática (listo → sin_reclamar tras +15 días)
  // esté aplicada antes de devolver resultados. Idempotente, sin costo si no hay
  // candidatos.
  reclasificarPedidos(db)
  const conds: SQL[] = []
  if (opts.estado) conds.push(eq(pedidos.estado, opts.estado))
  if (opts.clienteId) conds.push(eq(pedidos.clienteId, opts.clienteId))
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
    const saldo = Math.max(0, total - pagado)
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
