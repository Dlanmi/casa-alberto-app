// Integration test for the sin_reclamar reclassification flow surfaced by the
// business-correctness audit. Verifies that pedidosSinReclamar:
//   1. Automatically moves `listo` → `sin_reclamar` after N días (default 15),
//      via reclasificarPedidos.
//   2. Devuelve todos los pedidos ya reclasificados.
import { beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, facturas, muestrasMarcos, pagos, pedidoItems, pedidos, preciosVidrios } from '../schema'
import { cotizarEnmarcacionEstandar } from './cotizador'
import {
  cambiarEstadoPedido,
  cobrarYEntregar,
  crearPedidoConfirmadoConFactura,
  crearPedidoDesdeCotizacion,
  crearPedidoDirecto,
  editarPedidoComercial,
  listarPedidos,
  obtenerSaldosPorPedido,
  pedidosAgenda,
  pedidosSinAbonoConSaldo,
  pedidosSinReclamar,
  reclasificarPedidos
} from './pedidos'
import { devoluciones, movimientosFinancieros } from '../schema'

describe.runIf(nativeAbiAvailable)(
  'pedidosAgenda (agenda global de pedidos activos)',
  () => {
    let db: DB
    let clienteId: number

    beforeEach(() => {
      db = createTestDb().db
      const cliente = db.insert(clientes).values({ nombre: 'Cliente Agenda' }).returning().get()
      clienteId = cliente.id
    })

    function insertPedido(args: {
      numero: string
      estado: (typeof pedidos.$inferInsert)['estado']
      fechaEntrega: string | null
    }): void {
      db.insert(pedidos)
        .values({
          numero: args.numero,
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 60000,
          estado: args.estado,
          fechaIngreso: '2026-04-01',
          fechaEntrega: args.fechaEntrega
        })
        .run()
    }

    it('incluye solo estados activos de agenda y excluye terminales/cotizado', () => {
      insertPedido({ numero: 'P-0001', estado: 'confirmado', fechaEntrega: '2026-04-10' })
      insertPedido({ numero: 'P-0002', estado: 'en_proceso', fechaEntrega: '2026-04-11' })
      insertPedido({ numero: 'P-0003', estado: 'listo', fechaEntrega: '2026-04-12' })
      insertPedido({ numero: 'P-0004', estado: 'sin_reclamar', fechaEntrega: '2026-04-13' })
      insertPedido({ numero: 'P-0005', estado: 'cotizado', fechaEntrega: '2026-04-14' })
      insertPedido({ numero: 'P-0006', estado: 'entregado', fechaEntrega: '2026-04-15' })
      insertPedido({ numero: 'P-0007', estado: 'cancelado', fechaEntrega: '2026-04-16' })
      insertPedido({ numero: 'P-0008', estado: 'confirmado', fechaEntrega: null })

      const rows = pedidosAgenda(db)
      expect(rows).toHaveLength(4)
      expect(rows.map((r) => r.pedidos.numero)).toEqual(['P-0001', 'P-0002', 'P-0003', 'P-0004'])
    })

    it('ordena por fechaEntrega asc y numero asc como desempate', () => {
      insertPedido({ numero: 'P-0009', estado: 'confirmado', fechaEntrega: '2026-04-20' })
      insertPedido({ numero: 'P-0002', estado: 'confirmado', fechaEntrega: '2026-04-19' })
      insertPedido({ numero: 'P-0001', estado: 'confirmado', fechaEntrega: '2026-04-19' })

      const rows = pedidosAgenda(db)
      expect(rows.map((r) => r.pedidos.numero)).toEqual(['P-0001', 'P-0002', 'P-0009'])
    })
  }
)

describe.runIf(nativeAbiAvailable)(
  'pedidosSinReclamar (Fase 2 §B — reclasificación automática)',
  () => {
    let db: DB
    let clienteId: number

    beforeEach(() => {
      db = createTestDb().db
      const cliente = db.insert(clientes).values({ nombre: 'Cliente Test' }).returning().get()
      clienteId = cliente.id
    })

    function insertPedidoListo(numero: string, updatedAtOffsetDays: number): number {
      // Insert a pedido already in estado=listo with updatedAt shifted `offsetDays`
      // into the past. We use sqlite's datetime() to keep the format consistent.
      const pedido = db
        .insert(pedidos)
        .values({
          numero,
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 50000,
          estado: 'listo',
          fechaIngreso: '2026-03-01',
          updatedAt: sql`datetime('now', ${`-${updatedAtOffsetDays} days`})`
        })
        .returning()
        .get()
      return pedido.id
    }

    it('reclasifica pedidos en listo con más de 15 días → sin_reclamar', () => {
      const viejoId = insertPedidoListo('P-0001', 20) // 20 días en listo
      const recienteId = insertPedidoListo('P-0002', 5) // apenas 5 días

      const cantidad = reclasificarPedidos(db)
      expect(cantidad).toBe(1)

      const viejo = db
        .select()
        .from(pedidos)
        .where(sql`${pedidos.id} = ${viejoId}`)
        .get()
      const reciente = db
        .select()
        .from(pedidos)
        .where(sql`${pedidos.id} = ${recienteId}`)
        .get()
      expect(viejo?.estado).toBe('sin_reclamar')
      expect(reciente?.estado).toBe('listo')
    })

    it('pedidosSinReclamar incluye los reclasificados', () => {
      insertPedidoListo('P-0001', 25) // queda en sin_reclamar tras reclasificar
      insertPedidoListo('P-0002', 16) // 16 > 15 → también cae
      insertPedidoListo('P-0003', 2) // aún fresco, no sale

      const sinReclamar = pedidosSinReclamar(db)
      expect(sinReclamar).toHaveLength(2)
      const numeros = sinReclamar.map((row) => row.pedidos.numero).sort()
      expect(numeros).toEqual(['P-0001', 'P-0002'])
      // Todos deben terminar en estado sin_reclamar tras la llamada.
      for (const row of sinReclamar) {
        expect(row.pedidos.estado).toBe('sin_reclamar')
      }
    })

    it('idempotente: llamar dos veces no duplica ni rompe nada', () => {
      insertPedidoListo('P-0001', 30)
      const primera = reclasificarPedidos(db)
      const segunda = reclasificarPedidos(db)
      expect(primera).toBe(1)
      expect(segunda).toBe(0)
    })
  }
)

