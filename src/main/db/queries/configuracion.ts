import { eq } from 'drizzle-orm'
import type { DB } from '../index'
import { configuracion } from '../schema'

export function getConfig(db: DB, clave: string): string | null {
  const row = db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
  return row?.valor ?? null
}

// Parser puro extraído para test sin DB. `Number.isFinite` rechaza NaN,
// Infinity y -Infinity. Sin este guard, un valor manual mal formado
// (`"1e999"`, `"abc"`) podía propagar Infinity a cálculos del cotizador
// (porcentaje, precio_clase_mensual) y mostrar "$Infinity" en pantalla.
export function parseConfigNumber(raw: string | null, fallback = 0): number {
  if (raw == null) return fallback
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

export function getConfigNumber(db: DB, clave: string, fallback = 0): number {
  return parseConfigNumber(getConfig(db, clave), fallback)
}

// Spec de dominio por clave numérica de la tabla `configuracion`.
// Antes había dos arrays sueltos (CLAVES_NUMERICAS + CLAVES_DIAS) y la
// validación estaba inline en setConfig — esa duplicación era frágil:
// el Excel importer escribía con su propio set de validaciones distintas
// (bug del informe sobre 7f37f5b), generando dos paths con dominios
// inconsistentes.
//
// Ahora la spec vive en UN solo lugar y la consumen:
//   1. `setConfig` (este archivo) — escritura por IPC.
//   2. `parseConfiguracion` (excel/plantilla.ts) — pre-validación de Excel.
//   3. `cargarPlantilla` (excel/plantilla.ts) — escritura desde Excel,
//       ahora también pasa por `setConfig`.
//   4. `sanitizeConfigOnBoot` (db/sanitize-config.ts) — limpieza al boot
//       de DBs que tienen valores corruptos de versiones anteriores.
//
// Rangos elegidos:
// - Días (entero 0-365): un año cubre el tiempo más largo razonable de
//   entrega. Negativos generan fechas en el pasado; >365 generan fechas
//   absurdas en el futuro.
// - Porcentajes: rangos del dominio (5-10 para materiales adicionales
//   está en Fase 2, 0-100 para márgenes y costos genéricos).
// - Precios: hasta 100M COP por unidad (un kit/clase no debería costar
//   más; valores mayores casi seguro son typo o ataque).
// - Consecutivos: enteros ≥1, máx 999M (consecutivos enteros razonables).
export type ClaveSpec = {
  min: number
  max: number
  entero?: boolean
  /** Etiqueta legible para mensajes de error. */
  unidad?: string
}

export const SPEC_NUMERICAS: Record<string, ClaveSpec> = {
  // Días sugeridos de entrega.
  tiempo_entrega_default: { min: 0, max: 365, entero: true, unidad: 'días' },
  dias_entrega_urgente: { min: 0, max: 365, entero: true, unidad: 'días' },
  dias_entrega_estandar: { min: 0, max: 365, entero: true, unidad: 'días' },
  dias_entrega_sin_afan: { min: 0, max: 365, entero: true, unidad: 'días' },
  // Porcentajes (rangos del dominio de Fase 2).
  porcentaje_materiales_default: { min: 5, max: 10, unidad: '%' },
  porcentaje_costo_materiales_armado_default: { min: 0, max: 100, unidad: '%' },
  margen_minimo_alerta_pct: { min: 0, max: 100, unidad: '%' },
  // Precios (COP). Tope de 100M previene typos como "100000000000".
  precio_clase_mensual: { min: 0, max: 100_000_000, unidad: 'COP' },
  precio_kit_dibujo: { min: 0, max: 100_000_000, unidad: 'COP' },
  // Consecutivos: enteros ≥1, tope arbitrariamente grande.
  consecutivo_facturas: { min: 1, max: 999_999_999, entero: true },
  consecutivo_pedidos: { min: 1, max: 999_999_999, entero: true },
  consecutivo_contratos: { min: 1, max: 999_999_999, entero: true },
  consecutivo_cuentas_cobro: { min: 1, max: 999_999_999, entero: true }
}

// Resultado de la validación de dominio. Si `ok=true`, `valor` es el
// número parseado y normalizado; si `ok=false`, `error` contiene el
// mensaje listo para mostrar al usuario.
export type ResultadoValidacion =
  | { ok: true; valor: number }
  | { ok: false; error: string }

/**
 * Valida un valor crudo (string del Excel o del IPC) contra la spec de
 * la clave. Si la clave NO está en `SPEC_NUMERICAS`, retorna ok=true sin
 * validar (las strings libres como `nombre_negocio` pasan).
 */
export function validarValorConfig(clave: string, valor: string): ResultadoValidacion {
  const spec = SPEC_NUMERICAS[clave]
  if (!spec) return { ok: true, valor: Number.NaN } // no es numérica, no aplica
  const n = parseFloat(valor)
  if (!Number.isFinite(n)) {
    return {
      ok: false,
      error: `El valor de "${clave}" debe ser un número válido (recibido: "${valor}")`
    }
  }
  if (spec.entero && !Number.isInteger(n)) {
    return {
      ok: false,
      error: `El valor de "${clave}" debe ser un número entero${spec.unidad ? ' de ' + spec.unidad : ''}`
    }
  }
  if (n < spec.min) {
    return {
      ok: false,
      error: `El valor de "${clave}" no puede ser menor a ${spec.min}${spec.unidad ? ' ' + spec.unidad : ''}`
    }
  }
  if (n > spec.max) {
    return {
      ok: false,
      error: `El valor de "${clave}" no puede ser mayor a ${spec.max}${spec.unidad ? ' ' + spec.unidad : ''}`
    }
  }
  return { ok: true, valor: n }
}

export function setConfig(db: DB, clave: string, valor: string, descripcion?: string): void {
  const resultado = validarValorConfig(clave, valor)
  if (!resultado.ok) {
    throw new Error(resultado.error)
  }

  const existing = db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
  if (existing) {
    db.update(configuracion).set({ valor }).where(eq(configuracion.clave, clave)).run()
  } else {
    db.insert(configuracion).values({ clave, valor, descripcion }).run()
  }
}

export function listarConfiguracion(db: DB) {
  return db.select().from(configuracion).all()
}

/**
 * Lee el flag de onboarding. Retorna `true` solo si el usuario completó
 * explícitamente el wizard de primera ejecución.
 */
export function isOnboardingCompleted(db: DB): boolean {
  return getConfig(db, 'onboarding_completed') === '1'
}

/**
 * Marca el wizard de onboarding como completado. Se llama cuando el
 * usuario termina la última pantalla del wizard.
 */
export function marcarOnboardingCompleto(db: DB): void {
  setConfig(db, 'onboarding_completed', '1')
}
