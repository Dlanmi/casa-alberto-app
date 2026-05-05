import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  copyFileSync,
  lstatSync,
  realpathSync
} from 'fs'
import { basename, join, resolve, sep } from 'path'
import Database from 'better-sqlite3'
import { getBackupsDir, getSqlite, getDbPath, closeDb, initDb } from './index'

/**
 * Sistema de backup automático.
 *
 * Los backups viven en `<userData>/backups/` con nombre del formato
 * `casa-alberto-YYYY-MM-DDTHH-mm.db`. Usamos `VACUUM INTO` de SQLite porque:
 *  - Crea un archivo .db limpio y válido (no toca el WAL)
 *  - Es transaccional: o el backup queda completo o no queda
 *  - Es una sola instrucción SQL, sin race conditions con escrituras activas
 *
 * Política de retención: mantenemos los 7 backups diarios más recientes. Si
 * hay más, borramos los más antiguos. Los archivos se cuentan por mtime, no
 * por fecha de nombre, para tolerar nombres anómalos.
 */

const RETENCION_MAX = 7

export type BackupInfo = {
  path: string
  nombre: string
  fecha: string // ISO de la fecha de creación (mtime)
  tamanoBytes: number
}

function sanitizeFilenamePart(date: Date): string {
  // 2026-04-15T12-30  (colon reemplazado por guión para compatibilidad Windows)
  return date.toISOString().slice(0, 16).replace(':', '-')
}

/**
 * Convierte un path absoluto a un literal SQL seguro para `VACUUM INTO 'path'`.
 *
 * `VACUUM INTO` no acepta bind parameters (es DDL en SQLite). Construimos el
 * literal con tres capas de defensa:
 *
 *   1. Rechaza caracteres de control (NUL, newline, TAB, etc.) — pueden
 *      partir la sentencia o engañar al parser.
 *   2. Rechaza caracteres no-imprimibles fuera del rango imprimible básico
 *      (excepto whitespace válido en paths como espacio).
 *   3. Escapa comilla simple duplicándola — estándar SQLite. El literal
 *      resultante es interpretado por SQLite hacia el filesystem con la
 *      comilla "real" intacta. Esto NO crea un path distinto; SQLite parsea
 *      `'foo''bar'` como path literal `foo'bar`.
 *
 * Si necesitas modelar otros caracteres rechazados, agrégalos a la regex —
 * mejor sobre-rechazar que dejar inyección abierta.
 */
function vacuumIntoLiteral(absPath: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(absPath)) {
    throw new Error('Ruta de backup contiene caracteres de control no permitidos')
  }
  // Rechazo extra: backticks y semicolons literales — no deberían existir
  // en paths del filesystem normales y agregan defensa contra payloads.
  if (/[`;]/.test(absPath)) {
    throw new Error('Ruta de backup contiene caracteres reservados (`;`)')
  }
  return `'${absPath.replace(/'/g, "''")}'`
}

// Exportado solo para tests — no usar desde código de producción.
export const __testing__ = { vacuumIntoLiteral }

function ensureBackupsDir(): string {
  const dir = getBackupsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Crea un backup del archivo de base de datos actual en el directorio de
 * backups. Retorna información del archivo creado.
 */
export function crearBackupAhora(): BackupInfo {
  const dir = ensureBackupsDir()
  const ahora = new Date()
  const nombre = `casa-alberto-${sanitizeFilenamePart(ahora)}.db`
  const destino = join(dir, nombre)

  // Si ya existe un backup con el mismo nombre (mismo minuto exacto), lo
  // sobreescribimos para evitar errores de VACUUM INTO. Es idempotente por
  // minuto — si el usuario hace clic "Crear ahora" dos veces en el mismo
  // minuto, queda solo el más reciente.
  if (existsSync(destino)) {
    unlinkSync(destino)
  }

  const sqlite = getSqlite()
  sqlite.exec(`VACUUM INTO ${vacuumIntoLiteral(destino)}`)

  const stats = statSync(destino)
  limpiarBackupsAntiguos()

  const info: BackupInfo = {
    path: destino,
    nombre,
    fecha: stats.mtime.toISOString(),
    tamanoBytes: stats.size
  }
  console.log(`[backup] creado: ${info.path} (${info.tamanoBytes} bytes)`)
  return info
}

/**
 * Lista los backups existentes ordenados por fecha descendente (más reciente
 * primero). Retorna array vacío si el directorio no existe.
 */
export function listarBackups(): BackupInfo[] {
  const dir = getBackupsDir()
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((nombre) => {
        const full = join(dir, nombre)
        const stats = statSync(full)
        return {
          path: full,
          nombre,
          fecha: stats.mtime.toISOString(),
          tamanoBytes: stats.size
        }
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  } catch (err) {
    console.error('[backup] error listando backups', err)
    return []
  }
}

/**
 * Restaura el backup indicado copiándolo sobre el archivo de base de datos
 * activo. Cierra la conexión actual, copia, y reabre. El llamador debe
 * refrescar cualquier estado cacheado en renderer.
 *
 * @deprecated Preferir `restaurarDesdeBackupPorId(id)`, que no requiere
 * que el renderer envíe paths del filesystem. Esta función sigue
 * disponible por compatibilidad y mantiene la validación de path.
 */
/**
 * Valida un archivo SQLite ANTES de usarlo como source de restore.
 *
 * Estrategia: abrimos el archivo en read-only y corremos `PRAGMA integrity_check`.
 * SQLite devuelve `'ok'` cuando el archivo está sano; cualquier otra cosa
 * indica páginas corruptas, índices inconsistentes, etc. Cerramos la
 * conexión inmediatamente — el caller decide qué hacer con el resultado.
 *
 * Lo hacemos antes del `copyFileSync` para no tocar la DB destino con
 * un archivo enfermo. Si el backup pasa este check, la copia es segura
 * (asumiendo disco OK).
 */
function validarIntegridadDb(filePath: string): { ok: true } | { ok: false; razon: string } {
  let db: Database.Database | null = null
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true })
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined
    const result = row?.integrity_check ?? 'sin respuesta'
    if (result === 'ok') return { ok: true }
    return { ok: false, razon: result }
  } catch (err) {
    return { ok: false, razon: err instanceof Error ? err.message : String(err) }
  } finally {
    db?.close()
  }
}