// Regresión del bug de fan-out en obtenerSaldosPorPedido.
// La versión anterior hacía un triple LEFT JOIN (pedidos × facturas × pagos)
// y usaba `sum(distinct facturas.total)` + `sum(pagos.monto)`. El producto
// cartesiano multiplicaba los pagos por la cantidad de facturas, y el
// distinct tragaba facturas con total idéntico. Esta suite cubre los casos
// problemáticos para que no vuelva a regresarse a un JOIN único.
describe.runIf(nativeAbiAvailable)('obtenerSaldosPorPedido (Fase 14 — fan-out regression)', () => {
  let db: DB
  let clienteId: number

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Test' }).returning().get()
    clienteId = cliente.id
  })

  function insertPedido(numero: string, precio: number): number {
    const p = db
      .insert(pedidos)
      .values({
        numero,
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        precioTotal: precio,
        estado: 'confirmado',
        fechaIngreso: '2026-03-01'
      })
      .returning()
      .get()
    return p.id
  }

  function insertFactura(
    pedidoId: number,
    numero: string,
    total: number,
    estado: 'pendiente' | 'pagada' | 'anulada' = 'pendiente'
  ): number {
    const f = db
      .insert(facturas)
      .values({
        numero,
        pedidoId,
        clienteId,
        fecha: '2026-03-01',
        total,
        estado
      })
      .returning()
      .get()
    return f.id
  }

  function insertPago(facturaId: number, monto: number): void {
    db.insert(pagos)
      .values({
        facturaId,
        monto,
        metodoPago: 'efectivo',
        fecha: '2026-03-02'
      })
      .run()
  }

  it('pedido sin factura → total = precioTotal, pagado = 0, saldo = precioTotal', () => {
    const id = insertPedido('P-0001', 100000)
    const saldos = obtenerSaldosPorPedido(db)
    const s = saldos.find((x) => x.pedidoId === id)
    expect(s).toEqual({ pedidoId: id, total: 100000, pagado: 0, saldo: 100000 })
  })

  it('una factura activa con pago parcial → saldo = total - pagado', () => {
    const id = insertPedido('P-0002', 100000)
    const fid = insertFactura(id, 'F-001', 100000)
    insertPago(fid, 40000)
    const s = obtenerSaldosPorPedido(db).find((x) => x.pedidoId === id)
    expect(s).toEqual({ pedidoId: id, total: 100000, pagado: 40000, saldo: 60000 })
  })

  // El escenario "dos facturas activas para el mismo pedido" es imposible
  // gracias al UNIQUE partial index (SPEC-007). El test anterior que
  // insertaba F-010 y F-011 activas al mismo pedido ya no corre: el
  // INSERT de la segunda falla con el constraint. El fan-out por N
  // facturas activas sigue cubierto indirectamente por `mezcla anulada +
  // activa` (ver abajo). El fan-out por N pagos en UNA factura está
  // cubierto por `varios pagos en una factura`.

  it('mezcla anulada + activa → solo cuenta la activa (total y pagos)', () => {
    const id = insertPedido('P-0004', 0)
    const activa = insertFactura(id, 'F-020', 80000, 'pendiente')
    const anulada = insertFactura(id, 'F-021', 500000, 'anulada')
    insertPago(activa, 20000)
    insertPago(anulada, 500000) // pago de una anulada: no debe sumar
    const s = obtenerSaldosPorPedido(db).find((x) => x.pedidoId === id)
    expect(s).toEqual({ pedidoId: id, total: 80000, pagado: 20000, saldo: 60000 })
  })

  it('varios pagos en una factura se suman correctamente', () => {
    const id = insertPedido('P-0005', 0)
    const fid = insertFactura(id, 'F-030', 90000)
    insertPago(fid, 10000)
    insertPago(fid, 20000)
    insertPago(fid, 30000)
    const s = obtenerSaldosPorPedido(db).find((x) => x.pedidoId === id)
    expect(s).toEqual({ pedidoId: id, total: 90000, pagado: 60000, saldo: 30000 })
  })

  it('retorna una entrada por cada pedido en el sistema', () => {
    insertPedido('P-0006', 10000)
    insertPedido('P-0007', 20000)
    insertPedido('P-0008', 30000)
    const saldos = obtenerSaldosPorPedido(db)
    expect(saldos).toHaveLength(3)
  })

  // v1.7.1 — el clamp `Math.max(0, total - pagado)` enmascaraba sobrepagos.
  // Cuando el cliente paga más de lo facturado (sobrepago directo) o cuando
  // hay devoluciones que exceden los pagos restantes, el saldo real es
  // negativo y representa un crédito a favor del cliente. La UI lo muestra
  // como "Crédito del cliente"; el backend debe exponerlo, no clampearlo.
  it('expone saldo negativo cuando hay crédito a favor del cliente', () => {
    const id = insertPedido('P-0009', 0)
    const fid = insertFactura(id, 'F-040', 50000)
    insertPago(fid, 60000) // sobrepago de 10000
    const s = obtenerSaldosPorPedido(db).find((x) => x.pedidoId === id)
    expect(s).toEqual({ pedidoId: id, total: 50000, pagado: 60000, saldo: -10000 })
  })
})

