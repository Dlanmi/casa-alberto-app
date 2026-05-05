// Guard para detectar y reparar bases de datos provenientes de versiones
// anteriores cuyo `__drizzle_migrations` registra hashes que ya no existen
// en el journal actual (típico cuando consolidamos varias migraciones en
// una sola, como sucedió en v2.0.0).
//
// Sin este guard, la app arranca, intenta aplicar la migración consolidada
// "0000_glorious_wraith", y `CREATE TABLE` falla porque las tablas ya
// existen — la app crashea con el error que vio el papá al actualizar
// desde 1.7.4 a 2.0.0.
//
// Comportamiento:
//   1. Lee `__drizzle_migrations` (si no existe → DB nueva, no hay nada que hacer)
//   2. Calcula los hashes del journal actual
//   3. Si hay hashes registrados que NO están en el journal actual → DB legacy
//   4. Crea backup automático con sufijo `.pre-vX-reset-{fecha}`
//   5. Muestra dialog al dueño explicando lo que va a pasar
//   6. Si acepta: drop todas las tablas + drop __drizzle_migrations
//   7. La migración normal corre después y crea todo desde cero
//
// Si el dueño rechaza el reset, la app cierra (cualquier intento de
// `CREATE TABLE` va a fallar igual).
import { dialog } from 'electron'
import { copyFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type Database from 'better-sqlite3'

type DrizzleJournalEntry = {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints?: boolean
}

type DrizzleJournal = {
  version: string
  dialect: string
  entries: DrizzleJournalEntry[]
}

/**
 * Calcula el SHA256 hexadecimal del archivo SQL de una migración. Drizzle
 * usa el mismo algoritmo para registrar el hash en `__drizzle_migrations`.
 */
function hashMigracionSQL(migrationsFolder: string, tag: string): string | null {
  try {
    const sql = readFileSync(join(migrationsFolder, `${tag}.sql`), 'utf-8')
    return createHash('sha256').update(sql).digest('hex')
  } catch {
    return null
  }
}

/**
 * Lee el journal de Drizzle (`meta/_journal.json`) y devuelve el set de
 * hashes esperados (los de las migraciones que el código actual conoce).
 */
function leerHashesEsperados(migrationsFolder: string): Set<string> {
  try {
    const raw = readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf-8')
    const journal = JSON.parse(raw) as DrizzleJournal
    const hashes = new Set<string>()
    for (const entry of journal.entries) {
      const h = hashMigracionSQL(migrationsFolder, entry.tag)
      if (h) hashes.add(h)
    }
    return hashes
  } catch {
    return new Set()
  }
}

/**
 * Lee los hashes registrados en `__drizzle_migrations`. Si la tabla no
 * existe (DB nueva), devuelve null para que el guard pueda saltearse.
 */
function leerHashesRegistrados(sqlite: Database.Database): string[] | null {
  try {
    const stmt = sqlite.prepare<unknown[], { hash: string }>(
      'SELECT hash FROM __drizzle_migrations ORDER BY id'
    )
    return stmt
      .all()
      .map((r) => (typeof r.hash === 'string' ? r.hash.trim() : ''))
      .filter((h) => h.length > 0)
  } catch {
    // Tabla no existe = DB nueva, no hay nada que reparar
    return null
  }
}

/**
 * Detecta si la DB tiene migraciones registradas que el código actual ya
 * no reconoce. Eso indica que la DB es de una versión anterior con journal
 * distinto al actual.
 */
function detectarDbLegacy(sqlite: Database.Database, migrationsFolder: string): boolean {
  const registrados = leerHashesRegistrados(sqlite)
  if (registrados === null || registrados.length === 0) return false

  const esperados = leerHashesEsperados(migrationsFolder)
  if (esperados.size === 0) return false // sin journal accesible, mejor no tocar

  // ¿Algún hash registrado no está en los esperados? → DB legacy
  return registrados.some((h) => !esperados.has(h))
}

// Whitelist de identifiers SQLite seguros para interpolación. Nuestras tablas
// reales siguen este patrón (snake_case alfanumérico). Cualquier nombre que
// no matchee se considera sospechoso y se rechaza — defensa primaria contra
// inyección vía nombres de tabla maliciosos en un sqlite_master tampered.
const IDENTIFIER_SQLITE_SEGURO = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Valida un identifier SQLite contra el whitelist y, si pasa, lo devuelve
 * con doble-comillas escapadas (segunda capa de defensa por si el regex
 * llega a alguna vez relajarse). Si no pasa, devuelve null para que el
 * caller decida (típicamente: log warning y skip la operación).
 *
 * Nunca interpolar nombres de tabla/columna dinámicos sin pasar por aquí.
 */
function quoteIdentifierSeguro(name: string): string | null {
  if (!IDENTIFIER_SQLITE_SEGURO.test(name)) return null
  // Escape estándar SQLite: `"` se duplica dentro del identifier quoteado.
  // Con el whitelist arriba esto es redundante, pero es defense in depth
  // para no depender de un solo control.
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Cuenta cuántas filas de tablas de negocio existen, para informarle al
 * dueño cuántos datos se van a perder si acepta el reset.
 *
 * Las tablas son literales hardcoded (no input externo), pero igual pasan
 * por `quoteIdentifierSeguro` para mantener la disciplina: en este archivo
 * NUNCA se interpola un identifier sin pasar por el helper.
 */
function contarDatosNegocio(sqlite: Database.Database): {
  pedidos: number
  facturas: number
  clientes: number
} {
  const safeCount = (table: string): number => {
    const ident = quoteIdentifierSeguro(table)
    if (!ident) return 0
    try {
      const r = sqlite
        .prepare<unknown[], { n: number }>(`SELECT COUNT(*) as n FROM ${ident}`)
        .get()
      return r?.n ?? 0
    } catch {
      return 0
    }
  }
  return {
    pedidos: safeCount('pedidos'),
    facturas: safeCount('facturas'),
    clientes: safeCount('clientes')
  }
}

/**
 * Borra todas las tablas de la DB y la tabla de control de migraciones,
 * dejándola lista para que el migrator de Drizzle aplique la migración
 * consolidada desde cero.
 *
 * Seguridad: los nombres vienen de `sqlite_master`, que es parte del archivo
 * .db en disco. Una DB tampered podría incluir nombres con comillas dobles
 * que rompan el identifier quoteado y conviertan `sqlite.exec()` en un sink
 * de SQL injection (acepta multi-statement). Para protegernos:
 *   1. Whitelist alfanumérico — rechaza cualquier name que no se vea
 *      "normal" antes de interpolarlo. Las tablas reales del esquema lo
 *      cumplen (`acudientes`, `clientes`, `pedidos`, etc.).
 *   2. Escape estándar de comillas dobles — segunda capa.
 *   3. Tablas que no pasan el filtro se loguean y se saltan, no se ignoran
 *      silenciosamente — así si alguien legítimamente agrega una tabla con
 *      caracteres no-ASCII queda visible en logs.
 *
 * Atomicidad: todo va en una transacción. Si algo falla en medio, la DB
 * queda como estaba y el caller puede restaurar desde el backup.
 */
function dropAllTables(sqlite: Database.Database): void {
  // try/finally garantiza que `foreign_keys` se restauren incluso si el
  // OFF mismo o la transacción tiran. Antes el OFF estaba fuera del try,
  // por lo que un fallo entre OFF y el inicio de la tx dejaba el pragma
  // desactivado en la conexión.
  let pragmaCambiado = false
  try {
    sqlite.pragma('foreign_keys = OFF')
    pragmaCambiado = true
    const tx = sqlite.transaction(() => {
      // Filtro doble: sólo `type='table'` (excluye triggers/views/indexes)
      // y `UPPER(sql) LIKE 'CREATE TABLE%'` para descartar entradas que no
      // son tablas reales aunque el campo `type` esté tampered. Defensa
      // contra sqlite_master con rows manualmente alteradas. Usamos UPPER
      // para no depender del default ASCII-case-insensitive de SQLite (que
      // podría desactivarse vía PRAGMA case_sensitive_like) y matchear SQL
      // generado con sintaxis en minúsculas (`create table foo ...`).
      const tablas = sqlite
        .prepare<unknown[], { name: string }>(
          `SELECT name FROM sqlite_master
           WHERE type='table'
             AND name NOT LIKE 'sqlite_%'
             AND UPPER(sql) LIKE 'CREATE TABLE%'`
        )
        .all()
      for (const t of tablas) {
        const ident = quoteIdentifierSeguro(t.name)
        if (!ident) {
          console.warn(
            `[legacy-guard] tabla con nombre no válido para drop: ${JSON.stringify(t.name)}`
          )
          continue
        }
        sqlite.exec(`DROP TABLE IF EXISTS ${ident}`)
      }
    })
    tx()
  } finally {
    if (pragmaCambiado) {
      try {
        sqlite.pragma('foreign_keys = ON')
      } catch (err) {
        // Si la restauración del pragma falla, no podemos hacer mucho —
        // logueamos y dejamos que el caller decida.
        console.error('[legacy-guard] no se pudo restaurar foreign_keys=ON:', err)
      }
    }
  }
}

export type ResultadoGuard =
  | { accion: 'sin_cambios' }
  | { accion: 'reseteo'; backupPath: string }
  | { accion: 'cancelado_por_usuario' }

/**
 * Punto de entrada del guard. Llamado por `runMigrations` antes del
 * `migrate(...)` real. Si detecta DB legacy, hace backup, pregunta al user,
 * y resetea la DB si el user acepta.
 *
 * @param sqlite              Conexión activa a la DB
 * @param dbPath              Ruta del archivo .db (para hacer backup)
 * @param migrationsFolder    Carpeta donde viven las migraciones del código actual
 * @param dialogShow          Función para mostrar diálogo (inyectable para tests)
 */
export function verificarYRepararLegacy(
  sqlite: Database.Database,
  dbPath: string,
  migrationsFolder: string,
  dialogShow: (opts: {
    pedidos: number
    facturas: number
    clientes: number
    backupPath: string
  }) => 'reset' | 'cancelar' = mostrarDialogoLegacyReset
): ResultadoGuard {
  if (!detectarDbLegacy(sqlite, migrationsFolder)) {
    return { accion: 'sin_cambios' }
  }

  // 1. Backup automático ANTES de cualquier modificación destructiva
  const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = `${dbPath}.pre-reset-${fecha}.bak`
  try {
    copyFileSync(dbPath, backupPath)
  } catch (err) {
    throw new Error(
      `No se pudo crear backup antes del reseteo: ${err instanceof Error ? err.message : err}`
    )
  }

  // 2. Resumen de datos para el diálogo
  const conteo = contarDatosNegocio(sqlite)

  // 3. Preguntar al dueño
  const decision = dialogShow({ ...conteo, backupPath })
  if (decision === 'cancelar') {
    // Limpiar el backup huérfano — sin reset, no tiene utilidad y se
    // acumularían si el usuario cancela varias veces. Antes quedaban
    // orphan en el dir userData sin ser listados por `listarBackups()`.
    try {
      unlinkSync(backupPath)
    } catch (err) {
      console.warn(
        `[legacy-guard] no se pudo limpiar backup orphan ${backupPath}: ${err instanceof Error ? err.message : err}`
      )
    }
    return { accion: 'cancelado_por_usuario' }
  }

  // 4. Drop everything — el migrator aplicará todo desde cero después
  dropAllTables(sqlite)
  return { accion: 'reseteo', backupPath }
}

/**
 * Diálogo nativo (default). Tests inyectan otra implementación para evitar
 * el dialog real. El mensaje está pensado para alguien NO técnico (papá).
 */
function mostrarDialogoLegacyReset(opts: {
  pedidos: number
  facturas: number
  clientes: number
  backupPath: string
}): 'reset' | 'cancelar' {
  const totalDatos = opts.pedidos + opts.facturas + opts.clientes
  const mensajeDatos =
    totalDatos === 0
      ? 'Tu base de datos está vacía, así que no se pierde nada.'
      : `Tienes ${opts.clientes} cliente(s), ${opts.pedidos} pedido(s) y ${opts.facturas} factura(s) cargados. Se reemplazarán por una base limpia.`

  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    title: 'Actualización de base de datos',
    message: 'La base de datos viene de una versión anterior y no es compatible con esta actualización.',
    detail:
      `${mensajeDatos}\n\n` +
      `Antes de continuar se guardará un respaldo automático en:\n${opts.backupPath}\n\n` +
      `¿Quieres resetear la base de datos y arrancar limpio? Es la opción recomendada.`,
    buttons: ['Sí, resetear (recomendado)', 'No, cerrar la app'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  return choice === 0 ? 'reset' : 'cancelar'
}

// Exports para tests: permiten probar la lógica sin tocar el dialog real
// ni el filesystem global.
export const __testing__ = {
  detectarDbLegacy,
  hashMigracionSQL,
  leerHashesEsperados,
  leerHashesRegistrados,
  contarDatosNegocio,
  dropAllTables,
  quoteIdentifierSeguro
}
