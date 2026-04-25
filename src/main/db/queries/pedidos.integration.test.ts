// Integration test for the sin_reclamar reclassification flow surfaced by the
// business-correctness audit. Verifies that pedidosSinReclamar:
//   1. Automatically moves `listo` → `sin_reclamar` after N días (default 15),
//      via reclasificarPedidos.
//   2. Devuelve todos los pedidos ya reclasificados.
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, pedidos, facturas, pagos } from '../schema'
import {
  cambiarEstadoPedido,
  obtenerSaldosPorPedido,
  pedidosSinAbonoConSaldo,
  pedidosSinReclamar,
  reclasificarPedidos
} from './pedidos'

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
