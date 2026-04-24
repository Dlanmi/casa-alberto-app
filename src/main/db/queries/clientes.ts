import { and, desc, eq, inArray, like, not, or, sql, type SQL } from 'drizzle-orm'
import type { DB } from '../index'
import { acudientes, clientes, facturas, pagos, pedidos } from '../schema'

export type NuevoCliente = {
  nombre: string
  telefono?: string | null
  cedula?: string | null
  correo?: string | null
  direccion?: string | null
  notas?: string | null
  esMenor?: boolean
}

export type ActualizarCliente = Partial<NuevoCliente> & { activo?: boolean; esMenor?: boolean }

export type OpcionesListarClientes = {
  busqueda?: string
  soloActivos?: boolean
  limit?: number
}

export function listarClientes(db: DB, opts: OpcionesListarClientes = {}) {
  const conditions: SQL[] = []
  if (opts.soloActivos !== false) conditions.push(eq(clientes.activo, true))
  if (opts.busqueda) {
    const q = `%${opts.busqueda}%`
    conditions.push(
      or(like(clientes.nombre, q), like(clientes.cedula, q), like(clientes.telefono, q))!
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const query = db.select().from(clientes).where(where).orderBy(clientes.nombre)
  if (opts.limit) return query.limit(opts.limit).all()
  return query.all()
}

export function obtenerCliente(db: DB, id: number) {
  return db.select().from(clientes).where(eq(clientes.id, id)).get() ?? null
}

export function obtenerClienteConAcudiente(db: DB, id: number) {
  const cliente = obtenerCliente(db, id)
  if (!cliente) return null
  const acudiente = db.select().from(acudientes).where(eq(acudientes.clienteId, id)).get() ?? null
  return { ...cliente, acudiente }
}

function validarNombreCliente(nombre: string | undefined | null): string {
  const limpio = (nombre ?? '').trim()
  if (limpio.length < 2) {
    throw new Error('El nombre del cliente debe tener al menos 2 caracteres')
  }
  if (limpio.length > 200) {
    throw new Error('El nombre del cliente supera 200 caracteres')
  }
  return limpio
}

// Sprint 2 · A1 — teléfono: 7–15 dígitos. Permitimos que venga con espacios,
// guiones o paréntesis de formato local ("300 123 4567", "(601) 456-7890") y
// los limpiamos antes de validar. El storage queda con sólo dígitos para que
// búsquedas por teléfono sean consistentes (`like '%300123%'`).
const TELEFONO_REGEX = /^\d{7,15}$/

export function normalizarTelefono(raw: string | undefined | null): string | null {
  const limpio = (raw ?? '').replace(/[\s()+\-.]/g, '')
  if (!limpio) return null
  if (!TELEFONO_REGEX.test(limpio)) {
    throw new Error(
      'El teléfono debe tener entre 7 y 15 dígitos (se permiten espacios o guiones como formato).'
    )
  }
  return limpio
}

// Sprint 2 · A2 — cédula: 6–15 dígitos (cubre CC, TI, NIT corto, pasaportes
// numéricos). Aceptamos puntos como separadores de miles ("1.234.567.890") y
// los limpiamos. El UNIQUE index de la DB bloquea duplicados; aquí damos el
// mensaje legible antes de que SQLite escupa un SQLITE_CONSTRAINT_UNIQUE.
const CEDULA_REGEX = /^\d{6,15}$/

export function normalizarCedula(raw: string | undefined | null): string | null {
  const limpio = (raw ?? '').replace(/[\s.-]/g, '')
  if (!limpio) return null
  if (!CEDULA_REGEX.test(limpio)) {
    throw new Error('La cédula debe tener entre 6 y 15 dígitos.')
  }
  return limpio
}

export function crearCliente(db: DB, data: NuevoCliente) {
  const nombre = validarNombreCliente(data.nombre)
  const telefono = normalizarTelefono(data.telefono)
  const cedula = normalizarCedula(data.cedula)
  try {
    return db
      .insert(clientes)
      .values({
        nombre,
        telefono,
        cedula,
        correo: data.correo?.trim() || null,
        direccion: data.direccion?.trim() || null,
        notas: data.notas?.trim() || null,
        esMenor: data.esMenor ?? false,
        activo: true
      })
      .returning()
      .get()
  } catch (err) {
    // Sprint 2 · A2 — el UNIQUE index en cedula dispara SQLITE_CONSTRAINT_UNIQUE
    // cuando intentamos duplicar. Lo convertimos en un error de negocio legible.
    if (err instanceof Error && /UNIQUE/i.test(err.message) && /cedula/i.test(err.message)) {
      throw new Error(`Ya hay otro cliente registrado con la cédula ${cedula}.`)
    }
    throw err
  }
}

export function actualizarCliente(db: DB, id: number, data: ActualizarCliente) {
  // Si viene un nombre en el update, validarlo. Si no viene, dejar el actual.
  const payload: Record<string, unknown> = { ...data, updatedAt: sql`(datetime('now'))` }
  if (data.nombre !== undefined) {
    payload.nombre = validarNombreCliente(data.nombre)
  }
  if (data.telefono !== undefined) {
    payload.telefono = normalizarTelefono(data.telefono)
  }
  if (data.cedula !== undefined) {
    payload.cedula = normalizarCedula(data.cedula)
  }
  try {
    const result = db.update(clientes).set(payload).where(eq(clientes.id, id)).returning().get()
    return result ?? null
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message) && /cedula/i.test(err.message)) {
      throw new Error(`Ya hay otro cliente registrado con la cédula ${payload.cedula}.`)
    }
    throw err
  }
}