export function restaurarDesdeBackup(backupPath: string): void {
  const realPath = validarPathSeguro(backupPath, getBackupsDir(), 'backup')

  // 1. Validar el backup ANTES de tocar la DB destino. Si está corrupto,
  //    fallamos rápido sin afectar el archivo activo. Antes este check
  //    sucedía DESPUÉS del copy (vía `initDb` interno), forzando un ciclo
  //    copy→fail→rollback innecesario.
  const integridad = validarIntegridadDb(realPath)
  if (!integridad.ok) {
    throw new Error(
      `El archivo de respaldo no pasó la verificación de integridad: ${integridad.razon}`
    )
  }

  const dbPath = getDbPath()
  const preRestorePath = `${dbPath}.pre-restore`
  // 2. Snapshot del estado actual — defensa adicional contra fallos del
  //    filesystem (disco lleno mid-copy, permisos perdidos).
  if (existsSync(dbPath)) {
    copyFileSync(dbPath, preRestorePath)
  }
  // 3. Cerrar la conexión activa antes de sobrescribir el archivo. En
  //    Windows los handles son exclusivos — sin esto, `copyFileSync`
  //    falla con EBUSY/EPERM.
  closeDb()
  try {
    copyFileSync(realPath, dbPath)
    initDb()
    console.log(`[backup] restaurado desde ${realPath}`)
    // 4. Limpiar pre-restore tras éxito — sin esto se acumulaba en disco.
    //    El backup original (`realPath`) sigue intacto; solo borramos el
    //    snapshot temporal que hicimos antes del copy.
    try {
      if (existsSync(preRestorePath)) unlinkSync(preRestorePath)
    } catch (cleanupErr) {
      console.warn('[backup] no se pudo limpiar pre-restore:', cleanupErr)
    }
  } catch (err) {
    // Rollback: si tenemos pre-restore válido, lo copiamos de vuelta y
    // re-inicializamos con la DB anterior. Como ya validamos integridad
    // arriba, llegar aquí indica un problema del filesystem, no del backup.
    console.error('[backup] restore falló, intentando rollback:', err)
    let rollbackOk = false
    try {
      if (existsSync(preRestorePath)) {
        copyFileSync(preRestorePath, dbPath)
        initDb()
        rollbackOk = true
        console.log('[backup] rollback OK — DB restaurada al estado pre-restore')
        // El pre-restore queda en disco como red de seguridad adicional;
        // el siguiente restore exitoso lo limpia. Evita perderlo si el
        // dueño quiere copiarlo manualmente.
      }
    } catch (rollbackErr) {
      console.error('[backup] rollback también falló:', rollbackErr)
    }
    if (!rollbackOk) {
      // Caso peor: original corrupto + rollback fallido. Anotamos paths
      // explícitos para que el dueño pueda recuperar manualmente. NO
      // tiramos el rollbackErr — el caller necesita el `err` original
      // que explica qué pasó primero.
      const original = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Restauración falló y rollback automático no pudo completarse. ` +
          `Backup original: "${realPath}". Snapshot anterior: "${preRestorePath}". ` +
          `Error: ${original}`
      )
    }
    throw err
  }
}

/**
 * Restaura el backup identificado por su nombre de archivo (ej:
 * "backup-2026-04-25T10-15-00.db"). El renderer obtiene esta lista vía
 * `listarBackups()` y referencia los items por nombre — nunca por path.
 * Internamente resolvemos el path contra `getBackupsDir()` y validamos
 * con el mismo guard que la versión legacy. Esto evita que un renderer
 * comprometido o un payload malformado envíe rutas arbitrarias del FS.
 *
 * Rechaza nombres con separadores (`/`, `\`), `.` o `..` aunque el guard
 * subsiguiente también los rechace — el chequeo sintáctico permite errores
 * más claros y reduce trabajo del filesystem.
 */
export function restaurarDesdeBackupPorId(id: string): void {
  if (typeof id !== 'string' || id.length === 0 || id.length > 256) {
    throw new Error('Identificador de backup inválido')
  }
  if (id.includes('/') || id.includes('\\') || id === '.' || id === '..') {
    throw new Error('Identificador de backup inválido')
  }
  const fullPath = join(getBackupsDir(), id)
  // validarPathSeguro hace los guards definitivos (textual + symlink + realpath).
  restaurarDesdeBackup(fullPath)
}

/**
 * Valida que `rawPath` apunta a un archivo regular dentro de `allowedDirRaw`,
 * bloqueando path traversal Y symlinks. Retorna la ruta canonicalizada
 * (symlinks resueltos) lista para usarse en I/O.
 *
 * Por qué rechazamos symlinks: resolve() normaliza '..' pero NO sigue
 * symlinks, mientras que copyFileSync y shell.openPath SÍ los siguen. Un
 * attacker que controle el renderer podría crear un symlink dentro del
 * directorio permitido apuntando a /etc/passwd (u otro archivo sensible)
 * y burlaría la comparación textual.
 *
 * El dueño de una marquetería no tiene caso de uso legítimo para symlinks
 * dentro de la carpeta de backups o PDFs, así que rechazarlos no bloquea
 * nada real.
 *
 * Al usuario siempre se le muestra el mismo mensaje ("Ruta de X inválida")
 * para no filtrar detalles técnicos. El motivo real queda en console.warn
 * para que yo pueda debuggear si aparece algún falso positivo.
 *
 * Copia idéntica de este helper existe en src/main/pdf/factura-pdf.ts. Si
 * modificás uno, actualizá el otro — los tests cubren ambos paths.
 */
function validarPathSeguro(rawPath: string, allowedDirRaw: string, recurso: string): string {
  const mensajeUsuario = `Ruta de ${recurso} inválida`
  const allowedDir = resolve(allowedDirRaw)
  const resolvedTextual = resolve(rawPath)

  // Guard 1 (textual): resolve() normaliza '..' pero no sigue symlinks.
  if (!resolvedTextual.startsWith(allowedDir + sep)) {
    console.warn(`[security] ${recurso} fuera de directorio permitido:`, basename(resolvedTextual))
    throw new Error(mensajeUsuario)
  }

  // Guard 2: existencia + tipo en una sola syscall. lstat NO sigue symlinks
  // (a diferencia de stat), así que detecta el link mismo.
  let linkStat
  try {
    linkStat = lstatSync(resolvedTextual)
  } catch {
    throw new Error(`Archivo de ${recurso} no encontrado`)
  }
  if (linkStat.isSymbolicLink()) {
    console.warn(`[security] ${recurso} es un symlink, rechazado:`, basename(resolvedTextual))
    throw new Error(mensajeUsuario)
  }
  if (!linkStat.isFile()) {
    console.warn(`[security] ${recurso} no es archivo regular:`, basename(resolvedTextual))
    throw new Error(mensajeUsuario)
  }

  // Guard 3: canonicalizar ambos lados con realpathSync. Necesario en macOS
  // porque `/var` es symlink a `/private/var` — sin canonicalizar ambos
  // lados, archivos válidos se rechazarían en macOS. Si `allowedDir` no
  // existe aún (caso raro: primera ejecución antes de crear backup),
  // caemos a la comparación textual del guard 1 que ya pasó.
  try {
    const realAllowed = realpathSync(allowedDir)
    const realPath = realpathSync(resolvedTextual)
    if (!realPath.startsWith(realAllowed + sep)) {
      console.warn(`[security] ${recurso} apunta fuera tras resolver symlinks:`, basename(realPath))
      throw new Error(mensajeUsuario)
    }
    return realPath
  } catch (err) {
    if (err instanceof Error && err.message === mensajeUsuario) throw err
    // allowedDir no existe aún — el guard 1 ya validó textualmente y el
    // guard 2 confirmó que no hay symlink. Seguro usar la ruta resuelta.
    return resolvedTextual
  }
}

/**
 * Elimina backups viejos más allá de la política de retención. Mantiene los
 * RETENCION_MAX más recientes por mtime.
 */
export function limpiarBackupsAntiguos(): number {
  const backups = listarBackups()
  if (backups.length <= RETENCION_MAX) return 0
  const sobrantes = backups.slice(RETENCION_MAX)
  let eliminados = 0
  for (const b of sobrantes) {
    try {
      unlinkSync(b.path)
      eliminados++
    } catch (err) {
      console.error(`[backup] no se pudo borrar ${b.path}`, err)
    }
  }
  if (eliminados > 0) {
    console.log(`[backup] limpiados ${eliminados} backups antiguos`)
  }
  return eliminados
}

/**
 * Retorna el backup más reciente o null si no hay ninguno. Usado por el
 * indicador del sidebar para mostrar "Respaldo: hace Xh".
 */
export function obtenerUltimoBackup(): BackupInfo | null {
  return listarBackups()[0] ?? null
}
