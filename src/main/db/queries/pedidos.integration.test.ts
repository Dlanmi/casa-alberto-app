// Integration test for the sin_reclamar reclassification flow surfaced by the
// business-correctness audit. Verifies that pedidosSinReclamar:
//   1. Automatically moves `listo` → `sin_reclamar` after N días (default 15),
//      via reclasificarPedidos.
//   2. Devuelve todos los pedidos ya reclasificados.
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { clientes, pedidos } from '../schema'
import { pedidosSinReclamar, reclasificarPedidos } from './pedidos'

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
