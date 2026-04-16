// Regression tests for the adversarial-hardening pass. Each test targets a
// specific attack/bad-flow reported by the adversarial agents.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clases, contratos, estudiantes, facturas, inventario, pedidos } from '../schema'
import { crearCliente, desactivarCliente } from './clientes'
import { crearCuentaCobro, marcarCuentaCobroPagada } from './contratos'
import { registrarAsistencia } from './clases'
import { registrarMovimientoInventario } from './inventario'

describe.runIf(nativeAbiAvailable)('adversarial hardening', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  // -------------------------------------------------------------------------
  // Clientes
  // -------------------------------------------------------------------------

  describe('crearCliente — validación del nombre', () => {
    it('rechaza nombre vacío', () => {
      expect(() => crearCliente(db, { nombre: '' })).toThrow(/al menos 2 caracteres/i)
    })

    it('rechaza nombre solo con espacios', () => {
      expect(() => crearCliente(db, { nombre: '   ' })).toThrow(/al menos 2 caracteres/i)
    })

    it('rechaza nombre de un caracter', () => {
      expect(() => crearCliente(db, { nombre: 'A' })).toThrow(/al menos 2 caracteres/i)
    })

    it('rechaza nombre con más de 200 caracteres', () => {
      const largo = 'A'.repeat(300)
      expect(() => crearCliente(db, { nombre: largo })).toThrow(/200 caracteres/i)
    })

    it('trim automático: "  Juan  " → "Juan"', () => {
      const c = crearCliente(db, { nombre: '  Juan  ' })
      expect(c.nombre).toBe('Juan')
    })
  })

  describe('desactivarCliente — bloquea con facturas pendientes', () => {
    it('rechaza desactivar cliente con factura pendiente de cobro', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente con deuda' })
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-0001',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 100000,
          estado: 'entregado',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      db.insert(facturas)
        .values({
          numero: 'F-0001',
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 100000,
          estado: 'pendiente'
        })
        .run()

      expect(() => desactivarCliente(db, cliente.id)).toThrow(/facturas pendientes/i)
    })

    it('permite desactivar si no hay pedidos ni facturas pendientes', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente limpio' })
      const result = desactivarCliente(db, cliente.id)
      expect(result?.activo).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Cuentas de cobro / contratos
  // -------------------------------------------------------------------------

  describe('crearCuentaCobro — solo contratos aprobados', () => {
    it('rechaza sobre contrato en estado "enviada"', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente Contrato' })
      const contrato = db
        .insert(contratos)
        .values({
          numero: 'C-0001',
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 500000,
          estado: 'enviada'
        })
        .returning()
        .get()
      expect(() =>
        crearCuentaCobro(db, { contratoId: contrato.id, total: 100000, fecha: '2026-04-02' })
      ).toThrow(/estado "enviada"/i)
    })

    it('rechaza sobre contrato "rechazada"', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente' })
      const contrato = db
        .insert(contratos)
        .values({
          numero: 'C-0002',
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 500000,
          estado: 'rechazada'
        })
        .returning()
        .get()
      expect(() =>
        crearCuentaCobro(db, { contratoId: contrato.id, total: 100000, fecha: '2026-04-02' })
      ).toThrow(/aprobado/i)
    })

    it('acepta sobre contrato aprobado', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente' })
      const contrato = db
        .insert(contratos)
        .values({
          numero: 'C-0003',
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 500000,
          estado: 'aprobada'
        })
        .returning()
        .get()
      const cc = crearCuentaCobro(db, {
        contratoId: contrato.id,
        total: 100000,
        fecha: '2026-04-02'
      })
      expect(cc.estado).toBe('pendiente')
      expect(cc.total).toBe(100000)
    })
  })

  describe('marcarCuentaCobroPagada — idempotencia', () => {
    it('rechaza marcar pagada una cuenta que ya estaba pagada', () => {
      const cliente = crearCliente(db, { nombre: 'Cliente' })
      const contrato = db
        .insert(contratos)
        .values({
          numero: 'C-0001',
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 500000,
          estado: 'aprobada'
        })
        .returning()
        .get()
      const cc = crearCuentaCobro(db, {
        contratoId: contrato.id,
        total: 100000,
        fecha: '2026-04-02'
      })
      marcarCuentaCobroPagada(db, cc.id, '2026-04-05')
      expect(() => marcarCuentaCobroPagada(db, cc.id, '2026-04-06')).toThrow(
        /ya estaba marcada como pagada/i
      )
    })
  })

  // -------------------------------------------------------------------------
  // Clases
  // -------------------------------------------------------------------------

  describe('registrarAsistencia — clase inactiva', () => {
    it('rechaza registrar asistencia a una clase inactiva', () => {
      const cliente = crearCliente(db, { nombre: 'Juan Estudiante' })
      const estudiante = db
        .insert(estudiantes)
        .values({
          clienteId: cliente.id,
          fechaIngreso: '2026-01-15',
          activo: true
        })
        .returning()
        .get()
      const clase = db
        .insert(clases)
        .values({
          nombre: 'Pintura infantil',
          diaSemana: 'lunes',
          horaInicio: '15:00',
          horaFin: '17:00',
          activo: false // ← clase desactivada
        })
        .returning()
        .get()
      expect(() =>
        registrarAsistencia(db, {
          estudianteId: estudiante.id,
          claseId: clase.id,
          fecha: '2026-04-16',
          presente: true
        })
      ).toThrow(/clase inactiva/i)
    })
  })

  // -------------------------------------------------------------------------
  // Inventario
  // -------------------------------------------------------------------------

  describe('registrarMovimientoInventario — validación de cantidad', () => {
    function crearItem(): number {
      const item = db
        .insert(inventario)
        .values({
          nombre: 'Cartón',
          tipo: 'carton',
          unidad: 'unidades',
          stockActual: 50,
          stockMinimo: 10
        })
        .returning()
        .get()
      return item.id
    }

    it('rechaza cantidad 0', () => {
      const id = crearItem()
      expect(() =>
        registrarMovimientoInventario(db, {
          inventarioId: id,
          tipo: 'entrada',
          cantidad: 0,
          fecha: '2026-04-16'
        })
      ).toThrow(/mayor a 0/i)
    })

    it('rechaza cantidad negativa', () => {
      const id = crearItem()
      expect(() =>
        registrarMovimientoInventario(db, {
          inventarioId: id,
          tipo: 'entrada',
          cantidad: -5,
          fecha: '2026-04-16'
        })
      ).toThrow(/mayor a 0/i)
    })

    it('rechaza cantidad decimal', () => {
      const id = crearItem()
      expect(() =>
        registrarMovimientoInventario(db, {
          inventarioId: id,
          tipo: 'entrada',
          cantidad: 3.5,
          fecha: '2026-04-16'
        })
      ).toThrow(/entero/i)
    })

    it('acepta cantidad entera positiva', () => {
      const id = crearItem()
      const result = registrarMovimientoInventario(db, {
        inventarioId: id,
        tipo: 'entrada',
        cantidad: 10,
        fecha: '2026-04-16'
      })
      expect(result.nuevoStock).toBe(60)
    })
  })
})
