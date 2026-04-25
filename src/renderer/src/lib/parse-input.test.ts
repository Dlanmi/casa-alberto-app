// Tests para el parser numérico defensivo usado por los
// inputs del wizard del cotizador y modales con montos. El objetivo es que
// `Number('abc') || 0` deje de esconder typos, que los rangos (medidas,
// precios) se respeten, y que MEDIDAS DECIMALES (43.32 cm) funcionen: el
// primer intento con `parseInt` estripaba decimales y rompía el flujo del
// papá al cotizar obras con medida fina.
import { describe, expect, it } from 'vitest'
import { parseMoneyInput, parseNumberInput } from './parse-input'

describe('parseNumberInput', () => {
  it('devuelve 0 para string vacío', () => {
    expect(parseNumberInput('')).toBe(0)
  })

  it('devuelve 0 para texto no numérico', () => {
    expect(parseNumberInput('abc')).toBe(0)
    expect(parseNumberInput('  ')).toBe(0)
  })

  it('parsea enteros válidos', () => {
    expect(parseNumberInput('42')).toBe(42)
    expect(parseNumberInput('0')).toBe(0)
    expect(parseNumberInput('500')).toBe(500)
  })

  it('acepta decimales', () => {
    expect(parseNumberInput('43.32')).toBe(43.32)
    expect(parseNumberInput('0.5')).toBe(0.5)
    expect(parseNumberInput('500.9')).toBe(500.9)
  })

  it('normaliza coma decimal (formato es-CO)', () => {
    // El papá escribe "43,32" de forma natural en Colombia. parseFloat nativo
    // se detiene en la coma, así que pre-normalizamos al punto.
    expect(parseNumberInput('43,32')).toBe(43.32)
    expect(parseNumberInput('0,5')).toBe(0.5)
  })

  it('extrae números de strings mixtos (pegar con formato)', () => {
    // parseFloat('30cm') === 30 — aceptable para inputs donde el usuario
    // puede pegar "30 cm" o "30.9" (nos quedamos con 30 o 30.9).
    expect(parseNumberInput('30cm')).toBe(30)
    expect(parseNumberInput('30.9')).toBe(30.9)
  })

  it('clampea al máximo indicado (enteros y decimales)', () => {
    expect(parseNumberInput('999', { max: 500 })).toBe(500)
    expect(parseNumberInput('501', { max: 500 })).toBe(500)
    expect(parseNumberInput('500', { max: 500 })).toBe(500)
    expect(parseNumberInput('500.9', { max: 500 })).toBe(500)
  })

  it('clampea al mínimo indicado', () => {
    expect(parseNumberInput('-5', { min: 0 })).toBe(0)
    expect(parseNumberInput('-5.5', { min: 0 })).toBe(0)
    expect(parseNumberInput('10', { min: 50 })).toBe(50)
  })

  it('trata negativos como 0 por defecto', () => {
    // El min implícito es 0 — un precio/medida negativo no existe en este dominio.
    expect(parseNumberInput('-42')).toBe(0)
    expect(parseNumberInput('-0.01')).toBe(0)
  })

  it('respeta min y max a la vez', () => {
    expect(parseNumberInput('1000', { min: 1, max: 500 })).toBe(500)
    expect(parseNumberInput('-10', { min: 1, max: 500 })).toBe(1)
    expect(parseNumberInput('250', { min: 1, max: 500 })).toBe(250)
  })

  it('rechaza NaN explícito y lo convierte a 0', () => {
    expect(parseNumberInput('NaN')).toBe(0)
  })
})

// parseMoneyInput — dinero en pesos colombianos (COP). El punto es separador
// de miles, no decimal. Un bug silencioso previo usaba parseNumberInput en
// inputs de plata y papá podía cobrar $86 en vez de $86.000 sin darse cuenta.
describe('parseMoneyInput', () => {
  it('devuelve 0 para string vacío o texto no numérico', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
    expect(parseMoneyInput('  ')).toBe(0)
  })

  it('parsea enteros simples sin separadores', () => {
    expect(parseMoneyInput('50000')).toBe(50000)
    expect(parseMoneyInput('0')).toBe(0)
    expect(parseMoneyInput('1')).toBe(1)
  })

  it('strippea el punto como separador de miles colombiano', () => {
    // Este es el caso central del bug reportado: "86.000" debe ser 86 mil.
    expect(parseMoneyInput('86.000')).toBe(86000)
    expect(parseMoneyInput('1.234')).toBe(1234)
    expect(parseMoneyInput('1.234.567')).toBe(1234567)
    expect(parseMoneyInput('12.345.678')).toBe(12345678)
  })

  it('acepta la coma como separador decimal', () => {
    expect(parseMoneyInput('1500,50')).toBe(1500.5)
    expect(parseMoneyInput('0,99')).toBe(0.99)
  })

  it('combina miles con decimales (formato largo es-CO)', () => {
    expect(parseMoneyInput('1.234,50')).toBe(1234.5)
    expect(parseMoneyInput('1.000.000,25')).toBe(1000000.25)
  })

  it('ignora símbolo de moneda y espacios pegados al valor', () => {
    expect(parseMoneyInput('$50.000')).toBe(50000)
    expect(parseMoneyInput('$ 86.000')).toBe(86000)
    expect(parseMoneyInput(' 1.234 ')).toBe(1234)
  })

  it('trata negativos como 0 (un monto negativo no existe en este dominio)', () => {
    expect(parseMoneyInput('-100')).toBe(0)
    expect(parseMoneyInput('-50.000')).toBe(0)
  })

  it('respeta clamp min/max', () => {
    expect(parseMoneyInput('1.000.000', { max: 500000 })).toBe(500000)
    expect(parseMoneyInput('50', { min: 100 })).toBe(100)
  })
})