// Backend bloquea la transición a "entregado" si la factura tiene saldo
// pendiente. El bloqueo visual del panel es UX, pero un IPC directo podía
// saltarlo. Esta suite documenta la garantía a nivel backend.
describe.runIf(nativeAbiAvailable)('cambiarEstadoPedido · saldo al entregar', () => {
  let db: DB
  let clienteId: number

  beforeEach(() => {
    db = createTestDb().db
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Entrega' }).returning().get()
    clienteId = cliente.id
  })

  function insertPedidoListo(numero: string, precio: number): number {
    const p = db
      .insert(pedidos)
      .values({
        numero,
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        precioTotal: precio,
        estado: 'listo',
        fechaIngreso: '2026-04-01'
      })
      .returning()
      .get()
    return p.id
  }

  it('rechaza entregar un pedido con saldo pendiente en su factura activa', () => {
    const pedidoId = insertPedidoListo('P-E001', 100000)
    db.insert(facturas)
      .values({
        numero: 'F-E001',
        pedidoId,
        clienteId,
        fecha: '2026-04-02',
        total: 100000,
        estado: 'pendiente'
      })
      .run()
    expect(() => cambiarEstadoPedido(db, pedidoId, 'entregado')).toThrow(/saldo pendiente/i)
    // Y el estado del pedido no cambió.
    const actual = db
      .select()
      .from(pedidos)
      .where(sql`${pedidos.id} = ${pedidoId}`)
      .get()
    expect(actual?.estado).toBe('listo')
  })

  it('permite entregar cuando la factura activa está totalmente pagada', () => {
    const pedidoId = insertPedidoListo('P-E002', 100000)
    const factura = db
      .insert(facturas)
      .values({
        numero: 'F-E002',
        pedidoId,
        clienteId,
        fecha: '2026-04-02',
        total: 100000,
        estado: 'pendiente'
      })
      .returning()
      .get()
    db.insert(pagos)
      .values({ facturaId: factura.id, monto: 100000, metodoPago: 'efectivo', fecha: '2026-04-02' })
      .run()
    const updated = cambiarEstadoPedido(db, pedidoId, 'entregado')
    expect(updated.estado).toBe('entregado')
  })

  it('permite entregar cuando no hay factura (pago externo)', () => {
    const pedidoId = insertPedidoListo('P-E003', 80000)
    const updated = cambiarEstadoPedido(db, pedidoId, 'entregado')
    expect(updated.estado).toBe('entregado')
  })

  it('permite entregar si todas las facturas del pedido están anuladas', () => {
    const pedidoId = insertPedidoListo('P-E004', 50000)
    db.insert(facturas)
      .values({
        numero: 'F-E004',
        pedidoId,
        clienteId,
        fecha: '2026-04-02',
        total: 50000,
        estado: 'anulada'
      })
      .run()
    const updated = cambiarEstadoPedido(db, pedidoId, 'entregado')
    expect(updated.estado).toBe('entregado')
  })
})

describe.runIf(nativeAbiAvailable)(
  'pedidosSinAbonoConSaldo (v1.6.0 — lista accionable para HelpButton)',
  () => {
    let db: DB

    beforeEach(() => {
      db = createTestDb().db
    })

    function seedDeudor(args: {
      clienteNombre: string
      clienteTelefono: string | null
      pedidoNumero: string
      facturaNumero: string
      total: number
      pagado?: number
      fechaFactura: string
      fechaEntrega?: string | null
    }): number {
      const cliente = db
        .insert(clientes)
        .values({ nombre: args.clienteNombre, telefono: args.clienteTelefono })
        .returning()
        .get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: args.pedidoNumero,
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          subtotal: args.total,
          totalMateriales: 0,
          precioTotal: args.total,
          estado: 'confirmado',
          tipoEntrega: 'estandar',
          fechaIngreso: args.fechaFactura,
          fechaEntrega: args.fechaEntrega ?? null
        })
        .returning()
        .get()
      const factura = db
        .insert(facturas)
        .values({
          numero: args.facturaNumero,
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: args.fechaFactura,
          total: args.total,
          estado: 'pendiente'
        })
        .returning()
        .get()
      if (args.pagado && args.pagado > 0) {
        db.insert(pagos)
          .values({
            facturaId: factura.id,
            monto: args.pagado,
            metodoPago: 'efectivo',
            fecha: args.fechaFactura
          })
          .run()
      }
      return pedido.id
    }

    it('devuelve lista vacía cuando no hay facturas con saldo', () => {
      expect(pedidosSinAbonoConSaldo(db)).toEqual([])
    })

    it('calcula el saldo correcto (total - pagos)', () => {
      seedDeudor({
        clienteNombre: 'Ana',
        clienteTelefono: '3001112222',
        pedidoNumero: 'P-0001',
        facturaNumero: 'F-0001',
        total: 100000,
        pagado: 30000,
        fechaFactura: '2026-04-01'
      })
      const rows = pedidosSinAbonoConSaldo(db)
      expect(rows).toHaveLength(1)
      expect(rows[0].saldoPendiente).toBe(70000)
      expect(rows[0].clienteNombre).toBe('Ana')
      expect(rows[0].clienteTelefono).toBe('3001112222')
      expect(rows[0].pedidoNumero).toBe('P-0001')
    })

    it('excluye facturas totalmente pagadas', () => {
      seedDeudor({
        clienteNombre: 'Carlos',
        clienteTelefono: null,
        pedidoNumero: 'P-0002',
        facturaNumero: 'F-0002',
        total: 50000,
        pagado: 50000,
        fechaFactura: '2026-04-01'
      })
      expect(pedidosSinAbonoConSaldo(db)).toEqual([])
    })

    it('excluye facturas anuladas', () => {
      const cliente = db.insert(clientes).values({ nombre: 'María' }).returning().get()
      const pedido = db
        .insert(pedidos)
        .values({
          numero: 'P-0003',
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          subtotal: 40000,
          totalMateriales: 0,
          precioTotal: 40000,
          estado: 'confirmado',
          tipoEntrega: 'estandar',
          fechaIngreso: '2026-04-01'
        })
        .returning()
        .get()
      db.insert(facturas)
        .values({
          numero: 'F-0003',
          pedidoId: pedido.id,
          clienteId: cliente.id,
          fecha: '2026-04-01',
          total: 40000,
          estado: 'anulada'
        })
        .run()
      expect(pedidosSinAbonoConSaldo(db)).toEqual([])
    })

    it('ordena por días sin abono descendente (más viejos primero)', () => {
      // factura más vieja (1 de enero) vs más reciente (20 de abril).
      // julianday usa la fecha "ahora", así que el más viejo tendrá
      // mayor diasSinAbono independientemente del reloj.
      seedDeudor({
        clienteNombre: 'Juan',
        clienteTelefono: '3001111111',
        pedidoNumero: 'P-JUAN',
        facturaNumero: 'F-JUAN',
        total: 50000,
        fechaFactura: '2026-01-01'
      })
      seedDeudor({
        clienteNombre: 'Luis',
        clienteTelefono: '3002222222',
        pedidoNumero: 'P-LUIS',
        facturaNumero: 'F-LUIS',
        total: 50000,
        fechaFactura: '2026-04-20'
      })
      const rows = pedidosSinAbonoConSaldo(db)
      expect(rows).toHaveLength(2)
      // El de enero debe venir primero (más días).
      expect(rows[0].clienteNombre).toBe('Juan')
      expect(rows[1].clienteNombre).toBe('Luis')
      expect(rows[0].diasSinAbono).toBeGreaterThanOrEqual(rows[1].diasSinAbono)
    })

    it('respeta el parámetro limit', () => {
      for (let i = 1; i <= 5; i++) {
        seedDeudor({
          clienteNombre: `Cliente ${i}`,
          clienteTelefono: null,
          pedidoNumero: `P-LIM${i}`,
          facturaNumero: `F-LIM${i}`,
          total: 10000,
          fechaFactura: `2026-04-0${i}`
        })
      }
      const rows = pedidosSinAbonoConSaldo(db, 3)
      expect(rows).toHaveLength(3)
    })

    it('incluye pedidos con abono parcial (saldo > 0)', () => {
      seedDeudor({
        clienteNombre: 'Pedro',
        clienteTelefono: '3003333333',
        pedidoNumero: 'P-PED',
        facturaNumero: 'F-PED',
        total: 100000,
        pagado: 20000,
        fechaFactura: '2026-04-01'
      })
      const rows = pedidosSinAbonoConSaldo(db)
      expect(rows).toHaveLength(1)
      expect(rows[0].saldoPendiente).toBe(80000)
    })
  }
)