export function desactivarCliente(db: DB, id: number) {
  const pedidosActivos = db
    .select({ n: sql<number>`count(*)` })
    .from(pedidos)
    .where(and(eq(pedidos.clienteId, id), not(inArray(pedidos.estado, ['cancelado', 'entregado']))))
    .get()
  if ((pedidosActivos?.n ?? 0) > 0) {
    throw new Error('No se puede desactivar un cliente con pedidos activos')
  }
  // Además bloquear si hay facturas con saldo pendiente: sería inconsistente
  // marcar al cliente como "inactivo" cuando aún tenemos que cobrarle.
  const facturasPendientes = db
    .select({ n: sql<number>`count(*)` })
    .from(facturas)
    .where(and(eq(facturas.clienteId, id), not(inArray(facturas.estado, ['pagada', 'anulada']))))
    .get()
  if ((facturasPendientes?.n ?? 0) > 0) {
    throw new Error('No se puede desactivar un cliente con facturas pendientes de cobro')
  }
  return actualizarCliente(db, id, { activo: false })
}

export function reactivarCliente(db: DB, id: number) {
  return actualizarCliente(db, id, { activo: true })
}

export function estadisticasCliente(db: DB, id: number) {
  const totalPedidos = db
    .select({ n: sql<number>`count(*)` })
    .from(pedidos)
    .where(eq(pedidos.clienteId, id))
    .get()

  const totalFacturado = db
    .select({ total: sql<number>`coalesce(sum(${facturas.total}), 0)` })
    .from(facturas)
    .where(eq(facturas.clienteId, id))
    .get()

  const totalPagado = db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)` })
    .from(pagos)
    .innerJoin(facturas, eq(facturas.id, pagos.facturaId))
    .where(eq(facturas.clienteId, id))
    .get()

  const ultimoPedido = db
    .select()
    .from(pedidos)
    .where(eq(pedidos.clienteId, id))
    .orderBy(desc(pedidos.createdAt))
    .limit(1)
    .get()

  return {
    totalPedidos: totalPedidos?.n ?? 0,
    totalFacturado: totalFacturado?.total ?? 0,
    totalPagado: totalPagado?.total ?? 0,
    saldoPendiente: (totalFacturado?.total ?? 0) - (totalPagado?.total ?? 0),
    ultimoPedido: ultimoPedido ?? null
  }
}

// Listado completo de acudientes — usado por el popup de clase en /agenda
// para resolver el contacto del acudiente de cada estudiante menor sin
// hacer N round-trips. La tabla es pequeña (1 acudiente por cliente, y solo
// clientes con menores), por lo que traerla entera es más barato que
// consultarla una por una desde el render.
export function listarAcudientes(db: DB) {
  return db.select().from(acudientes).all()
}

export type NuevoAcudiente = {
  clienteId: number
  nombre: string
  telefono: string
  parentesco?: string | null
}

export function upsertAcudiente(db: DB, data: NuevoAcudiente) {
  const existing = db
    .select()
    .from(acudientes)
    .where(eq(acudientes.clienteId, data.clienteId))
    .get()
  if (existing) {
    return db
      .update(acudientes)
      .set({
        nombre: data.nombre,
        telefono: data.telefono,
        parentesco: data.parentesco ?? null,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(acudientes.clienteId, data.clienteId))
      .returning()
      .get()
  }
  return db
    .insert(acudientes)
    .values({
      clienteId: data.clienteId,
      nombre: data.nombre,
      telefono: data.telefono,
      parentesco: data.parentesco ?? null
    })
    .returning()
    .get()
}
