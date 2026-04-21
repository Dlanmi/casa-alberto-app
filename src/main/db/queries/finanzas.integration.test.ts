// Fase 1 P-006 — reporte de margen por tipo de trabajo.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, facturas, pedidos } from '../schema'
import { registrarPago } from './facturas'
import { registrarMovimientoManual, reporteMargenPorTipo } from './finanzas'

describe.runIf(nativeAbiAvailable)('reporteMargenPorTipo', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Prueba' }).returning().get()

    // Pedido 1: enmarcacion — pago de 60k en abril.
    const pedido1 = db
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
    const factura1 = db
      .insert(facturas)
      .values({
        numero: 'F-0001',
        pedidoId: pedido1.id,
        clienteId: cliente.id,
        fecha: '2026-04-01',
        total: 100000,
        estado: 'pendiente'
      })
      .returning()
      .get()
    registrarPago(db, {
      facturaId: factura1.id,
      monto: 60000,
      metodoPago: 'efectivo',
      fecha: '2026-04-05'
    })

    // Pedido 2: restauracion — pago de 40k en abril.
    const pedido2 = db
      .insert(pedidos)
      .values({
        numero: 'P-0002',
        clienteId: cliente.id,
        tipoTrabajo: 'restauracion',
        precioTotal: 80000,
        estado: 'en_proceso',
        fechaIngreso: '2026-04-02'
      })
      .returning()
      .get()
    const factura2 = db
      .insert(facturas)
      .values({
        numero: 'F-0002',
        pedidoId: pedido2.id,
        clienteId: cliente.id,
        fecha: '2026-04-02',
        total: 80000,
        estado: 'pendiente'
      })
      .returning()
      .get()
    registrarPago(db, {
      facturaId: factura2.id,
      monto: 40000,
      metodoPago: 'efectivo',
      fecha: '2026-04-06'
    })

    // Gasto manual de 30k en abril (cae en "sin_asignar").
    registrarMovimientoManual(db, {
      tipo: 'gasto',
      categoria: 'materiales',
      descripcion: 'Rollo de paspartú',
      monto: 30000,
      fecha: '2026-04-10'
    })
  })

  it('agrupa ingresos por tipo de trabajo', () => {
    const reporte = reporteMargenPorTipo(db, '2026-04')
    const enmarcacion = reporte.filas.find((f) => f.tipoTrabajo === 'enmarcacion_estandar')
    const restauracion = reporte.filas.find((f) => f.tipoTrabajo === 'restauracion')
    expect(enmarcacion?.ingresos).toBe(60000)
    expect(restauracion?.ingresos).toBe(40000)
  })

  it('suma gastos no atribuidos en sin_asignar', () => {
    const reporte = reporteMargenPorTipo(db, '2026-04')
    const sinAsignar = reporte.filas.find((f) => f.tipoTrabajo === 'sin_asignar')
    expect(sinAsignar?.gastos).toBe(30000)
    expect(sinAsignar?.ingresos).toBe(0)
  })

  it('calcula totales del mes', () => {
    const reporte = reporteMargenPorTipo(db, '2026-04')
    expect(reporte.totalIngresos).toBe(100000)
    expect(reporte.totalGastos).toBe(30000)
    expect(reporte.margenTotal).toBe(70000)
  })

  it('devuelve mes vacío sin datos', () => {
    const reporte = reporteMargenPorTipo(db, '2026-03')
    expect(reporte.filas).toHaveLength(0)
    expect(reporte.totalIngresos).toBe(0)
    expect(reporte.margenTotal).toBe(0)
  })
})
