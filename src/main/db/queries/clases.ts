import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import {
  acudientes,
  asistencias,
  clases,
  estudiantes,
  movimientosFinancieros,
  pagosClases,
  pagosClasesDetalle,
  ventasKits,
  type DiaSemana,
  type EstadoPagoClase,
  type MetodoPago
} from '../schema'
import { getConfigNumber } from './configuracion'

// ---------------------------------------------------------------------------
// Clases
// ---------------------------------------------------------------------------

export type NuevaClase = {
  nombre: string
  diaSemana: DiaSemana
  horaInicio: string
  horaFin: string
}

export function listarClases(db: DB, soloActivas = true) {
  const q = db.select().from(clases)
  if (soloActivas) return q.where(eq(clases.activo, true)).all()
  return q.all()
}

export function crearClase(db: DB, data: NuevaClase) {
  return db.insert(clases).values(data).returning().get()
}

// ---------------------------------------------------------------------------
// Estudiantes
// ---------------------------------------------------------------------------

export type NuevoEstudiante = {
  clienteId: number
  claseId?: number | null
  fechaIngreso: string
  esMenor?: boolean
}

export function listarEstudiantes(db: DB, soloActivos = true) {
  const q = db.select().from(estudiantes)
  if (soloActivos) return q.where(eq(estudiantes.activo, true)).all()
  return q.all()
}

export function obtenerEstudiante(db: DB, id: number) {
  return db.select().from(estudiantes).where(eq(estudiantes.id, id)).get() ?? null
}

export function crearEstudiante(db: DB, data: NuevoEstudiante) {
  // Fase 2 §C.1 / §D — si el estudiante es menor de edad, exigimos que el
  // cliente asociado tenga un acudiente con nombre y teléfono. Así evitamos
  // registros incompletos de clases con menores.
  if (data.esMenor) {
    const acu = db.select().from(acudientes).where(eq(acudientes.clienteId, data.clienteId)).get()
    if (!acu || !acu.nombre.trim() || !acu.telefono.trim()) {
      throw new Error(
        'Para registrar un estudiante menor de edad primero debes añadir el acudiente (nombre y teléfono) en el cliente.'
      )
    }
  }
  return db
    .insert(estudiantes)
    .values({
      clienteId: data.clienteId,
      claseId: data.claseId ?? null,
      fechaIngreso: data.fechaIngreso,
      esMenor: data.esMenor ?? false
    })
    .returning()
    .get()
}

export function desactivarEstudiante(db: DB, id: number) {
  return (
    db
      .update(estudiantes)
      .set({ activo: false, updatedAt: sql`(datetime('now'))` })
      .where(eq(estudiantes.id, id))
      .returning()
      .get() ?? null
  )
}

// ---------------------------------------------------------------------------
// Pagos mensuales
// ---------------------------------------------------------------------------

export type NuevoPagoClase = {
  estudianteId: number
  mes: string // 'YYYY-MM'
  monto: number
  metodoPago: MetodoPago
  fecha: string
}

export function registrarPagoClase(db: DB, data: NuevoPagoClase) {
  return db.transaction((tx) => {
    if (!Number.isFinite(data.monto) || data.monto <= 0) {
      throw new Error('El monto del pago debe ser mayor a 0')
    }
    const precioMensual = getConfigNumber(tx as unknown as DB, 'precio_clase_mensual', 0)

    let pagoClase = tx
      .select()
      .from(pagosClases)
      .where(and(eq(pagosClases.estudianteId, data.estudianteId), eq(pagosClases.mes, data.mes)))
      .get()

    if (!pagoClase) {
      pagoClase = tx
        .insert(pagosClases)
        .values({
          estudianteId: data.estudianteId,
          mes: data.mes,
          valorTotal: precioMensual,
          estado: 'pendiente'
        })
        .returning()
        .get()
    }

    // Validar que el pago no exceda el saldo pendiente del mes.
    const yaPagado = tx
      .select({ sum: sql<number>`coalesce(sum(${pagosClasesDetalle.monto}), 0)` })
      .from(pagosClasesDetalle)
      .where(eq(pagosClasesDetalle.pagoClaseId, pagoClase.id))
      .get()
    const saldo = pagoClase.valorTotal - (yaPagado?.sum ?? 0)
    if (data.monto > saldo) {
      throw new Error(`El monto (${data.monto}) excede el saldo pendiente del mes (${saldo}).`)
    }

    const detalle = tx
      .insert(pagosClasesDetalle)
      .values({
        pagoClaseId: pagoClase.id,
        monto: data.monto,
        metodoPago: data.metodoPago,
        fecha: data.fecha
      })
      .returning()
      .get()

    // Recalcular estado
    const totalPagado = tx
      .select({ sum: sql<number>`coalesce(sum(${pagosClasesDetalle.monto}), 0)` })
      .from(pagosClasesDetalle)
      .where(eq(pagosClasesDetalle.pagoClaseId, pagoClase.id))
      .get()

    const suma = totalPagado?.sum ?? 0
    let nuevoEstado: EstadoPagoClase
    if (suma <= 0) nuevoEstado = 'pendiente'
    else if (suma >= pagoClase.valorTotal) nuevoEstado = 'pagado'
    else nuevoEstado = 'parcial'

    tx.update(pagosClases)
      .set({ estado: nuevoEstado, updatedAt: sql`(datetime('now'))` })
      .where(eq(pagosClases.id, pagoClase.id))
      .run()

    // Movimiento financiero
    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'ingreso',
        categoria: 'clases',
        descripcion: `Pago clase ${data.mes} (estudiante ${data.estudianteId})`,
        monto: data.monto,
        fecha: data.fecha,
        referenciaTipo: 'pago_clase',
        referenciaId: detalle.id
      })
      .run()

    return { pagoClase: { ...pagoClase, estado: nuevoEstado }, detalle }
  })
}

