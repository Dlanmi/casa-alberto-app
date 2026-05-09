// Fase 1 P-006 — reporte de margen por tipo de trabajo.
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import {
  clientes,
  contratos,
  cuentasCobro,
  facturas,
  movimientosFinancieros,
  pedidoItems,
  pedidos,
  ventasKits
} from '../schema'
import { registrarPago } from './facturas'
import {
  ingresosPorTipoTrabajo,
  registrarMovimientoManual,
  reporteMargenPorTipo,
  resumenComercialMensual,
  serieDiariaMensual,
  serieMensual,
  topClientes,
  topMarcosVendidos
} from './finanzas'

describe.runIf(nativeAbiAvailable)('reporteMargenPorTipo', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Prueba' }).returning().get()

    // Pedido 1: enmarcacion — pago de 60k en abril.
    // resumenComercialMensual lee `precioLista`, no `precioTotal` — antes
    // sólo seteábamos `precioTotal` y por eso ventasBrutasPedidos quedaba 0.
    const pedido1 = db
      .insert(pedidos)
      .values({
        numero: 'P-0001',
        clienteId: cliente.id,
        tipoTrabajo: 'enmarcacion_estandar',
        precioLista: 100000,
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
        precioLista: 80000,
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

  it('resume ventas, descuentos y margen comercial del mes', () => {
    const resumen = resumenComercialMensual(db, '2026-04')
    expect(resumen.ventasBrutasPedidos).toBe(180000)
    expect(resumen.descuentos).toBe(0)
    expect(resumen.ventasNetasPedidos).toBe(180000)
    expect(resumen.pedidosTotal).toBeGreaterThan(0)
  })
})

// ===========================================================================
// CHARTS — series temporales y top-N
// ===========================================================================

describe.runIf(nativeAbiAvailable)('serieMensual — chart Mes vs Mes', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    // Sembramos movimientos en distintos meses para cubrir el rango de
    // los últimos 6 meses contando desde "hoy" en tests. Como la función
    // usa `new Date()` internamente, este test es time-dependent — pero
    // verificamos relaciones (sums, balance) en lugar de meses absolutos.
    const hoy = new Date()
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    registrarMovimientoManual(db, {
      tipo: 'ingreso',
      categoria: 'enmarcacion',
      monto: 100000,
      fecha: `${mesActual}-15`
    })
    registrarMovimientoManual(db, {
      tipo: 'gasto',
      categoria: 'materiales',
      monto: 30000,
      fecha: `${mesActual}-15`
    })
  })

  it('devuelve N meses completos incluso sin movimientos en algunos', () => {
    const serie = serieMensual(db, 6)
    expect(serie).toHaveLength(6)
    // Cada fila tiene el shape esperado
    for (const fila of serie) {
      expect(fila).toHaveProperty('mes')
      expect(fila).toHaveProperty('ingresos')
      expect(fila).toHaveProperty('gastos')
      expect(fila.balance).toBe(fila.ingresos - fila.gastos)
    }
    // El último mes (actual) tiene los datos sembrados
    const ultimo = serie[serie.length - 1]!
    expect(ultimo.ingresos).toBe(100000)
    expect(ultimo.gastos).toBe(30000)
    expect(ultimo.balance).toBe(70000)
  })

  it('respeta el límite mínimo de 1 mes', () => {
    const serie = serieMensual(db, 0)
    expect(serie).toHaveLength(1)
  })

  it('orden ascendente por mes', () => {
    const serie = serieMensual(db, 6)
    for (let i = 1; i < serie.length; i++) {
      expect(serie[i]!.mes >= serie[i - 1]!.mes).toBe(true)
    }
  })
})

