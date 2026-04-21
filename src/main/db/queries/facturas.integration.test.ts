// Integration tests for the guards added by the business-correctness audit
// (worktree-agent-ad7e00e2) to pagos and devoluciones.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, facturas, pedidos } from '../schema'
import { anularFactura, crearFactura, registrarDevolucion, registrarPago } from './facturas'

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
      ).toThrow(/monto.*mayor a 0/i)
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
      ).toThrow(/monto.*mayor a 0/i)
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
  })
})

// Sprint 1 · A9 — UNIQUE partial index en facturas(pedido_id) WHERE estado != 'anulada'.
// Los tests de `facturas guards` pre-insertan una factura con número hardcodeado
// antes de cada test, lo que colisionaría con el consecutivo auto-generado. Por
// eso esta suite vive fuera con su propio beforeEach limpio.
describe.runIf(nativeAbiAvailable)('facturas UNIQUE partial index (Sprint 1 A9)', () => {
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
