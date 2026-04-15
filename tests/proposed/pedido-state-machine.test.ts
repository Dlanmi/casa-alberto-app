/**
 * Proposed tests — added by tester/QA agent.
 *
 * Tests for TRANSICIONES_VALIDAS (exported from pedidos.ts). These are
 * pure data assertions and don't need a DB. They lock in the state
 * machine so accidental edits are caught.
 */
import { describe, it, expect } from 'vitest'
import { TRANSICIONES_VALIDAS } from '../../src/main/db/queries/pedidos'

type Estado = keyof typeof TRANSICIONES_VALIDAS

const TODOS_ESTADOS: Estado[] = [
  'cotizado',
  'confirmado',
  'en_proceso',
  'listo',
  'entregado',
  'sin_reclamar',
  'cancelado'
]

describe('[proposed] state machine de pedidos — transiciones válidas', () => {
  it('tiene todos los estados de negocio', () => {
    for (const e of TODOS_ESTADOS) {
      expect(TRANSICIONES_VALIDAS[e]).toBeDefined()
    }
  })

  it('estados terminales no permiten salidas', () => {
    expect(TRANSICIONES_VALIDAS.entregado).toEqual([])
    expect(TRANSICIONES_VALIDAS.cancelado).toEqual([])
  })

  it('cotizado → confirmado o cancelado (nunca directo a proceso)', () => {
    expect(TRANSICIONES_VALIDAS.cotizado).toContain('confirmado')
    expect(TRANSICIONES_VALIDAS.cotizado).toContain('cancelado')
    expect(TRANSICIONES_VALIDAS.cotizado).not.toContain('en_proceso')
    expect(TRANSICIONES_VALIDAS.cotizado).not.toContain('entregado')
  })

  it('confirmado → en_proceso o cancelado', () => {
    expect(TRANSICIONES_VALIDAS.confirmado).toContain('en_proceso')
    expect(TRANSICIONES_VALIDAS.confirmado).toContain('cancelado')
    expect(TRANSICIONES_VALIDAS.confirmado).not.toContain('listo')
    expect(TRANSICIONES_VALIDAS.confirmado).not.toContain('entregado')
  })

  it('en_proceso → listo o cancelado', () => {
    expect(TRANSICIONES_VALIDAS.en_proceso).toContain('listo')
    expect(TRANSICIONES_VALIDAS.en_proceso).toContain('cancelado')
    expect(TRANSICIONES_VALIDAS.en_proceso).not.toContain('entregado')
  })

  it('listo permite entregado, sin_reclamar y cancelado', () => {
    expect(TRANSICIONES_VALIDAS.listo).toEqual(
      expect.arrayContaining(['entregado', 'sin_reclamar', 'cancelado'])
    )
  })

  it('sin_reclamar puede volver a entregado o cancelado (rescate)', () => {
    expect(TRANSICIONES_VALIDAS.sin_reclamar).toContain('entregado')
    expect(TRANSICIONES_VALIDAS.sin_reclamar).toContain('cancelado')
  })

  it('NO existe transición directa cotizado → listo (regla de negocio)', () => {
    expect(TRANSICIONES_VALIDAS.cotizado).not.toContain('listo')
  })

  it('NO existe transición directa cotizado → entregado', () => {
    expect(TRANSICIONES_VALIDAS.cotizado).not.toContain('entregado')
  })

  it('ningún estado puede volver a cotizado (no hay rollback a cotización)', () => {
    for (const e of TODOS_ESTADOS) {
      if (e !== 'cotizado') {
        expect(TRANSICIONES_VALIDAS[e]).not.toContain('cotizado')
      }
    }
  })
})
