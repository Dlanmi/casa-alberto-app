// Helpers para que TypeScript pueda consumir los tokens de motion definidos
// en `main.css`. Evita duplicar magic numbers (ej. `MODAL_EXIT_MS = 150` que
// debía coincidir manualmente con `--duration-fast`).
//
// Estrategia lazy: las constantes que necesitan la duración la leen del CSS
// al momento de USARLA, no en module-load. Esto resuelve el caso edge en
// que un módulo importa `motion.ts` antes de que el CSS esté inyectado en
// el documento (el `<link>` o `<style>` del bundler aún no parseado), lo
// que devolvía siempre el fallback.

export type MotionDurationToken =
  | 'instant'
  | 'fast'
  | 'base'
  | 'slow'
  | 'slower'
  | 'pulse'
  | 'flash'
  | 'spin'
  | 'warm'
  | 'loading'

// Fallbacks alineados con `main.css`. Se usan cuando el browser no expone
// el custom property aún (ej. tests sin DOM, primer render antes de paint).
// Mantenerlos sincronizados con los valores del token correspondiente.
const FALLBACK_MS: Record<MotionDurationToken, number> = {
  instant: 80,
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
  pulse: 600,
  flash: 700,
  spin: 800,
  warm: 1000,
  loading: 1500
}

// Cache de valores leídos. Una vez que el CSS responde con un valor real,
// lo congelamos para no hacer reflow en cada llamada. Si querés invalidar
// la cache (cambiaste un token en runtime), llamá `__resetMotionCacheForTests()`.
const cache: Partial<Record<MotionDurationToken, number>> = {}

function leerDelDom(token: MotionDurationToken): number | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return null
  }
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(`--duration-${token}`)
      .trim()
    if (!raw) return null
    if (raw.endsWith('ms')) {
      const n = Number.parseFloat(raw)
      return Number.isFinite(n) ? n : null
    }
    if (raw.endsWith('s')) {
      const n = Number.parseFloat(raw) * 1000
      return Number.isFinite(n) ? n : null
    }
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Devuelve la duración en milisegundos del token motion indicado.
 *
 * Lazy: la primera lectura intenta el DOM; si responde, cachea el valor.
 * Si el DOM aún no está disponible, devuelve el fallback PERO no cachea —
 * la siguiente llamada vuelve a intentar leer el DOM.
 *
 * Ideal para `setTimeout` que debe sincronizarse con el final de una
 * animación CSS, sin riesgo de leer fallback estático en module-load.
 */
export function getMotionDurationMs(token: MotionDurationToken): number {
  if (cache[token] !== undefined) return cache[token]!
  const real = leerDelDom(token)
  if (real !== null) {
    cache[token] = real
    return real
  }
  // No cacheamos el fallback — queremos volver a intentar la próxima vez.
  return FALLBACK_MS[token]
}

/** Solo para tests — limpia la cache para que la siguiente lectura vuelva
 *  a consultar el DOM. */
export function __resetMotionCacheForTests(): void {
  for (const k of Object.keys(cache)) {
    delete cache[k as MotionDurationToken]
  }
}
