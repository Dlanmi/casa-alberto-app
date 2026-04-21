import { describe, expect, it } from 'vitest'
import { clasificarPedidosPorUrgencia } from './pedidos'

describe('clasificarPedidosPorUrgencia', () => {
  const hoy = new Date('2026-04-15T09:30:00')

  it('ignora pedidos en estados no activos', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [
        { id: 1, estado: 'entregado', fechaEntrega: '2026-04-15' },
        { id: 2, estado: 'cancelado', fechaEntrega: '2026-04-15' },
        { id: 3, estado: 'cotizado', fechaEntrega: '2026-04-15' },
        { id: 4, estado: 'sin_reclamar', fechaEntrega: '2026-04-15' }
      ],
      new Set(),
      2,
      hoy
    )

    expect(resultado).toEqual({
      urgenteSinAbono: 0,
      urgenteConAbono: 0,
      normalSinAbono: 0,
      normalConAbono: 0,
      atrasados: 0,
      total: 0,
      diasUrgencia: 2
    })
  })

  it('trata una entrega hoy sin abono como urgente sin abono', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [{ id: 1, estado: 'en_proceso', fechaEntrega: '2026-04-15' }],
      new Set([1]),
      2,
      hoy
    )

    expect(resultado.urgenteSinAbono).toBe(1)
    expect(resultado.urgenteConAbono).toBe(0)
  })

  it('incluye el límite de +2 días como urgente', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [{ id: 1, estado: 'confirmado', fechaEntrega: '2026-04-17' }],
      new Set(),
      2,
      hoy
    )

    expect(resultado.urgenteConAbono).toBe(1)
    expect(resultado.normalConAbono).toBe(0)
  })

  it('clasifica +3 días como normal', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [{ id: 1, estado: 'confirmado', fechaEntrega: '2026-04-18' }],
      new Set(),
      2,
      hoy
    )

    expect(resultado.urgenteConAbono).toBe(0)
    expect(resultado.normalConAbono).toBe(1)
  })

  it('manda pedidos sin fechaEntrega al cuadrante normal', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [
        { id: 1, estado: 'listo', fechaEntrega: null },
        { id: 2, estado: 'en_proceso', fechaEntrega: null }
      ],
      new Set([1]),
      2,
      hoy
    )

    expect(resultado.normalSinAbono).toBe(1)
    expect(resultado.normalConAbono).toBe(1)
    expect(resultado.urgenteSinAbono).toBe(0)
  })

  it('cuenta pedidos atrasados como urgentes y suma el contador de atrasados', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [{ id: 1, estado: 'en_proceso', fechaEntrega: '2026-04-10' }],
      new Set(),
      2,
      hoy
    )

    expect(resultado.urgenteConAbono).toBe(1)
    expect(resultado.atrasados).toBe(1)
  })

  it('clasifica correctamente una mezcla de pedidos en los cuatro cuadrantes', () => {
    const resultado = clasificarPedidosPorUrgencia(
      [
        { id: 1, estado: 'en_proceso', fechaEntrega: '2026-04-15' },
        { id: 2, estado: 'confirmado', fechaEntrega: '2026-04-16' },
        { id: 3, estado: 'listo', fechaEntrega: '2026-04-25' },
        { id: 4, estado: 'en_proceso', fechaEntrega: null },
        { id: 5, estado: 'cancelado', fechaEntrega: '2026-04-15' }
      ],
      new Set([1, 3]),
      2,
      hoy
    )

    expect(resultado).toEqual({
      urgenteSinAbono: 1,
      urgenteConAbono: 1,
      normalSinAbono: 1,
      normalConAbono: 1,
      atrasados: 0,
      total: 4,
      diasUrgencia: 2
    })
  })
})
