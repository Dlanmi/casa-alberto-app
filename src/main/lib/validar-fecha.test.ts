import { describe, expect, it } from 'vitest'
import { validarFechaISO } from './validar-fecha'

describe('validarFechaISO — YYYY-MM-DD', () => {
  it('acepta fechas válidas', () => {
    expect(validarFechaISO('2026-04-25')).toBe('2026-04-25')
    expect(validarFechaISO('2026-01-01')).toBe('2026-01-01')
    expect(validarFechaISO('2024-02-29')).toBe('2024-02-29') // bisiesto
  })

  it('rechaza string vacío y tipos no-string', () => {
    expect(() => validarFechaISO('')).toThrow(/formato/i)
    expect(() => validarFechaISO(null)).toThrow(/string/i)
    expect(() => validarFechaISO(undefined)).toThrow(/string/i)
    expect(() => validarFechaISO(20260425)).toThrow(/string/i)
  })

  it('rechaza formato suelto', () => {
    expect(() => validarFechaISO('2026-4-25')).toThrow(/formato/i)
    expect(() => validarFechaISO('25/04/2026')).toThrow(/formato/i)
    expect(() => validarFechaISO('2026-04-25T00:00:00')).toThrow(/formato/i)
    expect(() => validarFechaISO('hoy')).toThrow(/formato/i)
  })

  it('rechaza fechas imposibles aunque parezcan ISO', () => {
    expect(() => validarFechaISO('2026-13-50')).toThrow(/v.lida/i)
    expect(() => validarFechaISO('2026-02-30')).toThrow(/v.lida/i) // feb no tiene 30
    expect(() => validarFechaISO('2025-02-29')).toThrow(/v.lida/i) // 2025 no es bisiesto
    expect(() => validarFechaISO('2026-00-15')).toThrow(/v.lida/i)
    expect(() => validarFechaISO('2026-04-32')).toThrow(/v.lida/i)
    expect(() => validarFechaISO('2026-04-00')).toThrow(/v.lida/i)
  })

  it('usa el campo en el mensaje', () => {
    expect(() => validarFechaISO('2026-13-50', 'YYYY-MM-DD', 'fechaEntrega')).toThrow(
      /fechaEntrega/
    )
  })
})

describe('validarFechaISO — YYYY-MM', () => {
  it('acepta meses válidos', () => {
    expect(validarFechaISO('2026-04', 'YYYY-MM')).toBe('2026-04')
    expect(validarFechaISO('2026-01', 'YYYY-MM')).toBe('2026-01')
    expect(validarFechaISO('2026-12', 'YYYY-MM')).toBe('2026-12')
  })

  it('rechaza mes 00 y mes 13', () => {
    expect(() => validarFechaISO('2026-00', 'YYYY-MM')).toThrow(/mes v.lido/i)
    expect(() => validarFechaISO('2026-13', 'YYYY-MM')).toThrow(/mes v.lido/i)
  })

  it('rechaza año fuera del rango razonable (2000-2100)', () => {
    expect(() => validarFechaISO('1999-04', 'YYYY-MM')).toThrow(/a.o/i)
    expect(() => validarFechaISO('2101-04', 'YYYY-MM')).toThrow(/a.o/i)
  })

  it('rechaza formato YYYY-MM-DD cuando se pide YYYY-MM', () => {
    expect(() => validarFechaISO('2026-04-25', 'YYYY-MM')).toThrow(/formato/i)
  })
})
