import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync } from 'fs'
import type { DB } from './index'
import { getDbPath, getSqlite } from './index'
import { verificarYRepararLegacy } from './legacy-guard'

function resolveMigrationsFolder(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'drizzle')
  }
  const candidates = [
    join(__dirname, '../../src/main/db/migrations'),
    join(process.cwd(), 'src/main/db/migrations')
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return candidates[0]
}

function hayArchivosSQL(folder: string): boolean {
  try {
    return readdirSync(folder).some((f) => f.endsWith('.sql'))
  } catch {
    return false
  }
}

export function runMigrations(db: DB): void {
  const migrationsFolder = resolveMigrationsFolder()
  const carpetaExiste = existsSync(migrationsFolder)
  const tieneMigraciones = carpetaExiste && hayArchivosSQL(migrationsFolder)

  if (!tieneMigraciones) {
    // En producción esto es fatal: sin migraciones el esquema queda desalineado
    // y cada operación sobre la DB crashea. Preferimos morir rápido con un
    // mensaje claro que arrancar una app rota.
    if (app.isPackaged) {
      throw new Error(
        `Instalación corrupta: no se encontraron archivos de migración en ${migrationsFolder}. ` +
          `Reinstala la aplicación.`
      )
    }
    // En dev, seguir con warn — útil para algunos tests que no necesitan schema
    console.warn(
      `[db] migrations folder not found or empty at ${migrationsFolder} — run 'npm run db:generate'`
    )
    return
  }

  // Guard contra DBs de versiones anteriores cuyo `__drizzle_migrations`
  // registra hashes que ya no existen en el journal actual (caso v1.x → v2.0
  // donde consolidamos 5 migraciones en una). Sin este guard, `CREATE TABLE`
  // falla porque las tablas ya existen en la DB legacy.
  try {
    const resultado = verificarYRepararLegacy(getSqlite(), getDbPath(), migrationsFolder)
    if (resultado.accion === 'cancelado_por_usuario') {
      throw new Error(
        'Actualización cancelada por el usuario. La app no puede arrancar con la base de datos actual.'
      )
    }
    if (resultado.accion === 'reseteo') {
      console.log(`[db] DB legacy detectada y reseteada — backup: ${resultado.backupPath}`)
    }
  } catch (err) {
    // Si el guard falla por algo inesperado, dejamos que el migrator de Drizzle
    // intente aplicar normalmente. Si la DB es realmente legacy, va a fallar
    // con el error original (CREATE TABLE) y al menos el user verá ese
    // mensaje. Pero re-lanzamos el error de cancelación.
    if (err instanceof Error && err.message.includes('cancelada por el usuario')) {
      throw err
    }
    console.error('[db] guard de legacy falló, sigo con migración normal:', err)
  }

  migrate(db, { migrationsFolder })
  console.log(`[db] migrations applied from ${migrationsFolder}`)
}
