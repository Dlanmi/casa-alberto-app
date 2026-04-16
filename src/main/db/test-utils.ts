// Test-only helpers. NEVER imported from production code.
// Used by Vitest suites that need a real SQLite instance to exercise
// query-layer functions that take `db: DB`. We bypass `src/main/db/index.ts`
// because it pulls in `electron.app.getPath` which is undefined under Vitest.
//
// IMPORTANT: this repo uses `better-sqlite3` rebuilt for the Electron ABI
// via `electron-builder install-app-deps` (see package.json postinstall).
// Under Vitest (plain Node), the binding may fail to load with a
// NODE_MODULE_VERSION mismatch. When that happens we report via
// `nativeAbiAvailable = false` so the DB-backed suites can skip themselves
// instead of turning the whole suite red. To actually run the DB tests:
//   1. `npm rebuild better-sqlite3 --build-from-source` (rebuild for Node)
//   2. `npm test -- --run`
//   3. `npx electron-builder install-app-deps` (restore Electron ABI)
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'path'
import * as schema from './schema'
import type { DB } from './index'

// Attempt to load AND instantiate the native binding once at module init.
// Just requiring the module isn't enough — the JS wrapper loads fine even when
// the .node binary is built for a different ABI; the failure happens on first
// `new Database()`. So we open a throwaway in-memory DB to verify the binding
// is actually usable.
let BetterSqlite3: typeof import('better-sqlite3') | null = null
let nativeAbiError: Error | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('better-sqlite3')
  const probe = new mod(':memory:')
  probe.close()
  BetterSqlite3 = mod
} catch (err) {
  nativeAbiError = err instanceof Error ? err : new Error(String(err))
}

export const nativeAbiAvailable = BetterSqlite3 !== null

export function getNativeAbiError(): Error | null {
  return nativeAbiError
}

/**
 * Creates a brand-new in-memory SQLite DB with:
 *  - foreign_keys ON
 *  - all Drizzle migrations applied
 *
 * Each test should call this in `beforeEach` to get isolation.
 *
 * Throws if the native `better-sqlite3` binding is built for a different
 * NODE_MODULE_VERSION than the current runtime. Guard your test suite with
 * `describe.runIf(nativeAbiAvailable)` to skip cleanly when this happens.
 */
export function createTestDb(): {
  db: DB
  sqlite: InstanceType<NonNullable<typeof BetterSqlite3>>
} {
  if (!BetterSqlite3) {
    throw nativeAbiError ?? new Error('better-sqlite3 native binding not available')
  }
  const sqlite = new BetterSqlite3(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  const migrationsFolder = resolve(__dirname, 'migrations')
  migrate(db, { migrationsFolder })
  return { db, sqlite }
}