describe.runIf(nativeAbiAvailable)('serieDiariaMensual — heatmap calendario', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    registrarMovimientoManual(db, {
      tipo: 'ingreso',
      categoria: 'enmarcacion',
      monto: 50000,
      fecha: '2026-04-15'
    })
    registrarMovimientoManual(db, {
      tipo: 'ingreso',
      categoria: 'enmarcacion',
      monto: 25000,
      fecha: '2026-04-15'
    })
    registrarMovimientoManual(db, {
      tipo: 'gasto',
      categoria: 'materiales',
      monto: 10000,
      fecha: '2026-04-20'
    })
  })

  it('devuelve los 30 días completos de abril', () => {
    const serie = serieDiariaMensual(db, '2026-04')
    expect(serie).toHaveLength(30)
    expect(serie[0]!.fecha).toBe('2026-04-01')
    expect(serie[29]!.fecha).toBe('2026-04-30')
  })

  it('agrega ingresos del mismo día y cuenta transacciones', () => {
    const serie = serieDiariaMensual(db, '2026-04')
    const dia15 = serie.find((f) => f.fecha === '2026-04-15')!
    expect(dia15.ingresos).toBe(75000)
    expect(dia15.transacciones).toBe(2)
    const dia20 = serie.find((f) => f.fecha === '2026-04-20')!
    expect(dia20.gastos).toBe(10000)
    expect(dia20.transacciones).toBe(1)
  })

  it('respeta meses con menos de 31 días — febrero', () => {
    const serie2024 = serieDiariaMensual(db, '2026-02')
    expect(serie2024).toHaveLength(28)
  })

  // -------------------------------------------------------------------------
  // Hardening contra DoS por años fuera de rango (informe 3b31841).
  // Sin el fix, mes="0000-01" hacía new Date(0,1,1) = 1900-02-01 (quirk de
  // años 0-99) y el loop generaba ~694k entries → OOM crash. Con el fix,
  // validarFechaISO rechaza el año fuera de [2000, 2100] antes del loop.
  // -------------------------------------------------------------------------

  it('rechaza mes con año 0000 (PoC del informe)', () => {
    expect(() => serieDiariaMensual(db, '0000-01')).toThrow(/rango razonable/i)
    expect(() => serieDiariaMensual(db, '0099-12')).toThrow(/rango razonable/i)
  })

  it('rechaza años posteriores a 2100', () => {
    expect(() => serieDiariaMensual(db, '2101-01')).toThrow(/rango razonable/i)
    expect(() => serieDiariaMensual(db, '9999-12')).toThrow(/rango razonable/i)
  })

  it('rechaza años anteriores a 2000', () => {
    expect(() => serieDiariaMensual(db, '1999-12')).toThrow(/rango razonable/i)
  })

  it('rechaza formatos inválidos', () => {
    expect(() => serieDiariaMensual(db, 'abc')).toThrow(/formato/i)
    expect(() => serieDiariaMensual(db, '2026-1')).toThrow(/formato/i)
    expect(() => serieDiariaMensual(db, '')).toThrow(/formato/i)
    // mes 13 / mes 0 pasan el regex pero fallan en el chequeo de rango.
    expect(() => serieDiariaMensual(db, '2026-13')).toThrow(/no es un mes válido/i)
    expect(() => serieDiariaMensual(db, '2026-00')).toThrow(/no es un mes válido/i)
  })

  it('mes válido en frontera del año (diciembre) calcula correctamente el rango', () => {
    registrarMovimientoManual(db, {
      tipo: 'ingreso',
      categoria: 'enmarcacion',
      monto: 50000,
      fecha: '2026-12-31'
    })
    const serie = serieDiariaMensual(db, '2026-12')
    expect(serie).toHaveLength(31)
    expect(serie[0]!.fecha).toBe('2026-12-01')
    expect(serie[30]!.fecha).toBe('2026-12-31')
    expect(serie[30]!.ingresos).toBe(50000)
  })
})

describe.runIf(nativeAbiAvailable)('topClientes', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    const ana = db.insert(clientes).values({ nombre: 'Ana Pérez' }).returning().get()
    const juan = db.insert(clientes).values({ nombre: 'Juan Gómez' }).returning().get()
    const pedro = db.insert(clientes).values({ nombre: 'Pedro Ruiz' }).returning().get()
    function crearFactura(
      numero: string,
      clienteId: number,
      total: number,
      fecha: string,
      estado: 'pendiente' | 'anulada' = 'pendiente'
    ): void {
      const pedido = db
        .insert(pedidos)
        .values({
          numero: `P-${numero}`,
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: total,
          estado: 'confirmado',
          fechaIngreso: fecha
        })
        .returning()
        .get()
      db.insert(facturas)
        .values({
          numero: `F-${numero}`,
          pedidoId: pedido.id,
          clienteId,
          fecha,
          total,
          estado
        })
        .run()
    }
    crearFactura('0001', ana.id, 200000, '2026-04-05')
    crearFactura('0002', ana.id, 100000, '2026-04-15')
    crearFactura('0003', juan.id, 150000, '2026-04-10')
    crearFactura('0004', pedro.id, 50000, '2026-04-20')
    crearFactura('0005', pedro.id, 999999, '2026-04-25', 'anulada') // anulada se excluye
  })

  it('ordena por total facturado desc y respeta el limit', () => {
    const top = topClientes(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 2 })
    expect(top).toHaveLength(2)
    expect(top[0]!.nombre).toBe('Ana Pérez')
    expect(top[0]!.total).toBe(300000)
    expect(top[0]!.facturas).toBe(2)
    expect(top[1]!.nombre).toBe('Juan Gómez')
  })

  it('excluye facturas anuladas', () => {
    const top = topClientes(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 5 })
    const pedro = top.find((t) => t.nombre === 'Pedro Ruiz')!
    expect(pedro.total).toBe(50000)
  })

  it('devuelve [] cuando no hay facturas en el rango', () => {
    const top = topClientes(db, { desde: '2025-01-01', hasta: '2025-01-31', limit: 5 })
    expect(top).toEqual([])
  })
})