describe.runIf(nativeAbiAvailable)('crearPedidoDesdeCotizacion · defensas de cotización', () => {
  let db: DB
  let clienteId: number
  let muestraMarcoId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db.insert(clientes).values({ nombre: 'Cliente Cotización' }).returning().get().id
    muestraMarcoId = db
      .insert(muestrasMarcos)
      .values({
        referencia: 'AUD-001',
        colillaCm: 20,
        precioMetro: 10000
      })
      .returning()
      .get().id
    db.insert(preciosVidrios)
      .values({
        tipo: 'claro',
        nombre: 'Vidrio claro 2mm',
        espesorMm: 2,
        precioM2: 100000,
        costoM2Estimado: 62000
      })
      .run()
  })

  it('rechaza una cotización manipulada aunque el renderer la envíe por IPC', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 50,
      altoCm: 70,
      muestraMarcoId,
      tipoVidrio: 'claro'
    })

    expect(() =>
      crearPedidoDesdeCotizacion(
        db,
        {
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          descripcion: 'Intento manipulado',
          anchoCm: 50,
          altoCm: 70,
          muestraMarcoId,
          tipoVidrio: 'claro',
          porcentajeMateriales: 10,
          fechaIngreso: '2026-04-01'
        },
        { ...cotizacion, precioTotal: 1 }
      )
    ).toThrow(/listas de precios actuales/i)

    const count = db
      .select({ n: sql<number>`count(*)` })
      .from(pedidos)
      .get()
    expect(count?.n).toBe(0)
  })

  it('crea pedido confirmado, factura y abono en una sola operación', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro'
    })

    const result = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido atómico',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      facturaFecha: '2026-04-01',
      abono: {
        monto: 10000,
        metodoPago: 'efectivo',
        fecha: '2026-04-01'
      }
    })

    expect(result.pedido.estado).toBe('confirmado')
    expect(result.factura.pedidoId).toBe(result.pedido.id)
    expect(result.factura.clienteId).toBe(clienteId)
    expect(result.factura.total).toBe(result.pedido.precioTotal)
    expect(result.pago?.monto).toBe(10000)
    expect(result.saldo).toBe(result.factura.total - 10000)
  })

  it('guarda descuento explícito y ajusta factura, ítems y rentabilidad', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro'
    })

    const result = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido con descuento',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      descuento: {
        monto: 5000,
        motivo: 'Cliente frecuente'
      },
      facturaFecha: '2026-04-01'
    })

    expect(result.pedido.precioLista).toBe(cotizacion.precioLista)
    expect(result.pedido.descuentoMonto).toBe(5000)
    expect(result.pedido.precioTotal).toBe(cotizacion.precioLista - 5000)
    expect(result.factura.total).toBe(cotizacion.precioLista - 5000)

    const descuentoItem = db
      .select()
      .from(pedidoItems)
      .where(and(eq(pedidoItems.pedidoId, result.pedido.id), eq(pedidoItems.tipoItem, 'descuento')))
      .get()
    expect(descuentoItem).toBeTruthy()
    expect(descuentoItem?.subtotal).toBe(-5000)
    expect(descuentoItem?.descripcion).toContain('Cliente frecuente')
  })

  it('no deja pedido parcial si falla la validación del abono', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro'
    })

    expect(() =>
      crearPedidoConfirmadoConFactura(db, {
        datos: {
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          descripcion: 'Pedido con abono inválido',
          anchoCm: 30,
          altoCm: 40,
          muestraMarcoId,
          tipoVidrio: 'claro',
          porcentajeMateriales: 10,
          fechaIngreso: '2026-04-01'
        },
        cotizacion,
        facturaFecha: '2026-04-01',
        abono: {
          monto: cotizacion.precioTotal + 1,
          metodoPago: 'efectivo',
          fecha: '2026-04-01'
        }
      })
    ).toThrow(/excede el total/i)

    const pedidoCount = db
      .select({ n: sql<number>`count(*)` })
      .from(pedidos)
      .get()
    const facturaCount = db
      .select({ n: sql<number>`count(*)` })
      .from(facturas)
      .get()
    expect(pedidoCount?.n).toBe(0)
    expect(facturaCount?.n).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases del modelo comercial — Fase 3 del rediseño
