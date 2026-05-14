// Predicados runtime compartidos para validar payloads que entran al
// renderer desde fuentes no confiables (localStorage drafts, parámetros
// de URL, payloads de IPC en boundary, etc.).
//
// Política unificada: cuando un campo no pasa, el validador del caller
// devuelve `null`/`undefined` y descarta el payload entero. Sanear
// parcialmente confunde más al usuario que perder el draft — un input
// malformado a mitad de la estructura significa que el resto puede
// estar igualmente corrupto.
//
// Antes de este módulo, los predicados `esObjeto/esNumeroFinito/esString`
// vivían duplicados entre `wizard-data-validation.ts` y `draft-validation.ts`.
// Ese código se consolidó aquí; cualquier validador nuevo del proyecto
// debería usar estos primitivos para mantener el mismo nivel de rigor.

/**
 * `v` es un objeto plano no-null y no-array. Arrays los rechazamos
 * explícitamente porque `typeof [] === 'object'` y eso sería trampa
 * silenciosa cuando esperamos un objeto.
 */
export function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * `v` es un string. Con `maxLen` rechaza strings excesivamente largos
 * (defense contra payloads que intenten saturar memoria al renderizar
 * o exceder columnas de DB después).
 */
export function esString(v: unknown, opts?: { maxLen?: number }): v is string {
  if (typeof v !== 'string') return false
  if (opts?.maxLen != null && v.length > opts.maxLen) return false
  return true
}

/**
 * `v` es un string no-vacío después de `.trim()`. Para campos
 * obligatorios donde "  " no debe pasar como válido. Misma opción de
 * `maxLen`.
 */
export function esStringNoVacio(v: unknown, opts?: { maxLen?: number }): v is string {
  if (!esString(v, opts)) return false
  return v.trim().length > 0
}

/**
 * `v` es number finito (excluye `NaN`, `Infinity`, `-Infinity`). Opts:
 * - `min`, `max`: rango inclusivo
 * - `entero`: rechazar decimales
 */
export function esNumeroFinito(
  v: unknown,
  opts?: { min?: number; max?: number; entero?: boolean }
): v is number {
  if (typeof v !== 'number') return false
  if (!Number.isFinite(v)) return false
  if (opts?.entero && !Number.isInteger(v)) return false
  if (opts?.min != null && v < opts.min) return false
  if (opts?.max != null && v > opts.max) return false
  return true
}

export function esBool(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

/**
 * `v` es uno de los valores enumerados. Type-guard que estrecha al
 * literal union del array.
 */
export function esEnum<T extends string>(v: unknown, valores: readonly T[]): v is T {
  return typeof v === 'string' && (valores as readonly string[]).includes(v)
}

/**
 * Valida un array donde cada elemento debe pasar por `validarItem`.
 * Si CUALQUIER elemento falla (validarItem retorna null/undefined),
 * devuelve `null` y el caller descarta el draft entero.
 *
 * Política "todo o nada": preferimos perder un draft completo a aceptar
 * uno con un item malformado que después crashea el render.
 *
 * Si `v` no es array, también devuelve `null`. Array vacío es válido y
 * devuelve `[]`.
 */
export function esArrayDe<T>(
  v: unknown,
  validarItem: (e: unknown) => T | null | undefined
): T[] | null {
  if (!Array.isArray(v)) return null
  const out: T[] = []
  for (const elem of v) {
    const validado = validarItem(elem)
    if (validado == null) return null
    out.push(validado)
  }
  return out
}
