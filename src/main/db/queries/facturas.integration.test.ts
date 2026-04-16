// Integration tests for the guards added by the business-correctness audit
// (worktree-agent-ad7e00e2) to pagos and devoluciones.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, facturas, pedidos } from '../schema'
import { anularFactura, registrarDevolucion, registrarPago } from './facturas'

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

    it('rechaza devolución sobre factura anulada', () => {
      registrarPago(db, {
        facturaId,
        monto: 40000,
        metodoPago: 'efectivo',
        fecha: '2026-04-02'
      })
      anularFactura(db, facturaId)
      expect(() =>
        registrarDevolucion(db, {
          facturaId,
          monto: 10000,
          motivo: 'Devolver al cliente',
          fecha: '2026-04-03'
        })
      ).toThrow(/anulada/i)
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
})
