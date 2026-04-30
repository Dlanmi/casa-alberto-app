import { describe, expect, it } from 'vitest'
import { validarId } from './validar-id'

describe('validarId', () => {
  it('acepta enteros positivos', () => {
    expect(validarId(1)).toBe(1)
    expect(validarId(42)).toBe(42)
    expect(validarId(999999)).toBe(999999)
  })

  it('rechaza no-enteros (decimales)', () => {
    expect(() => validarId(3.14)).toThrow(/entero v.lido/i)
    expect(() => validarId(0.5)).toThrow(/entero v.lido/i)
    expect(() => validarId(1.0001)).toThrow(/entero v.lido/i)
  })

  it('rechaza NaN, Infinity y -Infinity', () => {
    expect(() => validarId(NaN)).toThrow(/entero v.lido/i)
    expect(() => validarId(Number.POSITIVE_INFINITY)).toThrow(/entero v.lido/i)
    expect(() => validarId(Number.NEGATIVE_INFINITY)).toThrow(/entero v.lido/i)
  })

  it('rechaza tipos no numéricos', () => {
    expect(() => validarId('1')).toThrow(/entero v.lido/i)
    expect(() => validarId(null)).toThrow(/entero v.lido/i)
    expect(() => validarId(undefined)).toThrow(/entero v.lido/i)
    expect(() => validarId({})).toThrow(/entero v.lido/i)
    expect(() => validarId([])).toThrow(/entero v.lido/i)
    expect(() => validarId(true)).toThrow(/entero v.lido/i)
  })

  it('rechaza 0 y negativos (los IDs SQLite arrancan en 1)', () => {
    expect(() => validarId(0)).toThrow(/mayor a 0/i)
    expect(() => validarId(-1)).toThrow(/mayor a 0/i)
    expect(() => validarId(-999)).toThrow(/mayor a 0/i)
  })

  it('usa el nombre del campo en el mensaje', () => {
    expect(() => validarId(NaN, 'pedidoId')).toThrow(/pedidoId/)
    expect(() => validarId(0, 'clienteId')).toThrow(/clienteId/)
  })
})
