import { describe, it, expect } from 'vitest'
import { formatCOP, formatTelefono, iniciales, formatNumber } from './format'

describe('formatCOP', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCOP(1000)).toContain('1.000')
    expect(formatCOP(50400)).toContain('50.400')
    expect(formatCOP(1234567)).toContain('1.234.567')
  })

  it('formatea cero', () => {
    expect(formatCOP(0)).toContain('0')
  })

  it('formatea numeros grandes', () => {
    const result = formatCOP(2450000)
    expect(result).toContain('2.450.000')
  })
})

describe('formatNumber', () => {
  it('formatea con separador de miles colombiano', () => {
    expect(formatNumber(1234)).toBe('1.234')
    expect(formatNumber(1234567)).toBe('1.234.567')
  })
})

describe('formatTelefono', () => {
  it('formatea celular 10 digitos', () => {
    expect(formatTelefono('3012345678')).toBe('301 234 5678')
  })

  it('formatea fijo 7 digitos', () => {
    expect(formatTelefono('6789012')).toBe('678 9012')
  })

  it('retorna vacio para null', () => {
    expect(formatTelefono(null)).toBe('')
    expect(formatTelefono(undefined)).toBe('')
  })

  it('retorna original si no coincide patron', () => {
    expect(formatTelefono('12345')).toBe('12345')
  })
})

describe('iniciales', () => {
  it('toma las primeras 2 iniciales', () => {
    expect(iniciales('Ana Restrepo')).toBe('AR')
    expect(iniciales('Carlos Andres Mendez')).toBe('CA')
  })

  it('una sola palabra', () => {
    expect(iniciales('Alberto')).toBe('A')
  })

  it('maneja espacios extras', () => {
    expect(iniciales(' Ana  Restrepo ')).toBe('AR')
  })
})
