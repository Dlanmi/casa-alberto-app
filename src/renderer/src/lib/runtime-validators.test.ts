import { describe, expect, it } from 'vitest'
import {
  esObjeto,
  esString,
  esStringNoVacio,
  esNumeroFinito,
  esBool,
  esEnum,
  esArrayDe
} from './runtime-validators'

describe('esObjeto', () => {
  it('acepta objetos planos', () => {
    expect(esObjeto({})).toBe(true)
    expect(esObjeto({ a: 1 })).toBe(true)
  })
  it('rechaza null', () => {
    expect(esObjeto(null)).toBe(false)
  })
  it('rechaza arrays (trampa típica con typeof)', () => {
    expect(esObjeto([])).toBe(false)
    expect(esObjeto([1, 2, 3])).toBe(false)
  })
  it('rechaza primitivos', () => {
    expect(esObjeto('foo')).toBe(false)
    expect(esObjeto(42)).toBe(false)
    expect(esObjeto(true)).toBe(false)
    expect(esObjeto(undefined)).toBe(false)
  })
})

describe('esString', () => {
  it('acepta strings vacíos', () => {
    expect(esString('')).toBe(true)
    expect(esString('hola')).toBe(true)
  })
  it('rechaza no-strings', () => {
    expect(esString(42)).toBe(false)
    expect(esString(null)).toBe(false)
    expect(esString(undefined)).toBe(false)
    expect(esString({})).toBe(false)
  })
  it('respeta maxLen', () => {
    expect(esString('abc', { maxLen: 5 })).toBe(true)
    expect(esString('abcdef', { maxLen: 5 })).toBe(false)
  })
})

describe('esStringNoVacio', () => {
  it('rechaza vacíos y whitespace', () => {
    expect(esStringNoVacio('')).toBe(false)
    expect(esStringNoVacio('   ')).toBe(false)
    expect(esStringNoVacio('\t\n')).toBe(false)
  })
  it('acepta con contenido', () => {
    expect(esStringNoVacio('hola')).toBe(true)
    expect(esStringNoVacio(' hola ')).toBe(true)
  })
})

describe('esNumeroFinito', () => {
  it('acepta números finitos', () => {
    expect(esNumeroFinito(0)).toBe(true)
    expect(esNumeroFinito(42)).toBe(true)
    expect(esNumeroFinito(-3.14)).toBe(true)
  })
  it('rechaza NaN, Infinity, -Infinity', () => {
    expect(esNumeroFinito(Number.NaN)).toBe(false)
    expect(esNumeroFinito(Infinity)).toBe(false)
    expect(esNumeroFinito(-Infinity)).toBe(false)
  })
  it('rechaza no-números', () => {
    expect(esNumeroFinito('42')).toBe(false)
    expect(esNumeroFinito(null)).toBe(false)
    expect(esNumeroFinito(undefined)).toBe(false)
  })
  it('respeta min/max', () => {
    expect(esNumeroFinito(5, { min: 0, max: 10 })).toBe(true)
    expect(esNumeroFinito(-1, { min: 0 })).toBe(false)
    expect(esNumeroFinito(11, { max: 10 })).toBe(false)
  })
  it('respeta entero', () => {
    expect(esNumeroFinito(3, { entero: true })).toBe(true)
    expect(esNumeroFinito(3.14, { entero: true })).toBe(false)
  })
})

describe('esBool', () => {
  it('acepta booleans', () => {
    expect(esBool(true)).toBe(true)
    expect(esBool(false)).toBe(true)
  })
  it('rechaza coerciones', () => {
    expect(esBool(0)).toBe(false)
    expect(esBool(1)).toBe(false)
    expect(esBool('true')).toBe(false)
    expect(esBool(null)).toBe(false)
  })
})

describe('esEnum', () => {
  const tipos = ['marco', 'vidrio', 'paspartu'] as const
  it('acepta valores del enum', () => {
    expect(esEnum('marco', tipos)).toBe(true)
    expect(esEnum('vidrio', tipos)).toBe(true)
  })
  it('rechaza valores fuera del enum', () => {
    expect(esEnum('otro', tipos)).toBe(false)
    expect(esEnum('', tipos)).toBe(false)
  })
  it('rechaza no-strings', () => {
    expect(esEnum(42, tipos)).toBe(false)
    expect(esEnum(null, tipos)).toBe(false)
  })
})

describe('esArrayDe', () => {
  const validarNumero = (v: unknown): number | null => (esNumeroFinito(v) ? v : null)

  it('acepta array vacío', () => {
    expect(esArrayDe([], validarNumero)).toEqual([])
  })

  it('acepta array donde todos los elementos pasan', () => {
    expect(esArrayDe([1, 2, 3], validarNumero)).toEqual([1, 2, 3])
  })

  it('rechaza array entero si UN elemento falla', () => {
    expect(esArrayDe([1, 'x', 3], validarNumero)).toBeNull()
  })

  it('rechaza si no es array', () => {
    expect(esArrayDe('not-array', validarNumero)).toBeNull()
    expect(esArrayDe(null, validarNumero)).toBeNull()
    expect(esArrayDe({}, validarNumero)).toBeNull()
  })

  it('rechaza elemento null/undefined', () => {
    expect(esArrayDe([1, null, 3], validarNumero)).toBeNull()
    expect(esArrayDe([1, undefined, 3], validarNumero)).toBeNull()
  })
})
