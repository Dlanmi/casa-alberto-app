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

const CLAVES_NUMERICAS = [
  'precio_clase_mensual',
  'precio_kit_dibujo',
  'porcentaje_materiales_default',
  'tiempo_entrega_default',
  'dias_entrega_urgente',
  'dias_entrega_estandar',
  'dias_entrega_sin_afan',
  'consecutivo_facturas',
  'consecutivo_pedidos',
  'consecutivo_contratos'
]

// Claves que representan cantidades de días. La app las usa para sugerir
// fechas de entrega — un valor absurdo (Infinity, decimal, 99.999) generaría
// fechas inválidas. Las acotamos a un año entero. Aplica el mismo género de
// hardening del incidente Infinity en pedidos multi-trabajo (v2.2.1).
const CLAVES_DIAS = new Set([
  'tiempo_entrega_default',
  'dias_entrega_urgente',
  'dias_entrega_estandar',
  'dias_entrega_sin_afan'
])
const DIAS_MAX = 365

export function setConfig(db: DB, clave: string, valor: string, descripcion?: string): void {
  if (CLAVES_NUMERICAS.includes(clave)) {
    const n = parseFloat(valor)
    if (isNaN(n) || n < 0) {
      throw new Error(`El valor de "${clave}" debe ser un número válido mayor o igual a 0`)
    }
    if (CLAVES_DIAS.has(clave)) {
      if (!Number.isInteger(n)) {
        throw new Error(`El valor de "${clave}" debe ser un número entero de días`)
      }
      if (n > DIAS_MAX) {
        throw new Error(`El valor de "${clave}" no puede ser mayor a ${DIAS_MAX} días`)
      }
    }
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
