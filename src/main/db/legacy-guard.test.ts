// Tests del guard contra DBs de versiones anteriores. Cubre:
//   - DB nueva (sin __drizzle_migrations) → no hace nada
//   - DB con migraciones que coinciden con el journal actual → no hace nada
//   - DB legacy (hashes registrados que NO están en el journal actual) →
//     pide confirmación, hace backup, dropea tablas
//   - User cancela el dialog → throw expected error
//
// El dialog se inyecta como dependencia para evitar mostrar el dialog
// nativo durante los tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createHash } from 'crypto'
import { verificarYRepararLegacy, __testing__ } from './legacy-guard'

vi.mock('electron', () => ({
  dialog: { showMessageBoxSync: vi.fn(() => 0) }
}))

// Necesitamos better-sqlite3 directamente para crear DBs sintéticas.
// Probamos con el mismo binding que los tests de DB nativos.
let BetterSqlite3: typeof import('better-sqlite3') | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('better-sqlite3')
  const probe = new mod(':memory:')
  probe.close()
  BetterSqlite3 = mod
} catch {
  BetterSqlite3 = null
}

const ABI_AVAILABLE = BetterSqlite3 !== null

function hashOf(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

describe.runIf(ABI_AVAILABLE)('legacy-guard', () => {
  let tmpRoot: string
  let migrationsFolder: string

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'legacy-guard-'))
    migrationsFolder = join(tmpRoot, 'migrations')
    mkdirSync(join(migrationsFolder, 'meta'), { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  /** Crea un journal con N migraciones cuyos archivos .sql son strings dados. */
  function setupMigrations(migraciones: { tag: string; sql: string }[]): void {
    const entries = migraciones.map((m, i) => ({
      idx: i,
      version: '6',
      when: 1000000 + i,
      tag: m.tag,
      breakpoints: true
    }))
    writeFileSync(
      join(migrationsFolder, 'meta/_journal.json'),
      JSON.stringify({ version: '7', dialect: 'sqlite', entries })
    )
    for (const m of migraciones) {
      writeFileSync(join(migrationsFolder, `${m.tag}.sql`), m.sql)
    }
  }

  /**
   * Crea una DB con `__drizzle_migrations` poblada con los hashes dados.
   * Simula DBs reales que registraron hashes específicos.
   */
  function setupDb(hashes: string[], conTablas = true): { sqlite: import('better-sqlite3').Database; dbPath: string } {
    if (!BetterSqlite3) throw new Error('better-sqlite3 not available')
    const dbPath = join(tmpRoot, `test-${Math.random().toString(36).slice(2)}.db`)
    const sqlite = new BetterSqlite3(dbPath)
    sqlite.pragma('foreign_keys = ON')
    if (hashes.length > 0) {
      sqlite.exec(`
        CREATE TABLE __drizzle_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT NOT NULL,
          created_at NUMERIC
        )
      `)
      const insert = sqlite.prepare<unknown[]>(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
      )
      for (const h of hashes) insert.run(h, Date.now())
    }
    if (conTablas) {
      // Simulamos un par de tablas de negocio con datos para verificar que
      // el guard las cuenta y luego las dropea.
      sqlite.exec(`CREATE TABLE clientes (id INTEGER PRIMARY KEY, nombre TEXT)`)
      sqlite.exec(`CREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER)`)
      sqlite.exec(`CREATE TABLE facturas (id INTEGER PRIMARY KEY, pedido_id INTEGER)`)
      sqlite.prepare(`INSERT INTO clientes (nombre) VALUES (?)`).run('Test')
      sqlite.prepare(`INSERT INTO pedidos (cliente_id) VALUES (?)`).run(1)
    }
    return { sqlite, dbPath }
  }

  it('DB nueva (sin __drizzle_migrations) no hace nada', () => {
    setupMigrations([{ tag: '0000_v2', sql: 'CREATE TABLE x ()' }])
    const { sqlite, dbPath } = setupDb([], false)
    const result = verificarYRepararLegacy(sqlite, dbPath, migrationsFolder)
    expect(result.accion).toBe('sin_cambios')
    sqlite.close()
  })

  it('DB con __drizzle_migrations vacía no hace nada', () => {
    setupMigrations([{ tag: '0000_v2', sql: 'CREATE TABLE x ()' }])
    const { sqlite, dbPath } = setupDb([], false)
    sqlite.exec(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at NUMERIC
      )
    `)
    const result = verificarYRepararLegacy(sqlite, dbPath, migrationsFolder)
    expect(result.accion).toBe('sin_cambios')
    sqlite.close()
  })

  it('DB cuyas migraciones registradas coinciden con el journal actual no hace nada', () => {
    const sql = 'CREATE TABLE x (id INTEGER)'
    setupMigrations([{ tag: '0000_v2', sql }])
    const hash = hashOf(sql)
    const { sqlite, dbPath } = setupDb([hash], false)
    const result = verificarYRepararLegacy(sqlite, dbPath, migrationsFolder)
    expect(result.accion).toBe('sin_cambios')
    sqlite.close()
  })

  it('DB con hashes legacy (no en journal actual) → pide confirmación, hace backup y dropea tablas', () => {
    setupMigrations([{ tag: '0000_consolidado', sql: 'CREATE TABLE clientes (id INTEGER)' }])
    // DB con hashes que ya no existen en el journal actual
    const { sqlite, dbPath } = setupDb(['hashViejo1', 'hashViejo2', 'hashViejo3'], true)

    type DialogOpts = { clientes: number; pedidos: number; facturas: number; backupPath: string }
    let dialogArgs: DialogOpts | null = null
    const dialogSpy = vi.fn((opts: DialogOpts) => {
      dialogArgs = opts
      return 'reset' as const
    })
    const result = verificarYRepararLegacy(sqlite, dbPath, migrationsFolder, dialogSpy)

    // Debe haber pedido confirmación con el conteo correcto
    expect(dialogSpy).toHaveBeenCalledOnce()
    expect(dialogArgs).not.toBeNull()
    expect(dialogArgs!.clientes).toBe(1)
    expect(dialogArgs!.pedidos).toBe(1)
    expect(dialogArgs!.facturas).toBe(0)

    // Backup creado
    expect(result.accion).toBe('reseteo')
    if (result.accion === 'reseteo') {
      expect(existsSync(result.backupPath)).toBe(true)
      // El backup debe contener los datos originales
      const backup = readFileSync(result.backupPath)
      expect(backup.length).toBeGreaterThan(0)
    }

    // Tablas dropeadas (incluida __drizzle_migrations)
    const tablasRestantes = sqlite
      .prepare<unknown[], { name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all()
    expect(tablasRestantes).toHaveLength(0)

    sqlite.close()
  })

  it('DB legacy + user cancela → no dropea nada y devuelve cancelado', () => {
    setupMigrations([{ tag: '0000_consolidado', sql: 'CREATE TABLE clientes (id INTEGER)' }])
    const { sqlite, dbPath } = setupDb(['hashViejo1'], true)

    const dialogSpy = vi.fn(() => 'cancelar' as const)
    const result = verificarYRepararLegacy(sqlite, dbPath, migrationsFolder, dialogSpy)

    expect(result.accion).toBe('cancelado_por_usuario')

    // Las tablas siguen ahí
    const clientes = sqlite
      .prepare<unknown[], { n: number }>(`SELECT COUNT(*) as n FROM clientes`)
      .get()
    expect(clientes?.n).toBe(1)

    sqlite.close()
  })

  it('hashMigracionSQL devuelve el SHA256 correcto del archivo', () => {
    const sql = 'CREATE TABLE foo (id INTEGER)'
    writeFileSync(join(migrationsFolder, 'test_tag.sql'), sql)
    const hash = __testing__.hashMigracionSQL(migrationsFolder, 'test_tag')
    expect(hash).toBe(hashOf(sql))
  })

  it('hashMigracionSQL devuelve null si el archivo no existe', () => {
    expect(__testing__.hashMigracionSQL(migrationsFolder, 'no_existe')).toBeNull()
  })

  it('contarDatosNegocio devuelve 0 si las tablas no existen', () => {
    if (!BetterSqlite3) return
    const sqlite = new BetterSqlite3(':memory:')
    const conteo = __testing__.contarDatosNegocio(sqlite)
    expect(conteo).toEqual({ pedidos: 0, facturas: 0, clientes: 0 })
    sqlite.close()
  })

  it('dropAllTables borra todas las tablas pero respeta sqlite_*', () => {
    if (!BetterSqlite3) return
    const sqlite = new BetterSqlite3(':memory:')
    sqlite.exec(`CREATE TABLE foo (id INTEGER)`)
    sqlite.exec(`CREATE TABLE bar (id INTEGER)`)
    sqlite.exec(`CREATE TABLE __drizzle_migrations (id INTEGER, hash TEXT)`)

    __testing__.dropAllTables(sqlite)

    const tablas = sqlite
      .prepare<unknown[], { name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all()
    expect(tablas).toHaveLength(0)
    sqlite.close()
  })
})
