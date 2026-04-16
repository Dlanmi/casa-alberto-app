import { and, desc, eq, sql } from 'drizzle-orm'
import type { DB } from '../index'
import { generarConsecutivo } from '../consecutivos'
import {
  contratoItems,
  contratos,
  cuentasCobro,
  movimientosFinancieros,
  type EstadoContrato
} from '../schema'

export type ItemContrato = {
  descripcion: string
  cantidad: number
  valorUnitario: number
}

export type NuevoContrato = {
  clienteId: number
  descripcion?: string | null
  retencionPorcentaje?: number
  condiciones?: string | null
  fecha: string
  items: ItemContrato[]
}

export function crearContrato(db: DB, data: NuevoContrato) {
  return db.transaction((tx) => {
    const numero = generarConsecutivo(tx as unknown as DB, 'contrato')

    const subtotales = data.items.map((it) => ({
      ...it,
      subtotal: Math.round(it.cantidad * it.valorUnitario)
    }))
    const total = subtotales.reduce((acc, it) => acc + it.subtotal, 0)
    const retencionPorcentaje = data.retencionPorcentaje ?? 0
    if (retencionPorcentaje < 0 || retencionPorcentaje > 100) {
      throw new Error('El porcentaje de retención debe estar entre 0 y 100')
    }
    // Retención en la fuente (Fase 2 §F.3). Se redondea a pesos enteros para
    // evitar arrastrar decimales en la cuenta de cobro.
    const retencionMonto = Math.round(total * (retencionPorcentaje / 100))

    const contrato = tx
      .insert(contratos)
      .values({
        numero,
        clienteId: data.clienteId,
        descripcion: data.descripcion ?? null,
        total,
        retencionPorcentaje,
        retencionMonto,
        condiciones: data.condiciones ?? null,
        estado: 'enviada',
        fecha: data.fecha
      })
      .returning()
      .get()

    for (const it of subtotales) {
      tx.insert(contratoItems)
        .values({
          contratoId: contrato.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          valorUnitario: it.valorUnitario,
          subtotal: it.subtotal
        })
        .run()
    }

    return contrato
  })
}

export function listarContratos(db: DB, opts: { estado?: EstadoContrato } = {}) {
  const q = db.select().from(contratos)
  if (opts.estado)
    return q.where(eq(contratos.estado, opts.estado)).orderBy(desc(contratos.fecha)).all()
  return q.orderBy(desc(contratos.fecha)).all()
}

export function obtenerContrato(db: DB, id: number) {
  const contrato = db.select().from(contratos).where(eq(contratos.id, id)).get()
  if (!contrato) return null
  const items = db.select().from(contratoItems).where(eq(contratoItems.contratoId, id)).all()
  return { ...contrato, items }
}

const TRANSICIONES_CONTRATO: Record<string, string[]> = {
  enviada: ['aprobada', 'rechazada'],
  aprobada: ['cobrada'],
  cobrada: [],
  rechazada: []
}

export function cambiarEstadoContrato(db: DB, id: number, estado: EstadoContrato) {
  const prev = db.select().from(contratos).where(eq(contratos.id, id)).get()
  if (!prev) throw new Error(`Contrato ${id} no encontrado`)

  const permitidos = TRANSICIONES_CONTRATO[prev.estado] ?? []
  if (!permitidos.includes(estado)) {
    throw new Error(`No se puede pasar de "${prev.estado}" a "${estado}"`)
  }

  return (
    db
      .update(contratos)
      .set({ estado, updatedAt: sql`(datetime('now'))` })
      .where(eq(contratos.id, id))
      .returning()
      .get() ?? null
  )
}

export type NuevaCuentaCobro = {
  contratoId: number
  total: number
  retencion?: number
  fecha: string
}

export function crearCuentaCobro(db: DB, data: NuevaCuentaCobro) {
  return db.transaction((tx) => {
    const contrato = tx.select().from(contratos).where(eq(contratos.id, data.contratoId)).get()
    if (!contrato) throw new Error(`Contrato ${data.contratoId} no encontrado`)

    // Solo se pueden generar cuentas de cobro sobre contratos aprobados.
    // 'enviada' aún no está en firme; 'rechazada'/'cobrada' están cerrados.
    if (contrato.estado !== 'aprobada') {
      throw new Error(
        `No se puede crear cuenta de cobro en contrato con estado "${contrato.estado}". ` +
          `Debe estar aprobado.`
      )
    }

    if (!Number.isFinite(data.total) || data.total < 0) {
      throw new Error('El total de la cuenta de cobro no puede ser negativo')
    }
    const retencion = Math.round(data.retencion ?? 0)
    if (retencion < 0) {
      throw new Error('La retención no puede ser negativa')
    }
    if (retencion > data.total) {
      throw new Error('La retención no puede superar el total de la cuenta de cobro')
    }

    // Consecutivo central para cuentas de cobro (CC-0001, atómico vía
    // generarConsecutivo en vez del parseo del último número, que era racy
    // si se pre-existían registros con numeración irregular).
    const numero = generarConsecutivo(tx as unknown as DB, 'cuenta_cobro')

    const total = Math.round(data.total)
    const totalNeto = total - retencion

    return tx
      .insert(cuentasCobro)
      .values({
        numero,
        contratoId: data.contratoId,
        total,
        retencion,
        totalNeto,
        estado: 'pendiente',
        fecha: data.fecha
      })
      .returning()
      .get()
  })
}

export function marcarCuentaCobroPagada(db: DB, id: number, fecha: string) {
  return db.transaction((tx) => {
    const cc = tx.select().from(cuentasCobro).where(eq(cuentasCobro.id, id)).get()
    if (!cc) throw new Error(`Cuenta de cobro ${id} no encontrada`)

    // Idempotencia: si ya está pagada, rechazar. Evita doble ingreso en
    // `movimientos_financieros` por doble click o doble procesamiento.
    if (cc.estado === 'pagada') {
      throw new Error('La cuenta de cobro ya estaba marcada como pagada')
    }

    const updated = tx
      .update(cuentasCobro)
      .set({ estado: 'pagada' })
      .where(eq(cuentasCobro.id, id))
      .returning()
      .get()

    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'ingreso',
        categoria: 'contratos',
        descripcion: `Cobro cuenta ${cc.numero}`,
        monto: cc.totalNeto,
        fecha,
        referenciaTipo: 'cuenta_cobro',
        referenciaId: cc.id
      })
      .run()

    return updated
  })
}

export function listarCuentasCobro(db: DB, contratoId?: number) {
  const q = db.select().from(cuentasCobro)
  if (contratoId)
    return q.where(eq(cuentasCobro.contratoId, contratoId)).orderBy(desc(cuentasCobro.fecha)).all()
  return q.orderBy(desc(cuentasCobro.fecha)).all()
}

// Silenciar imports no usados en esta primera versión
void and