// ---------------------------------------------------------------------------
describe.runIf(nativeAbiAvailable)('Modelo comercial · edge cases', () => {
  let db: DB
  let clienteId: number
  let muestraMarcoId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db.insert(clientes).values({ nombre: 'Cliente Edge' }).returning().get().id
    muestraMarcoId = db
      .insert(muestrasMarcos)
      .values({
        referencia: 'EDG-001',
        colillaCm: 30,
        precioMetro: 30000,
        costoMetroEstimado: 18000
      })
      .returning()
      .get().id
    db.insert(preciosVidrios)
      .values({
        tipo: 'claro_2mm',
        nombre: 'Vidrio claro 2mm',
        espesorMm: 2,
        precioM2: 100000,
        costoM2Estimado: 60000
      })
      .run()
  })

  it('cancelar pedido con pagos genera devolución automática y movimiento de gasto', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })

    const result = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido para cancelar',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      facturaFecha: '2026-04-01',
      abono: {
        monto: 25000,
        metodoPago: 'efectivo',
        fecha: '2026-04-01'
      }
    })

    expect(result.pago?.monto).toBe(25000)

    // Cancelar el pedido — debe anular factura Y crear devolución por el monto cobrado.
    cambiarEstadoPedido(db, result.pedido.id, 'cancelado')

    const devs = db.select().from(devoluciones).where(eq(devoluciones.facturaId, result.factura.id)).all()
    expect(devs).toHaveLength(1)
    expect(devs[0].monto).toBe(25000)
    expect(devs[0].motivo).toContain(result.pedido.numero)

    const movDev = db
      .select()
      .from(movimientosFinancieros)
      .where(
        and(
          eq(movimientosFinancieros.tipo, 'gasto'),
          eq(movimientosFinancieros.categoria, 'devolucion')
        )
      )
      .all()
    expect(movDev).toHaveLength(1)
    expect(movDev[0].monto).toBe(25000)

    const facturaActualizada = db
      .select()
      .from(facturas)
      .where(eq(facturas.id, result.factura.id))
      .get()
    expect(facturaActualizada?.estado).toBe('anulada')
  })

  it('descuento del 100% (regalo) crea factura con total 0 y la marca como pagada', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })

    const result = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Regalo a cliente vip',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      descuento: {
        monto: cotizacion.precioLista,
        motivo: 'Cortesía'
      },
      facturaFecha: '2026-04-01'
    })

    expect(result.pedido.precioTotal).toBe(0)
    expect(result.factura.total).toBe(0)
    expect(result.factura.estado).toBe('pagada')
    expect(result.saldo).toBe(0)
    expect(result.pago).toBeNull()

    // No se crea movimiento financiero de ingreso (no hubo dinero real).
    const movs = db
      .select()
      .from(movimientosFinancieros)
      .where(eq(movimientosFinancieros.tipo, 'ingreso'))
      .all()
    expect(movs).toHaveLength(0)
  })

  it('rechaza descuento con abono: el abono no puede exceder el total final', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })
    expect(() =>
      crearPedidoConfirmadoConFactura(db, {
        datos: {
          clienteId,
          tipoTrabajo: 'enmarcacion_estandar',
          descripcion: 'Pedido inválido',
          anchoCm: 30,
          altoCm: 40,
          muestraMarcoId,
          tipoVidrio: 'claro_2mm',
          porcentajeMateriales: 10,
          fechaIngreso: '2026-04-01'
        },
        cotizacion,
        descuento: { monto: cotizacion.precioLista - 1000 },
        facturaFecha: '2026-04-01',
        abono: { monto: 50000, metodoPago: 'efectivo', fecha: '2026-04-01' }
      })
    ).toThrow(/abono excede/i)
  })

  it('editarPedidoComercial agrega descuento y recalcula factura activa', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })

    const original = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido para editar',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      facturaFecha: '2026-04-01'
    })

    const totalOriginal = original.pedido.precioTotal
    const editado = editarPedidoComercial(db, {
      pedidoId: original.pedido.id,
      descuentoMonto: 5000,
      descuentoMotivo: 'Cliente frecuente'
    })

    expect(editado.pedido.descuentoMonto).toBe(5000)
    expect(editado.pedido.precioTotal).toBe(totalOriginal - 5000)
    expect(editado.facturaActualizada?.total).toBe(totalOriginal - 5000)
    expect(editado.devolucionGenerada).toBeNull()

    // Verifica que el ítem 'descuento' fue creado en pedido_items.
    const itemDescuento = db
      .select()
      .from(pedidoItems)
      .where(and(eq(pedidoItems.pedidoId, original.pedido.id), eq(pedidoItems.tipoItem, 'descuento')))
      .get()
    expect(itemDescuento).toBeTruthy()
    expect(itemDescuento?.subtotal).toBe(-5000)
    expect(itemDescuento?.descripcion).toContain('Cliente frecuente')
  })

  it('editarPedidoComercial reduce total bajo lo pagado y crea devolución del exceso', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })

    const original = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido con abono',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      facturaFecha: '2026-04-01',
      abono: {
        monto: cotizacion.precioLista,
        metodoPago: 'efectivo',
        fecha: '2026-04-01'
      }
    })

    // Cliente había pagado todo. Aplicamos descuento posterior → genera devolución.
    const editado = editarPedidoComercial(db, {
      pedidoId: original.pedido.id,
      descuentoMonto: 10000,
      descuentoMotivo: 'Ajuste post-cobro'
    })

    expect(editado.devolucionGenerada).not.toBeNull()
    expect(editado.devolucionGenerada?.monto).toBe(10000)
    expect(editado.facturaActualizada?.total).toBe(cotizacion.precioLista - 10000)
    expect(editado.facturaActualizada?.estado).toBe('pagada')
  })

  it('editarPedidoComercial bloquea pedidos entregados o cancelados', () => {
    const cotizacion = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })

    const original = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido entregado',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion,
      facturaFecha: '2026-04-01',
      abono: {
        monto: cotizacion.precioLista,
        metodoPago: 'efectivo',
        fecha: '2026-04-01'
      }
    })

    cambiarEstadoPedido(db, original.pedido.id, 'en_proceso')
    cambiarEstadoPedido(db, original.pedido.id, 'listo')
    cambiarEstadoPedido(db, original.pedido.id, 'entregado')

    expect(() =>
      editarPedidoComercial(db, {
        pedidoId: original.pedido.id,
        descuentoMonto: 5000
      })
    ).toThrow(/no se puede editar/i)
  })
})

