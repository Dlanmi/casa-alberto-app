import { describe, it, expect } from 'vitest'
import {
  formatCOP,
  formatTelefono,
  iniciales,
  formatNumber,
  formatFechaLarga,
  formatFechaCorta
} from './format'

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

  it('defensivo: NaN → $0 en vez de "$NaN"', () => {
    expect(formatCOP(NaN)).toContain('0')
    expect(formatCOP(NaN)).not.toContain('NaN')
  })

  it('defensivo: Infinity → $0', () => {
    expect(formatCOP(Infinity)).toContain('0')
    expect(formatCOP(-Infinity)).toContain('0')
    expect(formatCOP(Infinity)).not.toContain('∞')
  })

  it('defensivo: null/undefined → $0', () => {
    expect(formatCOP(null)).toContain('0')
    expect(formatCOP(undefined)).toContain('0')
  })
})

describe('formatFechaLarga/Corta — defensas', () => {
  it('fecha válida se formatea normalmente', () => {
    expect(formatFechaLarga('2026-04-16')).toMatch(/abril/i)
    expect(formatFechaCorta('2026-04-16')).toMatch(/abr/i)
  })

  it('null/undefined → "—"', () => {
    expect(formatFechaLarga(null)).toBe('—')
    expect(formatFechaLarga(undefined)).toBe('—')
    expect(formatFechaCorta('')).toBe('—')
  })

  it('fecha inválida → "—" en vez de "Invalid Date"', () => {
    expect(formatFechaLarga('no-es-fecha')).toBe('—')
    expect(formatFechaLarga('2026-13-45')).toBe('—')
    expect(formatFechaCorta('aaaa-bb-cc')).toBe('—')
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

  it('defensivo: string vacío o solo espacios → "?"', () => {
    expect(iniciales('')).toBe('?')
    expect(iniciales('   ')).toBe('?')
    expect(iniciales(null)).toBe('?')
    expect(iniciales(undefined)).toBe('?')
  })
})
