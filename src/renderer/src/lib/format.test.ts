import { describe, it, expect } from 'vitest'
import {
  diaSemana,
  formatCOP,
  formatCOPCorto,
  formatTelefono,
  iniciales,
  formatNumber,
  formatFechaLarga,
  formatFechaCorta,
  mesCorto
} from './format'

describe('diaSemana', () => {
  it('retorna 0=domingo, 1=lunes, ..., 6=sabado', () => {
    // 2026-04-19 es domingo (verificado vs Intl)
    expect(diaSemana(new Date(2026, 3, 19))).toBe(0)
    expect(diaSemana(new Date(2026, 3, 20))).toBe(1) // lunes
    expect(diaSemana(new Date(2026, 3, 25))).toBe(6) // sábado
  })

  it('normaliza la hora antes de calcular el día', () => {
    // 23:55 local del 24-abr no debe saltar al día siguiente — getDay()
    // directo es defensivo en CO, pero el helper garantiza el patrón.
    const tarde = new Date(2026, 3, 24, 23, 55)
    expect(diaSemana(tarde)).toBe(5) // viernes
  })

  it('default usa la fecha actual sin argumentos', () => {
    expect(typeof diaSemana()).toBe('number')
    expect(diaSemana()).toBeGreaterThanOrEqual(0)
    expect(diaSemana()).toBeLessThanOrEqual(6)
  })
})

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

describe('formatCOPCorto', () => {
  it('valores < 1k usan formato directo con $', () => {
    expect(formatCOPCorto(0)).toBe('$0')
    expect(formatCOPCorto(500)).toBe('$500')
    expect(formatCOPCorto(999)).toBe('$999')
  })

  it('miles abrevian con sufijo k', () => {
    expect(formatCOPCorto(1000)).toBe('$1k')
    expect(formatCOPCorto(120000)).toBe('$120k')
    expect(formatCOPCorto(1500)).toBe('$1,5k')
  })

  it('millones con sufijo M', () => {
    expect(formatCOPCorto(1000000)).toBe('$1M')
    expect(formatCOPCorto(2400000)).toBe('$2,4M')
    expect(formatCOPCorto(15500000)).toBe('$15,5M')
  })

  it('billones con sufijo B', () => {
    expect(formatCOPCorto(1_000_000_000)).toBe('$1B')
    expect(formatCOPCorto(2_500_000_000)).toBe('$2,5B')
  })

  it('valores negativos preservan el signo', () => {
    expect(formatCOPCorto(-50000)).toBe('-$50k')
    expect(formatCOPCorto(-1500000)).toBe('-$1,5M')
  })

  it('defensivo: null/undefined/NaN → $0', () => {
    expect(formatCOPCorto(null)).toBe('$0')
    expect(formatCOPCorto(undefined)).toBe('$0')
    expect(formatCOPCorto(NaN)).toBe('$0')
    expect(formatCOPCorto(Infinity)).toBe('$0')
  })
})

describe('mesCorto', () => {
  it('devuelve la abreviatura en español', () => {
    expect(mesCorto('2026-02')).toBe('Feb')
    expect(mesCorto('2026-03-15')).toBe('Mar')
    expect(mesCorto('2026-12')).toBe('Dic')
  })

  it('enero incluye el año automáticamente', () => {
    expect(mesCorto('2026-01')).toBe('Ene 26')
    expect(mesCorto('2027-01')).toBe('Ene 27')
  })

  it('forzar incluirAnio agrega año en cualquier mes', () => {
    expect(mesCorto('2026-06', true)).toBe('Jun 26')
    expect(mesCorto('2026-12', true)).toBe('Dic 26')
  })

  it('input inválido devuelve placeholder "—" y loguea warning', () => {
    expect(mesCorto('algo')).toBe('—')
    expect(mesCorto('2026-13')).toBe('—')
    expect(mesCorto('2026-00')).toBe('—')
    // Mes sin pad también es inválido — antes devolvía '2026-1' literal.
    expect(mesCorto('2026-1')).toBe('—')
  })
})