// ---------------------------------------------------------------------------
// Quick-pay (cobrar saldo + mover a entregado en una sola transacción)
// ---------------------------------------------------------------------------
describe.runIf(nativeAbiAvailable)('cobrarYEntregar · quick-pay atómico', () => {
  let db: DB
  let clienteId: number
  let muestraMarcoId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db.insert(clientes).values({ nombre: 'Cliente QP' }).returning().get().id
    muestraMarcoId = db
      .insert(muestrasMarcos)
      .values({ referencia: 'QP-001', colillaCm: 30, precioMetro: 30000, costoMetroEstimado: 18000 })
      .returning()
      .get().id
    db.insert(preciosVidrios)
      .values({
        tipo: 'claro_2mm',
        nombre: 'Vidrio claro 2mm',
        espesorMm: 2,
        precioM2: 100000,
        costoM2Estimado: 60000
      })
      .run()
  })

  function crearPedidoListoConSaldo(abono: number): {
    pedidoId: number
    facturaId: number
    saldo: number
    total: number
  } {
    const cot = cotizarEnmarcacionEstandar(db, {
      anchoCm: 30,
      altoCm: 40,
      muestraMarcoId,
      tipoVidrio: 'claro_2mm'
    })
    const result = crearPedidoConfirmadoConFactura(db, {
      datos: {
        clienteId,
        tipoTrabajo: 'enmarcacion_estandar',
        descripcion: 'Pedido para QP',
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId,
        tipoVidrio: 'claro_2mm',
        porcentajeMateriales: 10,
        fechaIngreso: '2026-04-01'
      },
      cotizacion: cot,
      facturaFecha: '2026-04-01',
      abono:
        abono > 0
          ? { monto: abono, metodoPago: 'efectivo', fecha: '2026-04-01' }
          : null
    })
    cambiarEstadoPedido(db, result.pedido.id, 'en_proceso')
    cambiarEstadoPedido(db, result.pedido.id, 'listo')
    return {
      pedidoId: result.pedido.id,
      facturaId: result.factura.id,
      saldo: result.factura.total - abono,
      total: result.factura.total
    }
  }

  it('cobra saldo completo y mueve a entregado en una sola transacción', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(20000)

    const result = cobrarYEntregar(db, {
      pedidoId,
      monto: saldo,
      metodoPago: 'efectivo',
      fecha: '2026-04-15'
    })

    expect(result.pedido.estado).toBe('entregado')
    expect(result.pago.monto).toBe(saldo)
    expect(result.pago.metodoPago).toBe('efectivo')
    expect(result.factura.estado).toBe('pagada')
    expect(result.saldoFinal).toBe(0)
    expect(result.facturaPagada).toBe(true)

    // Verifica que el movimiento financiero también se creó
    const movs = db
      .select()
      .from(movimientosFinancieros)
      .where(
        and(
          eq(movimientosFinancieros.tipo, 'ingreso'),
          eq(movimientosFinancieros.referenciaTipo, 'pago')
        )
      )
      .all()
    // 1 movimiento del abono inicial + 1 de cobrarYEntregar
    expect(movs).toHaveLength(2)
  })

  it('rechaza si el pedido NO está en estado listo', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(0)
    cambiarEstadoPedido(db, pedidoId, 'entregado') // ya está entregado

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: saldo,
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow(/estado "listo"/i)
  })

  it('rechaza si el monto es menor al saldo (cobro parcial no entrega)', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(0)

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: saldo - 1000,
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow(/cobrar el saldo completo/i)
  })

  it('rechaza si el monto excede el saldo', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(0)

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: saldo + 10000,
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow(/excede el saldo pendiente/i)
  })

  it('rechaza monto <= 0', () => {
    expect(() =>
      cobrarYEntregar(db, {
        pedidoId: 1,
        monto: 0,
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow(/mayor a 0/i)
  })

  it('rechaza método de pago inválido', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(0)

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: saldo,
        // @ts-expect-error — probamos validación runtime
        metodoPago: 'bitcoin',
        fecha: '2026-04-15'
      })
    ).toThrow()
  })

  it('rechaza si no hay factura activa (factura anulada)', () => {
    const { pedidoId, saldo, facturaId } = crearPedidoListoConSaldo(0)
    db.update(facturas).set({ estado: 'anulada' }).where(eq(facturas.id, facturaId)).run()

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: saldo,
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow(/factura activa/i)
  })

  it('rollback completo si algo falla a mitad: ni pago ni estado se persisten', () => {
    const { pedidoId } = crearPedidoListoConSaldo(0)

    expect(() =>
      cobrarYEntregar(db, {
        pedidoId,
        monto: 9_999_999_999, // excede saldo → throw
        metodoPago: 'efectivo',
        fecha: '2026-04-15'
      })
    ).toThrow()

    // Pedido sigue en 'listo'
    const pedido = db.select().from(pedidos).where(eq(pedidos.id, pedidoId)).get()
    expect(pedido?.estado).toBe('listo')

    // Solo está el pago del abono inicial (0 en este caso, así que ninguno)
    const pagosCount = db
      .select({ n: sql<number>`count(*)` })
      .from(pagos)
      .get()
    expect(pagosCount?.n).toBe(0)
  })

  it('crea movimiento financiero con la categoría correcta según tipo de trabajo', () => {
    const { pedidoId, saldo } = crearPedidoListoConSaldo(0)
    cobrarYEntregar(db, {
      pedidoId,
      monto: saldo,
      metodoPago: 'transferencia',
      fecha: '2026-04-15'
    })
    const mov = db
      .select()
      .from(movimientosFinancieros)
      .where(eq(movimientosFinancieros.referenciaTipo, 'pago'))
      .get()
    expect(mov?.categoria).toBe('enmarcacion')
    expect(mov?.tipo).toBe('ingreso')
  })
})

