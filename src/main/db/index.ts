import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app, dialog } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, readdirSync, statSync } from 'fs'
import * as schema from './schema'

let _sqlite: Database.Database | null = null
let _db: BetterSQLite3Database<typeof schema> | null = null

export type DB = BetterSQLite3Database<typeof schema>

// C-03 — Rutas públicas para que el módulo de backup (Fase C) escriba y
// lea los respaldos en el mismo directorio que usa el recovery.
export function getDbPath(): string {
  return join(app.getPath('userData'), 'casa-alberto.db')
}

export function getBackupsDir(): string {
  return join(app.getPath('userData'), 'backups')
}

/**
 * Abre la DB, activa WAL + foreign keys, corre integrity_check. Si algo
 * falla lanza error (el caller decide si recuperar desde backup).
 */
function openAndCheck(dbPath: string): Database.Database {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const integrity = sqlite.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    sqlite.close()
    throw new Error(`DB integrity check failed: ${String(integrity)}`)
  }
  return sqlite
}

/**
 * Busca el backup más reciente en <userData>/backups. Retorna null si
 * el directorio no existe o no hay archivos .db.
 */
function findMostRecentBackup(): string | null {
  const dir = getBackupsDir()
  if (!existsSync(dir)) return null
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const full = join(dir, f)
        return { path: full, mtime: statSync(full).mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
    return files[0]?.path ?? null
  } catch (err) {
    console.error('[db] error leyendo directorio de backups', err)
    return null
  }
}

/**
 * C-03 — Inicializa la DB con recovery automático. Si la DB principal
 * está corrupta, busca el backup más reciente y lo restaura. Si tampoco
 * hay backup o el backup también está dañado, muestra un dialog al
 * usuario con instrucciones y aborta el arranque.
 */
export function initDb(): DB {
  if (_db) return _db
  const dbPath = getDbPath()

  try {
    _sqlite = openAndCheck(dbPath)
  } catch (primaryErr) {
    console.error('[db] base de datos corrupta, intentando recuperar desde backup', primaryErr)

    const backupPath = findMostRecentBackup()
    if (!backupPath) {
      dialog.showErrorBox(
        'Base de datos dañada',
        'La base de datos de Casa Alberto está dañada y no hay respaldos disponibles para restaurarla. ' +
          'Contacta al soporte técnico (tu hijo) antes de continuar usando la app. ' +
          `\n\nUbicación del archivo: ${dbPath}`
      )
      throw primaryErr
    }

    try {
      copyFileSync(backupPath, dbPath)
      _sqlite = openAndCheck(dbPath)
      console.log(`[db] base de datos recuperada desde backup: ${backupPath}`)
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Base de datos restaurada',
        message: 'Se restauró la base de datos desde el respaldo más reciente.',
        detail:
          `Respaldo usado: ${backupPath}\n\n` +
          'Revisa si hay trabajo reciente (pedidos, facturas, cotizaciones) ' +
          'que necesites volver a ingresar.',
        buttons: ['Entendido']
      })
    } catch (recoveryErr) {
      console.error('[db] el respaldo también falló al restaurarse', recoveryErr)
      dialog.showErrorBox(
        'No se pudo restaurar la base de datos',
        'La base de datos está dañada y el respaldo más reciente tampoco funcionó. ' +
          'Contacta al soporte técnico (tu hijo) antes de continuar. ' +
          `\n\nBase de datos: ${dbPath}\nRespaldo probado: ${backupPath}`
      )
      throw recoveryErr
    }
  }

  _db = drizzle(_sqlite, { schema })
  console.log(`[db] initialized at ${dbPath}`)
  return _db
}

export function getDb(): DB {
  if (!_db) throw new Error('DB not initialized — call initDb() first')
  return _db
}

export function getSqlite(): Database.Database {
  if (!_sqlite) throw new Error('DB not initialized — call initDb() first')
  return _sqlite
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}
