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
