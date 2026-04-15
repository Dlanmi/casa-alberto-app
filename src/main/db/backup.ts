import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs'
import { join } from 'path'
import { getBackupsDir, getSqlite, getDbPath, closeDb, initDb } from './index'

/**
 * C-02 — Sistema de backup automático.
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
  // Escape de comillas simples para SQL literal seguro
  const sqlSafePath = destino.replace(/'/g, "''")
  sqlite.exec(`VACUUM INTO '${sqlSafePath}'`)

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
 */
export function restaurarDesdeBackup(backupPath: string): void {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup no encontrado: ${backupPath}`)
  }
  const dbPath = getDbPath()
  // Crear backup de seguridad de la DB actual ANTES de sobrescribirla, por si
  // el usuario se arrepiente. Guardado con sufijo `.pre-restore`.
  if (existsSync(dbPath)) {
    copyFileSync(dbPath, `${dbPath}.pre-restore`)
  }
  closeDb()
  copyFileSync(backupPath, dbPath)
  initDb()
  console.log(`[backup] restaurado desde ${backupPath}`)
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