describe.runIf(nativeAbiAvailable)('topMarcosVendidos', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Test' }).returning().get()
    function crearPedidoConMarco(
      numero: string,
      referencia: string | null,
      precio: number,
      fecha: string,
      estado: 'confirmado' | 'cancelado' = 'confirmado'
    ): void {
      const pedido = db
        .insert(pedidos)
        .values({
          numero: `P-${numero}`,
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: precio,
          estado,
          fechaIngreso: fecha
        })
        .returning()
        .get()
      db.insert(pedidoItems)
        .values({
          pedidoId: pedido.id,
          tipoItem: 'marco',
          referencia,
          cantidad: 1,
          subtotal: precio
        })
        .run()
    }
    crearPedidoConMarco('0001', 'M-2003', 100000, '2026-04-01')
    crearPedidoConMarco('0002', 'M-2003', 100000, '2026-04-05')
    crearPedidoConMarco('0003', 'M-2003', 100000, '2026-04-10')
    crearPedidoConMarco('0004', 'M-1500', 150000, '2026-04-12')
    crearPedidoConMarco('0005', null, 80000, '2026-04-20') // sin referencia
    crearPedidoConMarco('0006', 'M-2003', 999999, '2026-04-25', 'cancelado') // excluido
  })

  it('agrupa por referencia y ordena por cantidad desc', () => {
    const top = topMarcosVendidos(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 5 })
    expect(top[0]!.referencia).toBe('M-2003')
    expect(top[0]!.cantidad).toBe(3)
    expect(top[0]!.total).toBe(300000)
  })

  it('agrupa NULL/empty bajo "Sin referencia"', () => {
    const top = topMarcosVendidos(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 5 })
    const sinRef = top.find((t) => t.referencia === 'Sin referencia')!
    expect(sinRef).toBeDefined()
    expect(sinRef.cantidad).toBe(1)
  })

  it('excluye pedidos cancelados', () => {
    const top = topMarcosVendidos(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 5 })
    const m2003 = top.find((t) => t.referencia === 'M-2003')!
    expect(m2003.cantidad).toBe(3) // no 4
  })

  it('respeta el limit', () => {
    const top = topMarcosVendidos(db, { desde: '2026-04-01', hasta: '2026-04-30', limit: 1 })
    expect(top).toHaveLength(1)
  })
})

