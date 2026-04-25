import { describe, expect, it } from 'vitest'
import { validarMonto } from './validar-monto'

describe('validarMonto', () => {
  it('acepta números finitos no negativos', () => {
    expect(validarMonto(0)).toBe(0)
    expect(validarMonto(50000)).toBe(50000)
    expect(validarMonto(0.5)).toBe(0.5)
  })

  it('rechaza Infinity y -Infinity', () => {
    expect(() => validarMonto(Number.POSITIVE_INFINITY)).toThrow(/no es un número finito/i)
    expect(() => validarMonto(Number.NEGATIVE_INFINITY)).toThrow(/no es un número finito/i)
  })

  it('rechaza NaN', () => {
    expect(() => validarMonto(NaN)).toThrow(/no es un número finito/i)
  })

  it('rechaza strings, null, undefined, objetos', () => {
    expect(() => validarMonto('50000')).toThrow(/no es un número finito/i)
    expect(() => validarMonto(null)).toThrow(/no es un número finito/i)
    expect(() => validarMonto(undefined)).toThrow(/no es un número finito/i)
    expect(() => validarMonto({})).toThrow(/no es un número finito/i)
    expect(() => validarMonto([])).toThrow(/no es un número finito/i)
  })

  it('rechaza negativos por defecto (min implícito = 0)', () => {
    expect(() => validarMonto(-1)).toThrow(/no puede ser menor a 0/i)
    expect(() => validarMonto(-0.01)).toThrow(/no puede ser menor a 0/i)
  })

  it('respeta clamp con min y max explícitos', () => {
    expect(() => validarMonto(50, { min: 100 })).toThrow(/menor a 100/i)
    expect(() => validarMonto(1500, { max: 1000 })).toThrow(/excede el máximo permitido/i)
    expect(validarMonto(500, { min: 100, max: 1000 })).toBe(500)
  })

  it('usa el campo en el mensaje de error', () => {
    expect(() => validarMonto(NaN, { campo: 'Precio por metro' })).toThrow(/Precio por metro/)
    expect(() => validarMonto(-50, { campo: 'Abono' })).toThrow(/Abono no puede/)
  })

  it('permite negativos cuando min es explícitamente menor', () => {
    // No es un caso normal de plata, pero puede aplicar a "ajustes" futuros.
    expect(validarMonto(-100, { min: -1000 })).toBe(-100)
  })
})
