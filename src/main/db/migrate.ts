import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
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

export function runMigrations(db: DB): void {
  const migrationsFolder = resolveMigrationsFolder()
  if (!existsSync(migrationsFolder)) {
    console.warn(
      `[db] migrations folder not found at ${migrationsFolder} — run 'npm run db:generate'`
    )
    return
  }
  migrate(db, { migrationsFolder })
  console.log(`[db] migrations applied from ${migrationsFolder}`)
}
