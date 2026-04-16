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
})
