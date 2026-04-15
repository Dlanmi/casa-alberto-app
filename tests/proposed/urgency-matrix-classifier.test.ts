/**
 * Proposed tests — added by tester/QA agent.
 *
 * Tests for the urgency classification logic used by the dashboard's
 * 2x2 matrix (urgency-matrix.tsx). The logic is currently inline in the
 * component — this test re-implements it as a shadow helper and documents
 * the expected behavior, so that when the biz-rules agent extracts the
 * function (or modifies it), this test will pin down the contract.
 *
 * If this becomes a regression, move it next to the real helper.
 */
import { describe, it, expect } from 'vitest'

type EstadoPedido =
  | 'cotizado'
  | 'confirmado'
  | 'en_proceso'
  | 'listo'
  | 'entregado'
  | 'sin_reclamar'
  | 'cancelado'

type PedidoLite = {
  id: number
  estado: EstadoPedido
  fechaEntrega: string | null
}

type Clasificacion = {
  urgenteSinAbono: number
  urgenteConAbono: number
  normalSinAbono: number
  normalConAbono: number
}

/**
 * Shadow implementation — must match the logic inside
 * `features/dashboard/urgency-matrix.tsx` (lines 22–53 as of main).
 *
 * Rules:
 *  - Solo pedidos en estados activos (confirmado, en_proceso, listo) cuentan.
 *  - "Urgente" = fecha de entrega dentro de los próximos 2 días (inclusive).
 *  - Sin fechaEntrega → siempre Normal (no urgente).
 *  - Sin abono = pedido está en el Set sinAbonoPedidoIds.
 */
export function clasificar(
  pedidos: PedidoLite[],
  sinAbonoPedidoIds: Set<number>,
  hoyISO: string
): Clasificacion {
  const hoy = new Date(hoyISO + 'T00:00:00')
  hoy.setHours(0, 0, 0, 0)

  let urgenteSinAbono = 0
  let urgenteConAbono = 0
  let normalSinAbono = 0
  let normalConAbono = 0

  const activos = pedidos.filter((p) => ['confirmado', 'en_proceso', 'listo'].includes(p.estado))

  for (const p of activos) {
    const sinPago = sinAbonoPedidoIds.has(p.id)
    if (!p.fechaEntrega) {
      if (sinPago) normalSinAbono++
      else normalConAbono++
      continue
    }
    const entrega = new Date(p.fechaEntrega + 'T12:00:00')
    entrega.setHours(0, 0, 0, 0)
    const dias = Math.round((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    const esUrgente = dias <= 2

    if (esUrgente && sinPago) urgenteSinAbono++
    else if (esUrgente) urgenteConAbono++
    else if (sinPago) normalSinAbono++
    else normalConAbono++
  }

  return { urgenteSinAbono, urgenteConAbono, normalSinAbono, normalConAbono }
}

describe('[proposed] clasificación de urgencia del dashboard', () => {
  const hoy = '2026-04-15'

  it('ignora pedidos en estados terminales (entregado, cancelado, cotizado, sin_reclamar)', () => {
    const pedidos: PedidoLite[] = [
      { id: 1, estado: 'entregado', fechaEntrega: hoy },
      { id: 2, estado: 'cancelado', fechaEntrega: hoy },
      { id: 3, estado: 'cotizado', fechaEntrega: hoy },
      { id: 4, estado: 'sin_reclamar', fechaEntrega: hoy }
    ]
    const r = clasificar(pedidos, new Set(), hoy)
    expect(r).toEqual({
      urgenteSinAbono: 0,
      urgenteConAbono: 0,
      normalSinAbono: 0,
      normalConAbono: 0
    })
  })

  it('pedido con fecha hoy y sin pago → urgenteSinAbono', () => {
    const pedidos: PedidoLite[] = [{ id: 1, estado: 'en_proceso', fechaEntrega: hoy }]
    const r = clasificar(pedidos, new Set([1]), hoy)
    expect(r.urgenteSinAbono).toBe(1)
    expect(r.urgenteConAbono).toBe(0)
  })

  it('pedido con fecha +2 días es aún urgente (limite inclusivo)', () => {
    const pedidos: PedidoLite[] = [
      { id: 1, estado: 'confirmado', fechaEntrega: '2026-04-17' } // hoy + 2
    ]
    const r = clasificar(pedidos, new Set(), hoy)
    expect(r.urgenteConAbono).toBe(1)
    expect(r.normalConAbono).toBe(0)
  })

  it('pedido con fecha +3 días es normal', () => {
    const pedidos: PedidoLite[] = [
      { id: 1, estado: 'confirmado', fechaEntrega: '2026-04-18' } // hoy + 3
    ]
    const r = clasificar(pedidos, new Set(), hoy)
    expect(r.urgenteConAbono).toBe(0)
    expect(r.normalConAbono).toBe(1)
  })

  it('pedido sin fechaEntrega → siempre normal', () => {
    const pedidos: PedidoLite[] = [
      { id: 1, estado: 'listo', fechaEntrega: null },
      { id: 2, estado: 'en_proceso', fechaEntrega: null }
    ]
    const r = clasificar(pedidos, new Set([1]), hoy)
    expect(r.normalSinAbono).toBe(1)
    expect(r.normalConAbono).toBe(1)
    expect(r.urgenteSinAbono).toBe(0)
  })

  it('pedido atrasado (fecha -5 días) todavía cuenta como urgente', () => {
    const pedidos: PedidoLite[] = [{ id: 1, estado: 'en_proceso', fechaEntrega: '2026-04-10' }]
    const r = clasificar(pedidos, new Set(), hoy)
    expect(r.urgenteConAbono).toBe(1)
  })

  it('mezcla de pedidos clasifica correctamente en los 4 cuadrantes', () => {
    const pedidos: PedidoLite[] = [
      { id: 1, estado: 'en_proceso', fechaEntrega: '2026-04-15' }, // urgente, sin pago
      { id: 2, estado: 'confirmado', fechaEntrega: '2026-04-16' }, // urgente, con pago
      { id: 3, estado: 'listo', fechaEntrega: '2026-04-25' }, // normal, sin pago
      { id: 4, estado: 'en_proceso', fechaEntrega: null }, // normal, con pago
      { id: 5, estado: 'cancelado', fechaEntrega: '2026-04-15' } // ignorado
    ]
    const r = clasificar(pedidos, new Set([1, 3]), hoy)
    expect(r).toEqual({
      urgenteSinAbono: 1,
      urgenteConAbono: 1,
      normalSinAbono: 1,
      normalConAbono: 1
    })
  })
})
