// Sprint 2 · C5 — tests para el parser numérico defensivo usado por los
// inputs del wizard del cotizador y modales con montos. El objetivo es que
// `Number('abc') || 0` deje de esconder typos, que los rangos (medidas,
// precios) se respeten, y que MEDIDAS DECIMALES (43.32 cm) funcionen: el
// primer intento con `parseInt` estripaba decimales y rompía el flujo del
// papá al cotizar obras con medida fina.
import { describe, expect, it } from 'vitest'
import { parseNumberInput } from './parse-input'

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
