import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync } from 'fs'
import type { DB } from './index'

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
  migrate(db, { migrationsFolder })
  console.log(`[db] migrations applied from ${migrationsFolder}`)
}
