// Tests de `sanitizeConfigOnBoot` — defense in depth contra valores
// corruptos persistidos por versiones anteriores (Excel importado antes
// del fix del informe de seguridad sobre 7f37f5b).
//
// Política: si una clave numérica tiene valor fuera de SPEC_NUMERICAS,
// se restaura al default del seed y se loguea. Idempotente: una segunda
// corrida sobre DB ya sanitizada no hace nada.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, nativeAbiAvailable } from './test-utils'
import { configuracion } from './schema'
import { sanitizeConfigOnBoot } from './sanitize-config'
import type { DB } from '../db'

describe.runIf(nativeAbiAvailable)('sanitizeConfigOnBoot', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })
  afterEach(() => {
    // createTestDb cierra automáticamente
  })

  function setValorCrudo(clave: string, valor: string): void {
    // Bypass deliberado de setConfig para simular DB con corrupción
    // pre-existente (ej. cargada por Excel viejo antes del fix).
    db.update(configuracion).set({ valor }).where(eq(configuracion.clave, clave)).run()
  }

  function leerValor(clave: string): string | null {
    return (
      db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()?.valor ?? null
    )
  }

  it('DB limpia (defaults del seed) → no sanitiza nada', () => {
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(0)
  })

  it('restaura dias_entrega_urgente=-2 → default del seed (3)', () => {
    setValorCrudo('dias_entrega_urgente', '-2')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(report.sanitizadas[0]?.clave).toBe('dias_entrega_urgente')
    expect(report.sanitizadas[0]?.valorAnterior).toBe('-2')
    expect(report.sanitizadas[0]?.valorRestaurado).toBe('3')
    expect(leerValor('dias_entrega_urgente')).toBe('3')
  })

  it('restaura dias_entrega_estandar=3.5 (decimal) → default 7', () => {
    setValorCrudo('dias_entrega_estandar', '3.5')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('dias_entrega_estandar')).toBe('7')
  })

  it('restaura dias_entrega_sin_afan=100000000 (fuera de rango) → default 14', () => {
    setValorCrudo('dias_entrega_sin_afan', '100000000')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('dias_entrega_sin_afan')).toBe('14')
  })

  it('restaura porcentaje_materiales_default=3.5 (fuera de 5-10) → default 10', () => {
    setValorCrudo('porcentaje_materiales_default', '3.5')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('porcentaje_materiales_default')).toBe('10')
  })

  it('restaura margen_minimo_alerta_pct=-50 (negativo) → default 20', () => {
    setValorCrudo('margen_minimo_alerta_pct', '-50')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('margen_minimo_alerta_pct')).toBe('20')
  })

  it('restaura precio_clase_mensual=999999999 (fuera de 100M) → default 110000', () => {
    setValorCrudo('precio_clase_mensual', '999999999')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('precio_clase_mensual')).toBe('110000')
  })

  it('múltiples valores corruptos → sanitiza todos en una pasada', () => {
    setValorCrudo('dias_entrega_urgente', '-2')
    setValorCrudo('dias_entrega_estandar', '500')
    setValorCrudo('margen_minimo_alerta_pct', '999')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(3)
    expect(leerValor('dias_entrega_urgente')).toBe('3')
    expect(leerValor('dias_entrega_estandar')).toBe('7')
    expect(leerValor('margen_minimo_alerta_pct')).toBe('20')
  })

  it('es idempotente: segunda corrida no hace nada', () => {
    setValorCrudo('dias_entrega_urgente', '-2')
    const primero = sanitizeConfigOnBoot(db)
    expect(primero.sanitizadas).toHaveLength(1)
    const segundo = sanitizeConfigOnBoot(db)
    expect(segundo.sanitizadas).toHaveLength(0)
  })

  it('no toca claves de configuración no-numéricas (strings libres)', () => {
    db.update(configuracion)
      .set({ valor: 'cualquier texto raro <script>' })
      .where(eq(configuracion.clave, 'nombre_negocio'))
      .run()
    const report = sanitizeConfigOnBoot(db)
    // nombre_negocio no está en SPEC_NUMERICAS, no se sanitiza.
    expect(report.sanitizadas).toHaveLength(0)
    expect(leerValor('nombre_negocio')).toBe('cualquier texto raro <script>')
  })

  it('valor en rango límite se preserva', () => {
    // 365 días es el máximo permitido para tiempo_entrega_default.
    setValorCrudo('tiempo_entrega_default', '365')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(0)
    expect(leerValor('tiempo_entrega_default')).toBe('365')
  })
})