describe.runIf(nativeAbiAvailable)(
  'listarPedidos — búsqueda case-insensitive (CommandPalette)',
  () => {
    let db: DB
    let clienteId: number

    beforeEach(() => {
      db = createTestDb().db
      clienteId = db.insert(clientes).values({ nombre: 'Cliente Búsqueda' }).returning().get().id
      db.insert(pedidos)
        .values([
          {
            numero: 'P-0001',
            clienteId,
            tipoTrabajo: 'enmarcacion_estandar',
            descripcion: 'Marco para foto familiar',
            precioTotal: 50000,
            estado: 'confirmado',
            fechaIngreso: '2026-04-01'
          },
          {
            numero: 'P-0042',
            clienteId,
            tipoTrabajo: 'enmarcacion_estandar',
            descripcion: 'Cuadro decorativo grande',
            precioTotal: 150000,
            estado: 'en_proceso',
            fechaIngreso: '2026-04-02'
          },
          {
            numero: 'P-0099',
            clienteId,
            tipoTrabajo: 'restauracion',
            descripcion: 'Restauración óleo',
            precioTotal: 200000,
            estado: 'listo',
            fechaIngreso: '2026-04-03'
          }
        ])
        .run()
    })

    it('filtra por número (LIKE parcial)', () => {
      const rows = listarPedidos(db, { busqueda: '0042' })
      expect(rows).toHaveLength(1)
      expect(rows[0]!.numero).toBe('P-0042')
    })

    it('filtra por descripción (case-insensitive)', () => {
      const rows = listarPedidos(db, { busqueda: 'CUADRO' })
      expect(rows).toHaveLength(1)
      expect(rows[0]!.descripcion).toContain('Cuadro')
    })

    it('combina búsqueda con estado', () => {
      const rows = listarPedidos(db, { busqueda: 'P-', estado: 'listo' })
      expect(rows).toHaveLength(1)
      expect(rows[0]!.numero).toBe('P-0099')
    })

    it('respeta limit con búsqueda activa', () => {
      const rows = listarPedidos(db, { busqueda: 'P-', limit: 2 })
      expect(rows).toHaveLength(2)
    })
  }
)

// ===========================================================================
// crearPedidoDirecto — feature pedido sin pasar por cotizador
// ===========================================================================

