import { describe, expect, it } from 'vitest'
import { parseConfigNumber } from './configuracion'

describe('parseConfigNumber', () => {
  it('null/undefined → fallback', () => {
    expect(parseConfigNumber(null)).toBe(0)
    expect(parseConfigNumber(null, 100)).toBe(100)
  })

  it('parsea valores numéricos válidos', () => {
    expect(parseConfigNumber('42')).toBe(42)
    expect(parseConfigNumber('0')).toBe(0)
    expect(parseConfigNumber('3.14')).toBe(3.14)
    expect(parseConfigNumber('-5')).toBe(-5)
  })

  it('strings no numéricos → fallback', () => {
    expect(parseConfigNumber('abc')).toBe(0)
    expect(parseConfigNumber('', 50)).toBe(50)
    expect(parseConfigNumber('NaN', 100)).toBe(100)
  })

  it('Infinity y -Infinity → fallback (regresión: antes propagaba)', () => {
    // Si alguien hacía `setConfig("clave", "1e999")` por bypass o script,
    // parseFloat lo convertía a Infinity. Eso entraba a cálculos del
    // cotizador y mostraba "$Infinity" en la UI. Ahora retorna fallback.
    expect(parseConfigNumber('1e999')).toBe(0)
    expect(parseConfigNumber('-1e999', 50)).toBe(50)
    expect(parseConfigNumber('Infinity')).toBe(0)
    expect(parseConfigNumber('-Infinity')).toBe(0)
  })

  it('parseFloat extrae prefijo numérico (comportamiento JS)', () => {
    // parseFloat('42abc') = 42. Es comportamiento JS estándar; lo
    // documentamos por claridad. No es bug — los datos en DB siempre
    // pasan por setConfig que ya valida.
    expect(parseConfigNumber('42abc')).toBe(42)
    expect(parseConfigNumber('   8000   ')).toBe(8000)
  })
})
