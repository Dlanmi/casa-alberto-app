import { describe, expect, it } from 'vitest'
import { validarEnum } from './validar-enum'

describe('validarEnum', () => {
  const ESTADOS = ['cotizado', 'confirmado', 'en_proceso', 'listo', 'entregado'] as const

  it('acepta valores del whitelist', () => {
    expect(validarEnum('cotizado', ESTADOS)).toBe('cotizado')
    expect(validarEnum('listo', ESTADOS)).toBe('listo')
    expect(validarEnum('entregado', ESTADOS)).toBe('entregado')
  })

  it('rechaza valores fuera del whitelist', () => {
    expect(() => validarEnum('xyz', ESTADOS)).toThrow(/debe ser uno de/i)
    expect(() => validarEnum('Listo', ESTADOS)).toThrow(/debe ser uno de/i) // case-sensitive
    expect(() => validarEnum('en proceso', ESTADOS)).toThrow(/debe ser uno de/i)
  })

  it('rechaza tipos no string', () => {
    expect(() => validarEnum(null, ESTADOS)).toThrow(/string/i)
    expect(() => validarEnum(undefined, ESTADOS)).toThrow(/string/i)
    expect(() => validarEnum(1, ESTADOS)).toThrow(/string/i)
    expect(() => validarEnum({}, ESTADOS)).toThrow(/string/i)
    expect(() => validarEnum(['cotizado'], ESTADOS)).toThrow(/string/i)
  })

  it('lista los valores permitidos en el mensaje de error', () => {
    expect(() => validarEnum('xyz', ['a', 'b'] as const)).toThrow(/a, b/)
  })

  it('usa el nombre del campo en el mensaje', () => {
    expect(() => validarEnum('xyz', ESTADOS, 'estado')).toThrow(/estado/)
    expect(() => validarEnum(null, ESTADOS, 'metodoPago')).toThrow(/metodoPago/)
  })
})
