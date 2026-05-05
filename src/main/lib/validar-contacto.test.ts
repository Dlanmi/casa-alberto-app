import { describe, expect, it } from 'vitest'
import {
  validarCedula,
  validarCedulaOpcional,
  validarCorreo,
  validarCorreoOpcional,
  validarTelefono,
  validarTelefonoOpcional
} from './validar-contacto'

describe('validarTelefono', () => {
  it('acepta dígitos puros', () => {
    expect(validarTelefono('3001234567')).toBe('3001234567')
  })

  it('limpia espacios, guiones, paréntesis, +', () => {
    expect(validarTelefono('+57 (601) 456-7890')).toBe('576014567890')
    expect(validarTelefono('300.123.4567')).toBe('3001234567')
  })

  it('rechaza letras', () => {
    expect(() => validarTelefono('300abc4567')).toThrow(/números/i)
  })

  it('rechaza menos de 7 dígitos', () => {
    expect(() => validarTelefono('123456')).toThrow(/al menos 7/i)
  })

  it('rechaza más de 15 dígitos', () => {
    expect(() => validarTelefono('1234567890123456')).toThrow(/no puede tener más/i)
  })

  it('vacío rechazado si requerido', () => {
    expect(() => validarTelefono('')).toThrow(/obligatorio/i)
    expect(() => validarTelefono('   ')).toThrow(/obligatorio/i)
  })

  it('opcional vacío retorna null', () => {
    expect(validarTelefonoOpcional('')).toBeNull()
    expect(validarTelefonoOpcional(null)).toBeNull()
  })
})

describe('validarCedula', () => {
  it('limpia puntos típicos colombianos', () => {
    expect(validarCedula('1.234.567.890')).toBe('1234567890')
    expect(validarCedula('001.234.567')).toBe('001234567')
  })

  it('limpia guiones y espacios', () => {
    expect(validarCedula('12-345-678')).toBe('12345678')
    expect(validarCedula('12 345 678')).toBe('12345678')
  })

  it('rechaza letras', () => {
    expect(() => validarCedula('123abc')).toThrow(/números/i)
  })

  it('rango 6-15', () => {
    expect(() => validarCedula('12345')).toThrow(/al menos 6/i)
    expect(() => validarCedula('1234567890123456')).toThrow(/no puede tener más/i)
  })

  it('opcional vacío retorna null', () => {
    expect(validarCedulaOpcional('')).toBeNull()
  })
})

describe('validarCorreo', () => {
  it('acepta correos típicos', () => {
    expect(validarCorreo('alberto@casaalberto.com')).toBe('alberto@casaalberto.com')
    expect(validarCorreo('user.name+tag@dominio.co.uk')).toBe('user.name+tag@dominio.co.uk')
  })

  it('trimea', () => {
    expect(validarCorreo('  user@example.com  ')).toBe('user@example.com')
  })

  it('rechaza espacios internos', () => {
    expect(() => validarCorreo('user @ example.com')).toThrow(/formato/i)
  })

  it('rechaza sin @', () => {
    expect(() => validarCorreo('userexample.com')).toThrow(/formato/i)
  })

  it('rechaza sin TLD', () => {
    expect(() => validarCorreo('user@example')).toThrow(/formato/i)
    expect(() => validarCorreo('user@.com')).toThrow(/formato/i)
  })

  it('rechaza muy largo', () => {
    const long = 'a'.repeat(120) + '@x.com'
    expect(() => validarCorreo(long)).toThrow(/largo/i)
  })

  it('opcional vacío retorna null', () => {
    expect(validarCorreoOpcional('')).toBeNull()
  })
})
