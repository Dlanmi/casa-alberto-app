// Tests de `sanitizeConfigOnBoot` — defense in depth contra valores
// corruptos persistidos por versiones anteriores.
//
// Dos políticas según el tipo de clave:
//  - Settings (días, porcentajes, precios): si el valor viola
//    SPEC_NUMERICAS, se restaura al default del seed (informe 7f37f5b).
//  - Consecutivos (contadores de documentos): se computa el valor seguro
//    desde las filas de documentos existentes; el contador nunca baja
//    (informe dae03af — resetear a 1 generaba números duplicados).
//
// Idempotente: una segunda corrida sobre DB ya sana no hace nada.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, nativeAbiAvailable } from './test-utils'
import { clientes, configuracion, pedidos } from './schema'
import { calcularConsecutivoSeguro, sanitizeConfigOnBoot } from './sanitize-config'
import type { DB } from '../db'

// ---------------------------------------------------------------------------
// calcularConsecutivoSeguro — función pura (no requiere DB)
// ---------------------------------------------------------------------------
describe('calcularConsecutivoSeguro', () => {
  it('lista vacía → 1 (no hay documentos, no hay colisión)', () => {
    expect(calcularConsecutivoSeguro([])).toBe(1)
  })

  it('un documento P-0001 → 2', () => {
    expect(calcularConsecutivoSeguro(['P-0001'])).toBe(2)
  })

  it('varios documentos → max + 1', () => {
    expect(calcularConsecutivoSeguro(['F-0001', 'F-0002', 'F-0050', 'F-0007'])).toBe(51)
  })

  it('prefijo de dos letras (CC) → parsea bien', () => {
    expect(calcularConsecutivoSeguro(['CC-0003', 'CC-0010'])).toBe(11)
  })

  it('numeros desordenados → toma el máximo real', () => {
    expect(calcularConsecutivoSeguro(['F-0099', 'F-0002', 'F-0040'])).toBe(100)
  })

  it('ignora numeros null o con formato no estándar', () => {
    // Solo F-0005 matchea /-(\d+)$/; el resto se ignora sin romper.
    expect(calcularConsecutivoSeguro([null, 'sin-guion', 'F-0005', 'XYZ', ''])).toBe(6)
  })

  it('todos los numeros con formato raro → 1 (ninguno aporta)', () => {
    expect(calcularConsecutivoSeguro(['raro', null, 'abc'])).toBe(1)
  })

  it('sufijos largos (> 4 dígitos) → parsea correctamente', () => {
    expect(calcularConsecutivoSeguro(['P-12345'])).toBe(12346)
  })
})

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

  // -------------------------------------------------------------------------
  // Consecutivos — informe sobre dae03af. Resetear a 1 generaba números de
  // documento duplicados → INSERT falla por UNIQUE → DoS persistente.
  // El sanitizer ahora computa el valor seguro desde las filas existentes.
  // -------------------------------------------------------------------------

  // Inserta N pedidos con numeros P-0001..P-000N para simular una DB con
  // documentos. Crea un cliente mínimo primero (FK obligatoria).
  function insertarPedidos(cantidad: number): void {
    const cliente = db.insert(clientes).values({ nombre: 'Cliente Test' }).returning().get()
    for (let i = 1; i <= cantidad; i++) {
      db.insert(pedidos)
        .values({
          numero: `P-${String(i).padStart(4, '0')}`,
          clienteId: cliente.id,
          tipoTrabajo: 'enmarcacion_estandar',
          precioTotal: 1000,
          fechaIngreso: '2026-05-14'
        })
        .run()
    }
  }

  it('consecutivo corrupto + tabla vacía → 1 (no hay colisión posible)', () => {
    setValorCrudo('consecutivo_pedidos', '0') // 0 viola SPEC (min 1)
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(report.sanitizadas[0]?.tipo).toBe('consecutivo')
    expect(leerValor('consecutivo_pedidos')).toBe('1')
  })

  it('consecutivo corrupto + tabla con 5 pedidos → 6 (NO resetea a 1)', () => {
    // Bug del informe: antes esto reseteaba a 1 → generarConsecutivo
    // emitía P-0001 → colisión con el P-0001 ya existente.
    insertarPedidos(5)
    setValorCrudo('consecutivo_pedidos', 'abc') // inválido
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(report.sanitizadas[0]?.tipo).toBe('consecutivo')
    expect(report.sanitizadas[0]?.valorRestaurado).toBe('6')
    expect(leerValor('consecutivo_pedidos')).toBe('6')
  })

  it('consecutivo > max SPEC + pedidos → recalculado desde las filas', () => {
    insertarPedidos(3)
    setValorCrudo('consecutivo_pedidos', '1000000000') // > max 999_999_999
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(leerValor('consecutivo_pedidos')).toBe('4')
  })

  it('caso hermano: consecutivo VÁLIDO pero por debajo de las filas → corregido', () => {
    // consecutivo_pedidos=10 es válido por SPEC (rango 1-999M, entero),
    // pero la tabla tiene hasta P-0050. Emitir P-0010 colisionaría.
    // El informe lo menciona en "Blindspots" — lo cubrimos.
    insertarPedidos(50)
    setValorCrudo('consecutivo_pedidos', '10')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(1)
    expect(report.sanitizadas[0]?.tipo).toBe('consecutivo')
    expect(report.sanitizadas[0]?.razon).toMatch(/por debajo/i)
    expect(leerValor('consecutivo_pedidos')).toBe('51')
  })

  it('consecutivo sano (>= siguiente seguro) NO se toca', () => {
    insertarPedidos(5) // P-0001..P-0005 → seguro = 6
    setValorCrudo('consecutivo_pedidos', '6')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(0)
    expect(leerValor('consecutivo_pedidos')).toBe('6')
  })

  it('consecutivo válido y MÁS alto que las filas se preserva (numeración no retrocede)', () => {
    // El papá pudo tener documentos borrados o saltos intencionales.
    // 100 es válido y > seguro (6). No se baja.
    insertarPedidos(5)
    setValorCrudo('consecutivo_pedidos', '100')
    const report = sanitizeConfigOnBoot(db)
    expect(report.sanitizadas).toHaveLength(0)
    expect(leerValor('consecutivo_pedidos')).toBe('100')
  })

  it('consecutivos: idempotente tras corregir', () => {
    insertarPedidos(5)
    setValorCrudo('consecutivo_pedidos', '0')
    const primero = sanitizeConfigOnBoot(db)
    expect(primero.sanitizadas).toHaveLength(1)
    const segundo = sanitizeConfigOnBoot(db)
    expect(segundo.sanitizadas).toHaveLength(0)
    expect(leerValor('consecutivo_pedidos')).toBe('6')
  })
})
