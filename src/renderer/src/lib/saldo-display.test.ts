import { describe, expect, it } from 'vitest'
import { saldoStatus } from './saldo-display'

describe('saldoStatus', () => {
  it('saldo positivo → warning, "Saldo pendiente"', () => {
    const s = saldoStatus(50000)
    expect(s.tone).toBe('warning')
    expect(s.title).toMatch(/saldo pendiente/i)
    expect(s.label).toBe('Saldo pendiente')
    expect(s.displayValue).toBe(50000)
  })

  it('saldo cero → success, "Pagado"', () => {
    const s = saldoStatus(0)
    expect(s.tone).toBe('success')
    expect(s.title).toMatch(/al d.a/i)
    expect(s.label).toBe('Pagado')
    expect(s.displayValue).toBe(0)
  })

  it('saldo negativo → info, "Crédito del cliente" con valor positivo', () => {
    const s = saldoStatus(-20000)
    expect(s.tone).toBe('info')
    expect(s.title).toMatch(/cr.dito a favor/i)
    expect(s.label).toBe('Crédito del cliente')
    // displayValue es siempre positivo: el "negativo" lo transmite el tone/label,
    // no se muestra "-$20.000" al usuario.
    expect(s.displayValue).toBe(20000)
  })

  it('saldo NaN/Infinity → trata como cero (defensivo)', () => {
    expect(saldoStatus(NaN).tone).toBe('success')
    expect(saldoStatus(Number.POSITIVE_INFINITY).tone).toBe('success')
    expect(saldoStatus(Number.NEGATIVE_INFINITY).tone).toBe('success')
  })

  it('mensaje contiene contexto operativo, no jerga técnica', () => {
    expect(saldoStatus(100).message).toMatch(/abono/i)
    expect(saldoStatus(-100).message).toMatch(/cliente|reintegrar|aplicar/i)
  })
})
