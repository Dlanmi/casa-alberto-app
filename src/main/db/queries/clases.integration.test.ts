// Integration tests for the clases guards added by the business-correctness
// audit (worktree-agent-ad7e00e2): acudiente obligatorio para menores,
// saldo mensual no excedido, venta de kit sin estudiante/cliente.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { acudientes, clientes, configuracion, estudiantes } from '../schema'
import { crearEstudiante, registrarPagoClase, venderKit } from './clases'

describe.runIf(nativeAbiAvailable)('clases guards (Fase 2 §C, §D)', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    // Sembrar la configuración de precios que el módulo de clases consulta.
    db.insert(configuracion)
      .values([
        { clave: 'precio_clase_mensual', valor: '100000', descripcion: 'Clase mensual' },
        { clave: 'precio_kit_dibujo', valor: '15000', descripcion: 'Kit de dibujo' }
      ])
      .run()
  })

  describe('crearEstudiante — acudiente obligatorio para menores (§C.1)', () => {
    it('rechaza estudiante menor sin acudiente', () => {
      const cliente = db
        .insert(clientes)
        .values({ nombre: 'María López', esMenor: true })
        .returning()
        .get()
      expect(() =>
        crearEstudiante(db, {
          clienteId: cliente.id,
          fechaIngreso: '2026-04-01',
          esMenor: true
        })
      ).toThrow(/acudiente/i)
    })

    it('rechaza estudiante menor con acudiente sin nombre/teléfono', () => {
      const cliente = db
        .insert(clientes)
        .values({ nombre: 'Juan Pérez', esMenor: true })
        .returning()
        .get()
      db.insert(acudientes)
        .values({
          clienteId: cliente.id,
          nombre: '   ',
          telefono: '   '
        })
        .run()
      expect(() =>
        crearEstudiante(db, {
          clienteId: cliente.id,
          fechaIngreso: '2026-04-01',
          esMenor: true
        })
      ).toThrow(/acudiente/i)
    })

    it('acepta estudiante menor con acudiente completo', () => {
      const cliente = db
        .insert(clientes)
        .values({ nombre: 'Sofía Gómez', esMenor: true })
        .returning()
        .get()
      db.insert(acudientes)
        .values({
          clienteId: cliente.id,
          nombre: 'Mamá Gómez',
          telefono: '3001234567',
          parentesco: 'madre'
        })
        .run()
      const est = crearEstudiante(db, {
        clienteId: cliente.id,
        fechaIngreso: '2026-04-01',
        esMenor: true
      })
      expect(est.esMenor).toBe(true)
      expect(est.clienteId).toBe(cliente.id)
    })

    it('acepta estudiante mayor de edad sin acudiente', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Adulto Ejemplo' }).returning().get()
      const est = crearEstudiante(db, {
        clienteId: cliente.id,
        fechaIngreso: '2026-04-01',
        esMenor: false
      })
      expect(est.esMenor).toBe(false)
    })
  })

  describe('registrarPagoClase — saldo del mes (§D)', () => {
    let estudianteId: number

    beforeEach(() => {
      const cliente = db.insert(clientes).values({ nombre: 'Estudiante X' }).returning().get()
      const est = db
        .insert(estudiantes)
        .values({ clienteId: cliente.id, fechaIngreso: '2026-04-01' })
        .returning()
        .get()
      estudianteId = est.id
    })

    it('rechaza pago con monto <= 0', () => {
      expect(() =>
        registrarPagoClase(db, {
          estudianteId,
          mes: '2026-04',
          monto: 0,
          metodoPago: 'efectivo',
          fecha: '2026-04-15'
        })
      ).toThrow(/mayor a 0/i)
    })

    it('rechaza pago que supera el saldo mensual del estudiante', () => {
      // Valor mensual = 100.000. Primer pago 60.000 → saldo 40.000.
      registrarPagoClase(db, {
        estudianteId,
        mes: '2026-04',
        monto: 60000,
        metodoPago: 'efectivo',
        fecha: '2026-04-05'
      })
      // Segundo pago 50.000 excede el saldo.
      expect(() =>
        registrarPagoClase(db, {
          estudianteId,
          mes: '2026-04',
          monto: 50000,
          metodoPago: 'efectivo',
          fecha: '2026-04-10'
        })
      ).toThrow(/excede el saldo/i)
    })

    it('happy path: pago exacto marca el mes como pagado', () => {
      const result = registrarPagoClase(db, {
        estudianteId,
        mes: '2026-04',
        monto: 100000,
        metodoPago: 'efectivo',
        fecha: '2026-04-05'
      })
      expect(result.pagoClase.estado).toBe('pagado')
    })
  })

  describe('venderKit — requiere estudiante o cliente', () => {
    it('rechaza venta sin estudianteId ni clienteId', () => {
      expect(() =>
        venderKit(db, {
          fecha: '2026-04-10'
        })
      ).toThrow(/estudiante.*cliente/i)
    })

    it('acepta venta con sólo estudianteId', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Estudiante Y' }).returning().get()
      const est = db
        .insert(estudiantes)
        .values({ clienteId: cliente.id, fechaIngreso: '2026-04-01' })
        .returning()
        .get()
      const venta = venderKit(db, {
        estudianteId: est.id,
        fecha: '2026-04-10'
      })
      expect(venta.estudianteId).toBe(est.id)
      expect(venta.precio).toBe(15000) // desde configuracion
    })

    it('acepta venta con sólo clienteId (invitado sin estudiante)', () => {
      const cliente = db.insert(clientes).values({ nombre: 'Visitante' }).returning().get()
      const venta = venderKit(db, {
        clienteId: cliente.id,
        fecha: '2026-04-10'
      })
      expect(venta.clienteId).toBe(cliente.id)
      expect(venta.estudianteId).toBeNull()
    })
  })
})