describe.runIf(nativeAbiAvailable)('ingresosPorTipoTrabajo — donut', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Test' }).returning().get()
    // 2 pedidos enmarcación + 1 restauración
    function crearPedidoFactura(
      tipo: 'enmarcacion_estandar' | 'restauracion',
      numero: string,
      total: number
    ): void {
      const pedido = db
        .insert(pedidos)
        .values({
          numero: `P-${numero}`,
          clienteId: cliente.id,
          tipoTrabajo: tipo,
          precioTotal: total,
          estado: 'confirmado',
          fechaIngreso: '2026-04-10'
        })
        .returning()
        .get()
      db.insert(facturas)
        .values({
          numero: `F-${numero}`,
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-10',
          total,
          estado: 'pendiente'
        })
        .run()
    }
    crearPedidoFactura('enmarcacion_estandar', '0001', 200000)
    crearPedidoFactura('enmarcacion_estandar', '0002', 100000)
    crearPedidoFactura('restauracion', '0003', 80000)
  })

  it('agrupa pedidos por tipo de trabajo', () => {
    const filas = ingresosPorTipoTrabajo(db, { desde: '2026-04-01', hasta: '2026-04-30' })
    const enm = filas.find((f) => f.categoria === 'enmarcacion_estandar')!
    expect(enm.total).toBe(300000)
    expect(enm.cantidad).toBe(2)
    const rest = filas.find((f) => f.categoria === 'restauracion')!
    expect(rest.total).toBe(80000)
  })

  it('ordena por total desc', () => {
    const filas = ingresosPorTipoTrabajo(db, { desde: '2026-04-01', hasta: '2026-04-30' })
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i - 1]!.total >= filas[i]!.total).toBe(true)
    }
  })

  it('NO incluye categorías sintéticas con total 0', () => {
    const dbVacio = createTestDb().db
    const filas = ingresosPorTipoTrabajo(dbVacio, {
      desde: '2026-04-01',
      hasta: '2026-04-30'
    })
    expect(filas.every((f) => f.total > 0)).toBe(true)
  })

  it('incluye contratos cuando hay cuentas de cobro pagadas en el rango', () => {
    const cliente = db.insert(clientes).values({ nombre: 'Empresa' }).returning().get()
    const contrato = db
      .insert(contratos)
      .values({
        numero: 'C-0001',
        clienteId: cliente.id,
        total: 500000,
        fecha: '2026-04-01',
        estado: 'aprobada'
      })
      .returning()
      .get()
    db.insert(cuentasCobro)
      .values({
        numero: 'CC-0001',
        contratoId: contrato.id,
        total: 500000,
        retencion: 0,
        totalNeto: 500000,
        estado: 'pagada',
        fecha: '2026-04-05'
      })
      .run()
    const filas = ingresosPorTipoTrabajo(db, { desde: '2026-04-01', hasta: '2026-04-30' })
    const contratosFila = filas.find((f) => f.categoria === 'contratos')!
    expect(contratosFila).toBeDefined()
    expect(contratosFila.total).toBe(500000)
  })

  it('incluye kits cuando hay ventas en el rango', () => {
    const cliente = db.insert(clientes).values({ nombre: 'Visitante' }).returning().get()
    db.insert(ventasKits)
      .values({
        clienteId: cliente.id,
        precio: 15000,
        fecha: '2026-04-08'
      })
      .run()
    const filas = ingresosPorTipoTrabajo(db, { desde: '2026-04-01', hasta: '2026-04-30' })
    const kitsFila = filas.find((f) => f.categoria === 'kits')!
    expect(kitsFila).toBeDefined()
    expect(kitsFila.total).toBe(15000)
  })
})

// Hardening: handler IPC `finanzas:registrarManual` recibe payload del
// renderer. Sin validarMonto/validarFechaISO/validarEnum un payload corrupto
// puede persistir Infinity/NaN/strings o enums fuera de catálogo, corrompiendo
// permanentemente todos los reportes (resumenMensual, serieMensual, margen).
describe.runIf(nativeAbiAvailable)('registrarMovimientoManual — defense in depth', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  function inputValido() {
    return {
      tipo: 'ingreso' as const,
      categoria: 'otro' as const,
      monto: 50000,
      fecha: '2026-05-06',
      descripcion: null,
      referenciaTipo: 'manual' as const,
      referenciaId: null,
      proveedorId: null
    }
  }

  it('rechaza monto Infinity', () => {
    expect(() =>
      registrarMovimientoManual(db, { ...inputValido(), monto: Number.POSITIVE_INFINITY })
    ).toThrow(/no es un número finito válido/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza monto NaN', () => {
    expect(() => registrarMovimientoManual(db, { ...inputValido(), monto: NaN })).toThrow(
      /no es un número finito válido/i
    )
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza monto cero (CHECK schema exige > 0)', () => {
    expect(() => registrarMovimientoManual(db, { ...inputValido(), monto: 0 })).toThrow()
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza monto negativo', () => {
    expect(() =>
      registrarMovimientoManual(db, { ...inputValido(), monto: -100 })
    ).toThrow()
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza fecha con formato inválido', () => {
    expect(() =>
      registrarMovimientoManual(db, { ...inputValido(), fecha: '2026/05/06' })
    ).toThrow(/formato/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza tipo fuera de catálogo', () => {
    expect(() =>
      registrarMovimientoManual(db, {
        ...inputValido(),
        tipo: 'inventado' as never
      })
    ).toThrow()
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('rechaza categoria fuera de catálogo', () => {
    expect(() =>
      registrarMovimientoManual(db, {
        ...inputValido(),
        categoria: 'inventada' as never
      })
    ).toThrow()
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(0)
  })

  it('acepta payload válido y persiste un movimiento', () => {
    const mov = registrarMovimientoManual(db, inputValido())
    expect(mov.monto).toBe(50000)
    expect(mov.tipo).toBe('ingreso')
    expect(db.select({ n: sql<number>`count(*)` }).from(movimientosFinancieros).get()?.n).toBe(1)
  })
})
