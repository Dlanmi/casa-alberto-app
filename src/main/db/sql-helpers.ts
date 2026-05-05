// Helpers SQL compartidos entre queries. Centralizados aquí para que
// haya una sola fuente de verdad: cualquier consulta nueva que reciba un
// string del usuario y lo use en LIKE debe pasar por aquí.

/**
 * Escapa caracteres especiales de LIKE en SQLite (`%`, `_`, `\\`) para que
 * un usuario que busca literalmente "50%" no termine activando el wildcard
 * y trayendo cualquier cosa con "50" + N caracteres.
 *
 * El caller DEBE concatenar con `%...%` (o el wrap que use) y pasar al
 * `like()` de Drizzle con la cláusula `ESCAPE '\\'`.
 *
 * Tabla de escapes:
 *   `%`  → `\\%`     (cualquier secuencia)
 *   `_`  → `\\_`     (un solo carácter)
 *   `\\` → `\\\\`    (el escape mismo)
 *
 * Por compatibilidad con `drizzle-orm/sqlite`, retornamos solo el string
 * escapado — la cláusula ESCAPE se inyecta en cada call-site con `sql`
 * porque Drizzle no expone una helper para LIKE-with-escape directamente.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * Construye el patrón completo para una búsqueda "contiene": `%input%`
 * con escapes aplicados al input. Atajo común para call-sites que solo
 * quieren contains-search.
 *
 * Si el input está vacío después de trim, lanza error — un patrón `%%`
 * matchea TODA la tabla, lo que probablemente es un bug del caller (debió
 * validar antes y no llamar a este helper). Si realmente quieres "todo",
 * omite la condición LIKE en lugar de usar pattern vacío.
 */
export function buildContainsPattern(input: string): string {
  if (input.trim().length === 0) {
    throw new Error(
      'buildContainsPattern: input vacío matchearía toda la tabla. Valida upstream.'
    )
  }
  return `%${escapeLikePattern(input)}%`
}
