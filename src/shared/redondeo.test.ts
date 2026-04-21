// Fase 2 · UX — tests del redondeo al múltiplo de $1.000. El caso base del
// papá (85.564 → 86.000) más bordes: valores ya redondos, diferencias
// mínimas, inputs defensivos (negativos, NaN) que podrían venir de un parser
// permisivo río arriba.
import { describe, expect, it } from 'vitest'
import { redondearPrecioFinal } from './redondeo'

describe('redondearPrecioFinal', () => {
  it('caso base: $85.564 → $86.000', () => {
    expect(redondearPrecioFinal(85564)).toBe(86000)
  })

  it('valor ya múltiplo de 1.000 no cambia', () => {
    expect(redondearPrecioFinal(86000)).toBe(86000)
    expect(redondearPrecioFinal(20000)).toBe(20000)
    expect(redondearPrecioFinal(55000)).toBe(55000)
  })

  it('sube aunque la diferencia sea +$1', () => {
    expect(redondearPrecioFinal(85001)).toBe(86000)
  })

  it('sube al borde superior ($85.999 → $86.000)', () => {
    expect(redondearPrecioFinal(85999)).toBe(86000)
  })

  it('valor pequeño sube al primer múltiplo', () => {
    expect(redondearPrecioFinal(500)).toBe(1000)
    expect(redondearPrecioFinal(1)).toBe(1000)
  })

  it('0 se queda en 0 (no forzamos $1.000 cuando no hay cotización)', () => {
    expect(redondearPrecioFinal(0)).toBe(0)
  })

  it('negativos defensivos → 0', () => {
    expect(redondearPrecioFinal(-100)).toBe(0)
    expect(redondearPrecioFinal(-0.01)).toBe(0)
  })

  it('NaN e Infinity → 0', () => {
    expect(redondearPrecioFinal(Number.NaN)).toBe(0)
    expect(redondearPrecioFinal(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
