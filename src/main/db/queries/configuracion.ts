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
  'consecutivo_facturas',
  'consecutivo_pedidos',
  'consecutivo_contratos'
]

export function setConfig(db: DB, clave: string, valor: string, descripcion?: string): void {
  if (CLAVES_NUMERICAS.includes(clave)) {
    const n = parseFloat(valor)
    if (isNaN(n) || n < 0) {
      throw new Error(`El valor de "${clave}" debe ser un número válido mayor o igual a 0`)
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
