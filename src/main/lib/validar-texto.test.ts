import { describe, expect, it } from 'vitest'
import { validarTexto, validarTextoOpcional } from './validar-texto'

describe('validarTexto', () => {
  it('acepta strings normales y devuelve trimeado', () => {
    expect(validarTexto('  Alberto  ')).toBe('Alberto')
  })

  it('rechaza tipo no-string requerido', () => {
    expect(() => validarTexto(123 as unknown)).toThrow(/texto/i)
    expect(() => validarTexto(null as unknown)).toThrow(/texto/i)
  })

  it('opcional null/undefined retorna ""', () => {
    expect(validarTexto(null as unknown, { requerido: false })).toBe('')
    expect(validarTexto(undefined as unknown, { requerido: false })).toBe('')
  })

  it('rechaza string vacío cuando requerido', () => {
    expect(() => validarTexto('')).toThrow(/vacío/i)
    expect(() => validarTexto('   ')).toThrow(/vacío/i)
  })

  it('acepta string vacío cuando opcional', () => {
    expect(validarTexto('   ', { requerido: false })).toBe('')
  })

  it('respeta min length post-trim', () => {
    expect(() => validarTexto('a', { min: 2 })).toThrow(/al menos/i)
    expect(validarTexto('ab', { min: 2 })).toBe('ab')
  })

  it('respeta max length post-trim', () => {
    expect(() => validarTexto('abcdef', { max: 3 })).toThrow(/no puede tener más/i)
    expect(validarTexto('abc', { max: 3 })).toBe('abc')
  })

  it('rechaza control chars por default', () => {
    expect(() => validarTexto('hola\x00mundo')).toThrow(/no permitidos/i)
    expect(() => validarTexto('hola\x07mundo')).toThrow(/no permitidos/i)
  })

  it('permite tab/newline/CR (whitespace válido)', () => {
    expect(validarTexto('linea1\nlinea2')).toBe('linea1\nlinea2')
    expect(validarTexto('col1\tcol2')).toBe('col1\tcol2')
  })

  it('permite control chars cuando rechazarControlChars=false', () => {
    const result = validarTexto('a\x00b', { rechazarControlChars: false })
    expect(result.length).toBe(3)
  })

  it('mensaje incluye el nombre del campo', () => {
    expect(() => validarTexto('', { campo: 'El nombre' })).toThrow(/nombre/i)
  })
})

describe('validarTextoOpcional', () => {
  it('vacío retorna null', () => {
    expect(validarTextoOpcional('')).toBeNull()
    expect(validarTextoOpcional('   ')).toBeNull()
    expect(validarTextoOpcional(null)).toBeNull()
  })

  it('string normal retorna trim', () => {
    expect(validarTextoOpcional('  hola  ')).toBe('hola')
  })

  it('respeta max', () => {
    expect(() => validarTextoOpcional('abc', { max: 2 })).toThrow(/más de/i)
  })
})
