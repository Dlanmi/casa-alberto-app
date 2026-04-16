// Integration test for generarConsecutivo auto-provisioning. The business
// audit added the 'cuenta_cobro' type (worktree-agent-ad7e00e2) and must work
// on databases that predate the configuración row for that counter.
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { DB } from './index'
import { createTestDb, nativeAbiAvailable } from './test-utils'
import { configuracion } from './schema'
import { generarConsecutivo } from './consecutivos'

describe.runIf(nativeAbiAvailable)('generarConsecutivo', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  it('genera CC-0001 en una DB fresca sin fila de configuración (auto-provision)', () => {
    // Confirmamos que no hay fila pre-existente.
    const previa = db
      .select()
      .from(configuracion)
      .where(eq(configuracion.clave, 'consecutivo_cuentas_cobro'))
      .get()
    expect(previa).toBeUndefined()

    const numero = generarConsecutivo(db, 'cuenta_cobro')
    expect(numero).toBe('CC-0001')

    // Ahora sí existe la fila con el siguiente valor (2).
    const creada = db
      .select()
      .from(configuracion)
      .where(eq(configuracion.clave, 'consecutivo_cuentas_cobro'))
      .get()
    expect(creada?.valor).toBe('2')
  })

  it('genera números consecutivos en llamadas sucesivas', () => {
    expect(generarConsecutivo(db, 'cuenta_cobro')).toBe('CC-0001')
    expect(generarConsecutivo(db, 'cuenta_cobro')).toBe('CC-0002')
    expect(generarConsecutivo(db, 'cuenta_cobro')).toBe('CC-0003')
  })

  it('cada tipo usa su propio contador y prefijo', () => {
    expect(generarConsecutivo(db, 'pedido')).toBe('P-0001')
    expect(generarConsecutivo(db, 'factura')).toBe('F-0001')
    expect(generarConsecutivo(db, 'contrato')).toBe('C-0001')
    expect(generarConsecutivo(db, 'cuenta_cobro')).toBe('CC-0001')
    // Todos siguen incrementando independientemente.
    expect(generarConsecutivo(db, 'pedido')).toBe('P-0002')
    expect(generarConsecutivo(db, 'cuenta_cobro')).toBe('CC-0002')
  })

  it('genera 100 consecutivos sin duplicados ni huecos (B1)', () => {
    // Regresión del race condition. Aunque better-sqlite3 serializa las
    // transacciones en un mismo proceso, probamos que la nueva implementación
    // con UPDATE...RETURNING mantiene la secuencia exacta bajo carga.
    const emitidos = new Set<string>()
    for (let i = 1; i <= 100; i++) {
      const num = generarConsecutivo(db, 'pedido')
      expect(num).toBe(`P-${String(i).padStart(4, '0')}`)
      emitidos.add(num)
    }
    expect(emitidos.size).toBe(100)
  })

  it('alterna pedidos y facturas sin cruzar contadores', () => {
    const secuencia: string[] = []
    for (let i = 0; i < 20; i++) {
      secuencia.push(generarConsecutivo(db, 'pedido'))
      secuencia.push(generarConsecutivo(db, 'factura'))
    }
    // Pedidos: P-0001 .. P-0020 ; Facturas: F-0001 .. F-0020
    const pedidos = secuencia.filter((s) => s.startsWith('P-'))
    const facturas = secuencia.filter((s) => s.startsWith('F-'))
    expect(pedidos).toEqual(
      Array.from({ length: 20 }, (_, i) => `P-${String(i + 1).padStart(4, '0')}`)
    )
    expect(facturas).toEqual(
      Array.from({ length: 20 }, (_, i) => `F-${String(i + 1).padStart(4, '0')}`)
    )
  })
})
