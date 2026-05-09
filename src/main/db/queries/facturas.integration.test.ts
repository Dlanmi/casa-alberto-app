// Integration tests for the guards added by the business-correctness audit
// (worktree-agent-ad7e00e2) to pagos and devoluciones.
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, facturas, pagos, pedidos } from '../schema'
import {
  anularFactura,
  crearFactura,
  listarFacturas,
  registrarDevolucion,
  registrarPago
} from './facturas'

describe.runIf(nativeAbiAvailable)('facturas guards (Fase 2 §B.3)', () => {
  let db: DB
  let facturaId: number

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Prueba' }).returning().get()
    const pedido = db
      .insert(pedidos)
      .values({
        numero: 'P-0001',
        clienteId: cliente.id,
        tipoTrabajo: 'enmarcacion_estandar',
        precioTotal: 100000,
        estado: 'en_proceso',
        fechaIngreso: '2026-04-01'
      })
      .returning()
      .get()
    const factura = db
      .insert(facturas)
      .values({
        numero: 'F-0001',
        pedidoId: pedido.id,
        clienteId: cliente.id,
        fecha: '2026-04-01',
        total: 100000,
        estado: 'pendiente'
      })
      .returning()
      .get()
    facturaId = factura.id
  })

  describe('registrarPago', () => {
    it('rechaza monto <= 0', () => {
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: 0,
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/monto.*(mayor a 0|menor a)/i)
    })

    it('rechaza pago sobre factura anulada', () => {
      anularFactura(db, facturaId)
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: 50000,
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/anulada/i)
    })

    it('rechaza monto que excede el saldo pendiente', () => {
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: 200000, // factura total es 100000
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/excede el saldo/i)
    })

    it('rechaza NaN/Infinity antes de llegar a SQLite', () => {
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: Number.NaN,
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/no es un número finito válido/i)
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: Number.POSITIVE_INFINITY,
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/no es un número finito válido/i)
    })

    it('happy path: marca la factura como pagada cuando el saldo llega a 0', () => {
      const result = registrarPago(db, {
        facturaId,
        monto: 100000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      expect(result.estadoFactura).toBe('pagada')
      expect(result.saldo).toBe(0)
    })
  })

  describe('registrarDevolucion', () => {
    it('rechaza motivo vacío', () => {
      // Primero pagamos para que haya algo que devolver.
      registrarPago(db, {
        facturaId,
        monto: 50000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      expect(() =>
        registrarDevolucion(db, {
          facturaId,
          monto: 10000,
          motivo: '   ',
          fecha: '2026-04-03'
        })
      ).toThrow(/motivo/i)
    })

    it('rechaza monto <= 0', () => {
      expect(() =>
        registrarDevolucion(db, {
          facturaId,
          monto: 0,
          motivo: 'Cliente insatisfecho',
          fecha: '2026-04-03'
        })
      ).toThrow(/monto.*(mayor a 0|menor a)/i)
    })

    it('rechaza devolución mayor que lo efectivamente cobrado', () => {
      // Sólo hemos cobrado 40.000 al cliente; devolver 50.000 es imposible.
      registrarPago(db, {
        facturaId,
        monto: 40000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      expect(() =>
        registrarDevolucion(db, {
          facturaId,
          monto: 50000,
          motivo: 'Cliente insatisfecho',
          fecha: '2026-04-03'
        })
      ).toThrow(/excede lo cobrado/i)
    })

    it('happy path: acepta devolución dentro del cobrado neto', () => {
      registrarPago(db, {
        facturaId,
        monto: 60000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      const dev = registrarDevolucion(db, {
        facturaId,
        monto: 20000,
        motivo: 'Ajuste por vidrio mal cortado',
        fecha: '2026-04-03'
      })
      expect(dev.monto).toBe(20000)
    })
  })

  describe('anularFactura (nueva defensa adversarial)', () => {
    it('permite anular una factura sin pagos registrados', () => {
      const result = anularFactura(db, facturaId)
      expect(result?.estado).toBe('anulada')
    })

    it('rechaza anular una factura que ya tiene pagos registrados', () => {
      registrarPago(db, {
        facturaId,
        monto: 40000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      expect(() => anularFactura(db, facturaId)).toThrow(/pagos registrados/i)
    })

    it('rechaza anular una factura que ya estaba anulada (idempotencia)', () => {
      anularFactura(db, facturaId)
      expect(() => anularFactura(db, facturaId)).toThrow(/ya está anulada/i)
    })
  })

  describe('crearFactura — estado del pedido (Fase 2 §B.2)', () => {
    it('rechaza facturar un pedido en estado "cotizado"', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Cliente Test' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9001',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'cotizado',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 100000
        })
      ).toThrow(/cotizado|estado/i)
    })

    it('rechaza facturar un pedido en estado "cancelado"', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Cliente Test' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9002',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'cancelado',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 100000
        })
      ).toThrow(/cancelado|estado/i)
    })

    it('rechaza cliente distinto al cliente del pedido', () => {
      const clientePedido = db
        .insert(clientes)
        .values({ nombre: 'Cliente Pedido' })
        .returning()
        .get()
      const clienteFactura = db
        .insert(clientes)
        .values({ nombre: 'Cliente Incorrecto' })
        .returning()
        .get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9003',
          clienteId: clientePedido.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'confirmado',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: clienteFactura.id,
          fecha: '2026-04-01',
          total: 100000
        })
      ).toThrow(/mismo cliente/i)
    })

    it('rechaza total distinto al total del pedido', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Cliente Total' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9004',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'confirmado',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 999999
        })
      ).toThrow(/coincidir/i)
    })
  })

  // ---------------------------------------------------------------------------
  // Hardening: valores no-finitos en facturas/pagos/devoluciones (informe 318aa85).
  // Si un total/monto se cuela como Infinity/NaN, debe abortarse antes de tocar la DB.
  // ---------------------------------------------------------------------------
  describe('hardening — valores no-finitos', () => {
    it('crearFactura rechaza total Infinity', () => {
      const cliente = db.insert(clientes).values({ nombre: 'X' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9100',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'en_proceso',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: Number.POSITIVE_INFINITY
        })
      ).toThrow(/no es un número finito válido/i)
      // Ninguna factura debe haberse insertado.
      expect(db.select().from(facturas).all()).toHaveLength(1) // solo la del beforeEach
    })

    it('crearFactura rechaza total NaN', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Y' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-9101',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'en_proceso',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      expect(() =>
        crearFactura(db, {
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: Number.NaN
        })
      ).toThrow(/no es un número finito válido/i)
    })

    it('registrarPago aborta si la factura ya tenía total no-finito (defensa contra DB corrupta)', () => {
      // Inyectamos directamente con SQL raw para simular una factura
      // contaminada por un commit previo a este fix. Saldo derivado = Infinity
      // y validarMonto debe abortar antes de insertar el pago.
      db.run(sql`UPDATE facturas SET total = 1e9999 WHERE id = ${facturaId}`)
      expect(() =>
        registrarPago(db, {
          facturaId,
          monto: 50000,
          metodoPago: 'efectivo',
          fecha: '2026-04-02'
        })
      ).toThrow(/no es un número finito válido/i)
      // Sin pagos persistidos.
      const pagosCount = db.select({ id: sql<number>`count(*)` }).from(pagos).get()
      expect(pagosCount?.id).toBe(0)
    })

    it('registrarDevolucion aborta si el cobrado neto resulta no-finito', () => {
      // Sembramos un pago manual con monto Infinity (simulando corrupción).
      db.run(sql`INSERT INTO pagos (factura_id, monto, metodo_pago, fecha) VALUES (${facturaId}, 1e9999, 'efectivo', '2026-04-02')`)
      expect(() =>
        registrarDevolucion(db, {
          facturaId,
          monto: 1000,
          motivo: 'test',
          fecha: '2026-04-03'
        })
      ).toThrow(/no es un número finito válido/i)
    })
  })
})

