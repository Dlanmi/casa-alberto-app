// Sprint 2 · A1/A2/A4 — integration tests para validaciones de cliente.
// Cubrimos: teléfono (regex 7–15 dígitos), cédula (6–15 dígitos + UNIQUE),
// nombre (2–200 chars). El backend es la fuente de verdad; estos tests se
// aseguran de que no se colee un registro inválido aunque la UI se saltara
// la validación.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { actualizarCliente, crearCliente, normalizarCedula, normalizarTelefono } from './clientes'

describe.runIf(nativeAbiAvailable)('clientes · A1 validar teléfono (7–15 dígitos)', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  it('acepta teléfonos en el rango válido y normaliza separadores', () => {
    const c = crearCliente(db, { nombre: 'Alberto', telefono: '300 123 4567' })
    expect(c.telefono).toBe('3001234567')
  })

  it('acepta teléfonos con formato extranjero (paréntesis y guiones)', () => {
    const c = crearCliente(db, { nombre: 'Alberto', telefono: '(601) 456-7890' })
    expect(c.telefono).toBe('6014567890')
  })

  it('acepta teléfono largo de 15 dígitos (máximo)', () => {
    const c = crearCliente(db, { nombre: 'Alberto', telefono: '123456789012345' })
    expect(c.telefono).toBe('123456789012345')
  })

  it('rechaza teléfono con menos de 7 dígitos', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', telefono: '12345' })).toThrow(/teléfono/i)
  })

  it('rechaza teléfono con letras', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', telefono: '300abc4567' })).toThrow(
      /teléfono/i
    )
  })

  it('rechaza teléfono con más de 15 dígitos', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', telefono: '1234567890123456' })).toThrow(
      /teléfono/i
    )
  })

  it('teléfono vacío o nulo queda como null (no obligatorio)', () => {
    const c = crearCliente(db, { nombre: 'Alberto', telefono: '' })
    expect(c.telefono).toBeNull()
    const d = crearCliente(db, { nombre: 'Beatriz', telefono: null })
    expect(d.telefono).toBeNull()
  })

  it('actualizarCliente también valida el teléfono', () => {
    const c = crearCliente(db, { nombre: 'Alberto' })
    expect(() => actualizarCliente(db, c.id, { telefono: '123' })).toThrow(/teléfono/i)
  })

  it('normalizarTelefono es una función pura reutilizable', () => {
    expect(normalizarTelefono('300 123 4567')).toBe('3001234567')
    expect(normalizarTelefono('')).toBeNull()
    expect(normalizarTelefono(null)).toBeNull()
    expect(() => normalizarTelefono('abc')).toThrow(/teléfono/i)
  })
})

describe.runIf(nativeAbiAvailable)('clientes · A2 validar cédula + UNIQUE', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  it('acepta cédula en el rango válido y normaliza puntos/espacios', () => {
    const c = crearCliente(db, { nombre: 'Alberto', cedula: '1.234.567.890' })
    expect(c.cedula).toBe('1234567890')
  })

  it('rechaza cédula con menos de 6 dígitos', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', cedula: '12345' })).toThrow(/cédula/i)
  })

  it('rechaza cédula con más de 15 dígitos', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', cedula: '1234567890123456' })).toThrow(
      /cédula/i
    )
  })

  it('rechaza cédula con letras o símbolos', () => {
    expect(() => crearCliente(db, { nombre: 'Alberto', cedula: '12abc456' })).toThrow(/cédula/i)
  })

  it('el UNIQUE de cédula bloquea duplicados con mensaje legible', () => {
    crearCliente(db, { nombre: 'Alberto', cedula: '1234567890' })
    expect(() => crearCliente(db, { nombre: 'Otro Alberto', cedula: '1234567890' })).toThrow(
      /ya hay otro cliente registrado con la cédula 1234567890/i
    )
  })

  it('permite múltiples clientes sin cédula (NULL ≠ NULL en UNIQUE)', () => {
    // Dos clientes sin cédula no chocan contra el UNIQUE porque SQLite trata
    // cada NULL como distinto. Esto importa: la mayoría del directorio legado
    // del papá no tenía cédula capturada.
    const a = crearCliente(db, { nombre: 'Alberto' })
    const b = crearCliente(db, { nombre: 'Beatriz' })
    expect(a.cedula).toBeNull()
    expect(b.cedula).toBeNull()
  })

  it('actualizarCliente con cédula duplicada falla con el mismo mensaje', () => {
    crearCliente(db, { nombre: 'Alberto', cedula: '1234567890' })
    const otro = crearCliente(db, { nombre: 'Beatriz', cedula: '9876543210' })
    expect(() => actualizarCliente(db, otro.id, { cedula: '1234567890' })).toThrow(
      /ya hay otro cliente registrado con la cédula 1234567890/i
    )
  })

  it('normalizarCedula es una función pura reutilizable', () => {
    expect(normalizarCedula('1.234.567.890')).toBe('1234567890')
    expect(normalizarCedula('')).toBeNull()
    expect(() => normalizarCedula('abc')).toThrow(/cédula/i)
  })
})

describe.runIf(nativeAbiAvailable)('clientes · A4 validar nombre (2–200 chars)', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  it('rechaza nombre vacío', () => {
    expect(() => crearCliente(db, { nombre: '' })).toThrow(/nombre/i)
  })

  it('rechaza nombre con sólo espacios', () => {
    expect(() => crearCliente(db, { nombre: '   ' })).toThrow(/nombre/i)
  })

  it('rechaza nombre de 1 carácter', () => {
    expect(() => crearCliente(db, { nombre: 'A' })).toThrow(/al menos 2 caracteres/i)
  })

  it('acepta nombre de 2 caracteres (borde inferior)', () => {
    const c = crearCliente(db, { nombre: 'Al' })
    expect(c.nombre).toBe('Al')
  })

  it('acepta nombre de 200 caracteres (borde superior)', () => {
    const nombre = 'A'.repeat(200)
    const c = crearCliente(db, { nombre })
    expect(c.nombre).toBe(nombre)
  })

  it('rechaza nombre de 201 caracteres (excede máximo)', () => {
    const nombre = 'A'.repeat(201)
    expect(() => crearCliente(db, { nombre })).toThrow(/200 caracteres/i)
  })

  it('hace trim del nombre antes de validar y almacenar', () => {
    const c = crearCliente(db, { nombre: '  Alberto  ' })
    expect(c.nombre).toBe('Alberto')
  })
})