export function listarPagosMes(db: DB, mes: string) {
  // Devolvemos el pago mensual enriquecido con `totalPagado` (suma de los
  // detalles) para que la UI pueda dibujar la barra de progreso real sin
  // tener que hacer N+1 round-trips.
  //
  // Implementación con LEFT JOIN + GROUP BY. La versión previa usaba un
  // subquery correlacionado con `${pagosClases.id}` interpolado dentro del
  // template `sql\`\``, pero Drizzle emitía el SQL sin propagar la
  // correlación — el subquery sumaba TODOS los detalles históricos y
  // devolvía el mismo valor a cada fila (ej: Ana paga $110k y la UI mostraba
  // $380k "pagado" en las 3 tarjetas del mes). Este patrón con JOIN es más
  // simple y Drizzle lo traduce correctamente.
  const rows = db
    .select({
      id: pagosClases.id,
      estudianteId: pagosClases.estudianteId,
      mes: pagosClases.mes,
      valorTotal: pagosClases.valorTotal,
      estado: pagosClases.estado,
      createdAt: pagosClases.createdAt,
      updatedAt: pagosClases.updatedAt,
      totalPagado: sql<number>`coalesce(sum(${pagosClasesDetalle.monto}), 0)`.as('total_pagado')
    })
    .from(pagosClases)
    .leftJoin(pagosClasesDetalle, eq(pagosClasesDetalle.pagoClaseId, pagosClases.id))
    .where(eq(pagosClases.mes, mes))
    .groupBy(pagosClases.id)
    .all()
  return rows
}

/**
 * Genera los pagos mensuales para todos los estudiantes activos (BR-012, Fase 2 §D.2).
 *
 * El sistema crea un pagoClase en estado 'pendiente' para cada estudiante activo
 * que no tenga ya un registro para el mes dado. 100% idempotente: se puede llamar
 * muchas veces y sólo creará los que falten.
 *
 * @param mes 'YYYY-MM'
 * @returns cantidad de pagos creados en esta invocación
 */
export function generarPagosDelMes(db: DB, mes: string): number {
  return db.transaction((tx) => {
    const precioMensual = getConfigNumber(tx as unknown as DB, 'precio_clase_mensual', 0)
    if (precioMensual <= 0) return 0

    const activos = tx.select().from(estudiantes).where(eq(estudiantes.activo, true)).all()
    if (activos.length === 0) return 0

    // Pagos ya existentes para el mes — evita duplicar.
    const existentes = tx
      .select({ estudianteId: pagosClases.estudianteId })
      .from(pagosClases)
      .where(eq(pagosClases.mes, mes))
      .all()
    const yaGenerados = new Set(existentes.map((e) => e.estudianteId))

    let creados = 0
    for (const est of activos) {
      if (yaGenerados.has(est.id)) continue
      tx.insert(pagosClases)
        .values({
          estudianteId: est.id,
          mes,
          valorTotal: precioMensual,
          estado: 'pendiente'
        })
        .run()
      creados++
    }
    return creados
  })
}

export function obtenerPagoClaseConDetalles(db: DB, id: number) {
  const pagoClase = db.select().from(pagosClases).where(eq(pagosClases.id, id)).get()
  if (!pagoClase) return null
  const detalles = db
    .select()
    .from(pagosClasesDetalle)
    .where(eq(pagosClasesDetalle.pagoClaseId, id))
    .orderBy(desc(pagosClasesDetalle.fecha))
    .all()
  return { ...pagoClase, detalles }
}

