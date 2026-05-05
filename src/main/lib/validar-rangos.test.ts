import { describe, expect, it } from 'vitest'
import {
  validarHorarioOrdenado,
  validarPorcentaje,
  validarRangoFechas
} from './validar-rangos'

describe('validarRangoFechas', () => {
  it('acepta hasta >= desde', () => {
    expect(() => validarRangoFechas('2026-04-01', '2026-04-15')).not.toThrow()
    expect(() => validarRangoFechas('2026-04-01', '2026-04-01')).not.toThrow()
  })

  it('rechaza hasta < desde', () => {
    expect(() => validarRangoFechas('2026-04-15', '2026-04-01')).toThrow(/anterior/i)
  })

  it('no falla si alguno es vacío o no string', () => {
    expect(() => validarRangoFechas('', '2026-04-01')).not.toThrow()
    expect(() => validarRangoFechas('2026-04-01', '')).not.toThrow()
    expect(() => validarRangoFechas(null, '2026-04-01')).not.toThrow()
  })

  it('valida formato individual', () => {
    expect(() => validarRangoFechas('algo', '2026-04-01')).toThrow()
    expect(() => validarRangoFechas('2026-04-01', '2026-13-99')).toThrow()
  })

  it('mensaje incluye nombres de campos', () => {
    expect(() =>
      validarRangoFechas('2026-04-15', '2026-04-01', {
        campoDesde: 'fecha de ingreso',
        campoHasta: 'fecha de entrega'
      })
    ).toThrow(/entrega.*ingreso/i)
  })
})

describe('validarPorcentaje', () => {
  it('acepta valores en rango', () => {
    expect(validarPorcentaje(0)).toBe(0)
    expect(validarPorcentaje(50)).toBe(50)
    expect(validarPorcentaje(100)).toBe(100)
  })

  it('rechaza fuera de rango', () => {
    expect(() => validarPorcentaje(-1)).toThrow(/menor/i)
    expect(() => validarPorcentaje(101)).toThrow(/mayor/i)
  })

  it('rechaza NaN/Infinity', () => {
    expect(() => validarPorcentaje(NaN)).toThrow(/válido/i)
    expect(() => validarPorcentaje(Infinity)).toThrow(/válido/i)
  })

  it('rechaza no-número', () => {
    expect(() => validarPorcentaje('50' as unknown as number)).toThrow(/válido/i)
  })

  it('respeta min/max custom', () => {
    expect(() => validarPorcentaje(15, { min: 5, max: 10 })).toThrow(/mayor/i)
    expect(validarPorcentaje(7, { min: 5, max: 10 })).toBe(7)
  })
})

describe('validarHorarioOrdenado', () => {
  it('acepta inicio < fin', () => {
    expect(() => validarHorarioOrdenado('09:00', '11:00')).not.toThrow()
    expect(() => validarHorarioOrdenado('09:00:00', '09:30:00')).not.toThrow()
  })

  it('rechaza inicio == fin', () => {
    expect(() => validarHorarioOrdenado('09:00', '09:00')).toThrow(/posterior/i)
  })

  it('rechaza inicio > fin', () => {
    expect(() => validarHorarioOrdenado('11:00', '09:00')).toThrow(/posterior/i)
  })

  it('rechaza formato inválido', () => {
    expect(() => validarHorarioOrdenado('25:00', '11:00')).toThrow(/formato/i)
    expect(() => validarHorarioOrdenado('9:00', '11:00')).toThrow(/formato/i) // requiere 2 dígitos
    expect(() => validarHorarioOrdenado('09:60', '11:00')).toThrow(/formato/i)
  })

  it('rechaza no-string', () => {
    expect(() => validarHorarioOrdenado(900 as unknown, '11:00')).toThrow(/texto/i)
  })
})