// UNIQUE partial index en facturas(pedido_id) WHERE estado != 'anulada'
// (ver SPEC-007 en docs/BUSINESS_RULES.md). Los tests de `facturas guards`
// pre-insertan una factura con número hardcodeado antes de cada test, lo
// que colisionaría con el consecutivo auto-generado. Por eso esta suite
// vive fuera con su propio beforeEach limpio.
describe.runIf(nativeAbiAvailable)('facturas UNIQUE partial index (SPEC-007)', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  function insertClientePedido(
    nombreCliente: string,
    numeroPedido: string
  ): { clienteId: number; pedidoId: number } {
    const cliente = db.insert(clientes).values({ nombre: nombreCliente }).returning().get()
    const pedido = db
      .insert(pedidos)
      .values({
        numero: numeroPedido,
        clienteId: cliente.id,
        tipoTrabajo: 'enmarcacion_estandar',
        precioTotal: 50000,
        estado: 'confirmado',
        fechaIngreso: '2026-04-01'
      })
      .returning()
      .get()
    return { clienteId: cliente.id, pedidoId: pedido.id }
  }

  it('rechaza crear dos facturas activas para el mismo pedido (app-level)', () => {
    const { clienteId, pedidoId } = insertClientePedido('Cliente Dup', 'P-DUP')
    crearFactura(db, { pedidoId, clienteId, fecha: '2026-04-01', total: 50000 })
    expect(() =>
      crearFactura(db, { pedidoId, clienteId, fecha: '2026-04-01', total: 50000 })
    ).toThrow(/factura activa/i)
  })

  it('DB UNIQUE index bloquea un INSERT directo saltándose el app-level', () => {
    // Garantía real: aunque un bug salte el guard de app, el índice parcial
    // del schema impide dos facturas activas por pedido.
    const { clienteId, pedidoId } = insertClientePedido('Cliente DB', 'P-DB-DUP')
    db.insert(facturas)
      .values({
        numero: 'F-DB-1',
        pedidoId,
        clienteId,
        fecha: '2026-04-01',
        total: 50000,
        estado: 'pendiente'
      })
      .run()
    expect(() =>
      db
        .insert(facturas)
        .values({
          numero: 'F-DB-2',
          pedidoId,
          clienteId,
          fecha: '2026-04-01',
          total: 50000,
          estado: 'pendiente'
        })
        .run()
    ).toThrow(/unique|idx_facturas_pedido_activa/i)
  })

  it('permite una factura activa tras anular la anterior', () => {
    const { clienteId, pedidoId } = insertClientePedido('Cliente Reemplazo', 'P-REP')
    const primera = crearFactura(db, {
      pedidoId,
      clienteId,
      fecha: '2026-04-01',
      total: 50000
    })
    anularFactura(db, primera.id)
    const segunda = crearFactura(db, {
      pedidoId,
      clienteId,
      fecha: '2026-04-02',
      total: 50000
    })
    expect(segunda.estado).toBe('pendiente')
    expect(segunda.pedidoId).toBe(pedidoId)
  })
})

describe.runIf(nativeAbiAvailable)('listarFacturas — búsqueda por número', () => {
  let db: DB
  let clienteId: number
  let pedidoId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db.insert(clientes).values({ nombre: 'Cliente F' }).returning().get().id
    pedidoId = db
      .insert(pedidos)
      .values({
        numero: 'P-0001',
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        precioTotal: 100000,
        estado: 'en_proceso',
        fechaIngreso: '2026-04-01'
      })
      .returning()
      .get().id
    // `crearFactura` exige `data.total === pedido.precioTotal`. Antes
    // creábamos 3 facturas (50k+25k+25k) asumiendo split, pero la regla
    // de negocio dejó de permitirlo — una factura activa por pedido.
    crearFactura(db, { pedidoId, clienteId, fecha: '2026-04-01', total: 100000 })
  })

  it('encuentra factura por sufijo del número', () => {
    const todas = listarFacturas(db)
    expect(todas.length).toBeGreaterThan(0)
    const ultima = todas[0]!
    const filtradas = listarFacturas(db, { busqueda: ultima.numero.slice(-4) })
    expect(filtradas.length).toBeGreaterThan(0)
    expect(filtradas[0]!.numero).toBe(ultima.numero)
  })
})