// ---------------------------------------------------------------------------
// Kits
// ---------------------------------------------------------------------------

export type NuevaVentaKit = {
  estudianteId?: number | null
  clienteId?: number | null
  precio?: number
  fecha: string
}

export function venderKit(db: DB, data: NuevaVentaKit) {
  return db.transaction((tx) => {
    if (!data.estudianteId && !data.clienteId) {
      throw new Error('Selecciona el estudiante o el cliente que recibe el kit')
    }
    const precio = data.precio ?? getConfigNumber(tx as unknown as DB, 'precio_kit_dibujo', 0)
    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error('El precio del kit no puede ser negativo')
    }
    const venta = tx
      .insert(ventasKits)
      .values({
        estudianteId: data.estudianteId ?? null,
        clienteId: data.clienteId ?? null,
        precio,
        fecha: data.fecha
      })
      .returning()
      .get()

    tx.insert(movimientosFinancieros)
      .values({
        tipo: 'ingreso',
        categoria: 'kit_dibujo',
        descripcion: 'Venta kit de dibujo',
        monto: precio,
        fecha: data.fecha,
        referenciaTipo: 'venta_kit',
        referenciaId: venta.id
      })
      .run()

    return venta
  })
}

// ---------------------------------------------------------------------------
// Actualizar estudiante
// ---------------------------------------------------------------------------

export function actualizarEstudiante(db: DB, id: number, data: { claseId?: number | null }) {
  return db
    .update(estudiantes)
    .set({ ...data, updatedAt: sql`(datetime('now'))` })
    .where(eq(estudiantes.id, id))
    .returning()
    .get()
}

// ---------------------------------------------------------------------------
// Asistencias
// ---------------------------------------------------------------------------

export function registrarAsistencia(
  db: DB,
  data: {
    estudianteId: number
    claseId: number
    fecha: string
    presente: boolean
    notas?: string | null
  }
) {
  // Bloquear asistencias a clases inactivas: si el dueño desactivó la clase,
  // ya no debería generar registros nuevos de asistencia.
  const clase = db.select().from(clases).where(eq(clases.id, data.claseId)).get()
  if (!clase) throw new Error(`Clase ${data.claseId} no encontrada`)
  if (!clase.activo) {
    throw new Error('No se puede registrar asistencia a una clase inactiva')
  }

  const existing = db
    .select()
    .from(asistencias)
    .where(
      and(
        eq(asistencias.estudianteId, data.estudianteId),
        eq(asistencias.claseId, data.claseId),
        eq(asistencias.fecha, data.fecha)
      )
    )
    .get()

  if (existing) {
    return db
      .update(asistencias)
      .set({ presente: data.presente, notas: data.notas ?? null })
      .where(eq(asistencias.id, existing.id))
      .returning()
      .get()
  }

  return db
    .insert(asistencias)
    .values({
      estudianteId: data.estudianteId,
      claseId: data.claseId,
      fecha: data.fecha,
      presente: data.presente,
      notas: data.notas ?? null
    })
    .returning()
    .get()
}

export function registrarAsistenciaGrupal(
  db: DB,
  claseId: number,
  fecha: string,
  items: { estudianteId: number; presente: boolean }[]
) {
  return db.transaction((tx) => {
    return items.map((item) =>
      registrarAsistencia(tx as unknown as DB, {
        estudianteId: item.estudianteId,
        claseId,
        fecha,
        presente: item.presente
      })
    )
  })
}

export function listarAsistencias(
  db: DB,
  filtros: {
    estudianteId?: number
    claseId?: number
    desde?: string
    hasta?: string
  } = {}
) {
  const conds: SQL[] = []
  if (filtros.estudianteId) conds.push(eq(asistencias.estudianteId, filtros.estudianteId))
  if (filtros.claseId) conds.push(eq(asistencias.claseId, filtros.claseId))
  if (filtros.desde) conds.push(gte(asistencias.fecha, filtros.desde))
  if (filtros.hasta) conds.push(lte(asistencias.fecha, filtros.hasta))
  const where = conds.length > 0 ? and(...conds) : undefined
  return db.select().from(asistencias).where(where).orderBy(desc(asistencias.fecha)).all()
}

export function resumenAsistenciaMes(db: DB, estudianteId: number, mes: string) {
  const desde = `${mes}-01`
  const hasta = `${mes}-31`
  const records = db
    .select()
    .from(asistencias)
    .where(
      and(
        eq(asistencias.estudianteId, estudianteId),
        gte(asistencias.fecha, desde),
        lte(asistencias.fecha, hasta)
      )
    )
    .all()
  const total = records.length
  const presentes = records.filter((r) => r.presente).length
  return { total, presentes, ausentes: total - presentes }
}