describe.runIf(nativeAbiAvailable)('crearPedidoDirecto', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  function inputBase(overrides: {
    cliente?: { tipo: 'existente'; id: number } | { tipo: 'nuevo'; data: { nombre: string; telefono?: string } }
    items?: Array<{ tipoItem: 'marco' | 'vidrio' | 'otro'; descripcion: string; cantidad: number; precioUnitario: number; costoUnitarioEstimado?: number | null }>
    estadoInicial?: 'cotizado' | 'confirmado' | 'en_proceso' | 'listo' | 'entregado'
    fechaIngreso?: string
    fechaEntrega?: string | null
    abono?: { monto: number; metodoPago: 'efectivo' | 'transferencia'; fecha: string } | null
    precioTotalOverride?: number | null
  } = {}) {
    return {
      cliente: overrides.cliente ?? { tipo: 'nuevo' as const, data: { nombre: 'María García', telefono: '3001234567' } },
      pedido: {
        tipoTrabajo: 'enmarcacion_estandar' as const,
        descripcion: 'Marco directo prueba',
        anchoCm: 30,
        altoCm: 40,
        fechaIngreso: overrides.fechaIngreso ?? '2026-04-15',
        fechaEntrega: overrides.fechaEntrega ?? '2026-04-25',
        tipoEntrega: 'estandar' as const,
        estadoInicial: overrides.estadoInicial ?? 'confirmado',
        notas: null
      },
      items: overrides.items ?? [
        { tipoItem: 'marco' as const, descripcion: 'Marco roble', cantidad: 1, precioUnitario: 50000, costoUnitarioEstimado: 30000 },
        { tipoItem: 'vidrio' as const, descripcion: 'Vidrio claro 30x40', cantidad: 1, precioUnitario: 12000, costoUnitarioEstimado: 6000 }
      ],
      precioTotalOverride: overrides.precioTotalOverride ?? null,
      factura: { fecha: overrides.fechaIngreso ?? '2026-04-15' },
      abono: overrides.abono === undefined ? null : overrides.abono,
      generarPDF: false
    }
  }

  it('crea pedido confirmado + factura + items con cliente nuevo', () => {
    const result = crearPedidoDirecto(db, inputBase())
    expect(result.pedido.estado).toBe('confirmado')
    expect(result.pedido.precioTotal).toBe(62000)
    expect(result.pedido.subtotal).toBe(62000)
    expect(result.pedido.descuentoMonto).toBe(0)
    expect(result.factura.estado).toBe('pendiente')
    expect(result.factura.total).toBe(62000)
    expect(result.pago).toBeNull()
    expect(result.saldo).toBe(62000)

    const items = db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, result.pedido.id)).all()
    expect(items).toHaveLength(2)
  })

  it('cliente nuevo se inserta y se vincula al pedido', () => {
    const result = crearPedidoDirecto(db, inputBase())
    const cliente = db.select().from(clientes).where(eq(clientes.id, result.pedido.clienteId)).get()
    expect(cliente?.nombre).toBe('María García')
    expect(cliente?.telefono).toBe('3001234567')
  })

  it('acepta cliente existente por id', () => {
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Existente' }).returning().get()
    const result = crearPedidoDirecto(db, inputBase({ cliente: { tipo: 'existente', id: cliente.id } }))
    expect(result.pedido.clienteId).toBe(cliente.id)
  })

  it('rechaza cliente existente con id inválido', () => {
    expect(() =>
      crearPedidoDirecto(db, inputBase({ cliente: { tipo: 'existente', id: 99999 } }))
    ).toThrow(/no existe/i)
  })

  it('override de total NO materializa descuento (modo B)', () => {
    const result = crearPedidoDirecto(db, inputBase({ precioTotalOverride: 50000 }))
    // Suma items = 62000, override = 50000.
    // precioTotal = 50000 (override), descuentoMonto = 0 (NO descuento), subtotal = 62000 (suma real).
    expect(result.pedido.precioTotal).toBe(50000)
    expect(result.pedido.descuentoMonto).toBe(0)
    expect(result.pedido.subtotal).toBe(62000)
    expect(result.factura.total).toBe(50000)
  })

  it('abono parcial deja factura pendiente con saldo correcto', () => {
    const result = crearPedidoDirecto(
      db,
      inputBase({
        abono: { monto: 30000, metodoPago: 'efectivo', fecha: '2026-04-15' }
      })
    )
    expect(result.pago?.monto).toBe(30000)
    expect(result.factura.estado).toBe('pendiente')
    expect(result.saldo).toBe(32000)
    const mov = db.select().from(movimientosFinancieros).where(eq(movimientosFinancieros.referenciaTipo, 'pago')).all()
    expect(mov).toHaveLength(1)
    expect(mov[0]!.monto).toBe(30000)
  })

  it('abono total marca factura como pagada', () => {
    const result = crearPedidoDirecto(
      db,
      inputBase({
        abono: { monto: 62000, metodoPago: 'transferencia', fecha: '2026-04-15' }
      })
    )
    expect(result.factura.estado).toBe('pagada')
    expect(result.saldo).toBe(0)
  })

  it('regalo (precio total = 0) marca factura como pagada sin movimiento', () => {
    const result = crearPedidoDirecto(
      db,
      inputBase({
        items: [{ tipoItem: 'otro', descripcion: 'Regalo', cantidad: 1, precioUnitario: 0 }],
        precioTotalOverride: 0
      })
    )
    expect(result.factura.estado).toBe('pagada')
    expect(result.saldo).toBe(0)
    const mov = db.select().from(movimientosFinancieros).all()
    expect(mov).toHaveLength(0)
  })

  it('caso retroactivo: estado entregado + fecha pasada + pago con fecha pasada', () => {
    const result = crearPedidoDirecto(
      db,
      inputBase({
        estadoInicial: 'entregado',
        fechaIngreso: '2025-03-01',
        fechaEntrega: '2025-03-15',
        abono: { monto: 62000, metodoPago: 'efectivo', fecha: '2025-03-15' }
      })
    )
    expect(result.pedido.estado).toBe('entregado')
    expect(result.factura.estado).toBe('pagada')
    // updatedAt debe reflejar la fecha histórica, NO la fecha actual.
    expect(result.pedido.updatedAt).toMatch(/^2025-03-01/)
    // Movimiento financiero registra la fecha del pago (histórica).
    const mov = db.select().from(movimientosFinancieros).get()
    expect(mov?.fecha).toBe('2025-03-15')
  })

  it('rechaza fecha de pago futura (posterior a hoy)', () => {
    // Construimos una fecha 30 días en el futuro relativa a hoy.
    const futura = new Date()
    futura.setDate(futura.getDate() + 30)
    const fechaFutura = `${futura.getFullYear()}-${String(futura.getMonth() + 1).padStart(2, '0')}-${String(futura.getDate()).padStart(2, '0')}`
    expect(() =>
      crearPedidoDirecto(
        db,
        inputBase({
          abono: { monto: 62000, metodoPago: 'efectivo', fecha: fechaFutura }
        })
      )
    ).toThrow(/posterior a hoy/i)
  })

  it('rechaza items array vacío', () => {
    expect(() => crearPedidoDirecto(db, inputBase({ items: [] }))).toThrow(/al menos un item/i)
  })

  it('rechaza item con cantidad <= 0', () => {
    expect(() =>
      crearPedidoDirecto(
        db,
        inputBase({
          items: [{ tipoItem: 'otro', descripcion: 'X', cantidad: 0, precioUnitario: 1000 }]
        })
      )
    ).toThrow(/cantidad/i)
  })

  it('rechaza estadoInicial=cancelado', () => {
    expect(() =>
      crearPedidoDirecto(db, inputBase({ estadoInicial: 'cancelado' as never }))
    ).toThrow(/cancelado/i)
  })

  it('rechaza abono mayor al total', () => {
    expect(() =>
      crearPedidoDirecto(
        db,
        inputBase({ abono: { monto: 999999, metodoPago: 'efectivo', fecha: '2026-04-15' } })
      )
    ).toThrow(/excede/i)
  })

  it('items sin costo dejan estadoRentabilidad="incompleta"', () => {
    const result = crearPedidoDirecto(
      db,
      inputBase({
        items: [
          { tipoItem: 'otro', descripcion: 'Trabajo libre', cantidad: 1, precioUnitario: 100000 }
        ]
      })
    )
    expect(result.pedido.estadoRentabilidad).toBe('incompleta')
    expect(result.pedido.costoEstimadoTotal).toBeNull()
  })

  it('items con costo calculan margen y estadoRentabilidad concretos', () => {
    const result = crearPedidoDirecto(db, inputBase())
    // costo total = 30000 + 6000 = 36000; precio = 62000; margen = 26000 (~42%)
    expect(result.pedido.costoEstimadoTotal).toBe(36000)
    expect(result.pedido.margenEstimado).toBe(26000)
    expect(result.pedido.estadoRentabilidad).not.toBe('incompleta')
  })

  it('rollback completo si algún insert falla', () => {
    // Forzamos error pasando cliente nuevo con cédula que ya existe.
    const cliente = db
      .insert(clientes)
      .values({ nombre: 'Existente', cedula: '12345678' })
      .returning()
      .get()
    expect(cliente.id).toBeGreaterThan(0)

    expect(() =>
      crearPedidoDirecto(
        db,
        inputBase({ cliente: { tipo: 'nuevo', data: { nombre: 'Otro', cedula: '12345678' } } as never })
      )
    ).toThrow()

    // Verifica que no quedó pedido huérfano
    const pedidosCount = db.select().from(pedidos).all().length
    expect(pedidosCount).toBe(0)
  })
})


