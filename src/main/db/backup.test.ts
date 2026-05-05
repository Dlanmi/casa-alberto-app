// Regression tests for the A1 path-traversal guard added to
// `restaurarDesdeBackup`. The guard rejects any path outside of
// `getBackupsDir()` so a compromised renderer cannot copy arbitrary files
// over the live SQLite database.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { __testing__, restaurarDesdeBackup, restaurarDesdeBackupPorId } from './backup'
import { nativeAbiAvailable } from './test-utils'

// Helper: crea un archivo SQLite válido (con tabla mínima) en `path`.
// Necesario porque desde FIX-PEND1 `restaurarDesdeBackup` valida integridad
// del backup ANTES de copiarlo — un dummy con texto plano falla la
// validación. Los tests que verifican el FLUJO completo de restore
// requieren un backup real, no solo un archivo presente.
function crearBackupSqliteValido(path: string): void {
  // Importación local diferida — solo si el ABI nativo está disponible.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  const db = new Database(path)
  db.exec('CREATE TABLE __test (id INTEGER); INSERT INTO __test VALUES (1);')
  db.close()
}

let tmpRoot = ''
let backupsDir = ''
let dbPath = ''

vi.mock('./index', () => {
  return {
    getBackupsDir: () => backupsDir,
    getDbPath: () => dbPath,
    getSqlite: () => ({}),
    closeDb: vi.fn(),
    initDb: vi.fn()
  }
})

describe('restaurarDesdeBackup — path traversal guard (A1)', () => {
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'casa-alberto-test-'))
    backupsDir = join(tmpRoot, 'backups')
    dbPath = join(tmpRoot, 'casa-alberto.db')
    // El directorio debe existir para que los paths resuelvan igual en mac/linux
    writeFileSync(dbPath, 'dummy-db')
    // Crear el dir de backups
    mkdirSync(backupsDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('rechaza /etc/passwd aunque exista', () => {
    expect(() => restaurarDesdeBackup('/etc/passwd')).toThrow(/Ruta de backup inválida/i)
  })

  it('rechaza path que escapa via ../../', () => {
    const escape = join(backupsDir, '..', '..', 'tmp', 'evil.db')
    expect(() => restaurarDesdeBackup(escape)).toThrow(/Ruta de backup inválida/i)
  })

  it('rechaza path absoluto fuera del directorio de backups', () => {
    const otroTmp = join(tmpRoot, 'otro', 'backup.db')
    expect(() => restaurarDesdeBackup(otroTmp)).toThrow(/Ruta de backup inválida/i)
  })

  it.runIf(nativeAbiAvailable)('acepta un backup válido dentro del directorio permitido', () => {
    const validBackup = join(backupsDir, 'casa-alberto-2026-04-16T12-00.db')
    crearBackupSqliteValido(validBackup)
    // No debe tirar error; la copia ocurre (testeamos que el guard no bloquee).
    expect(() => restaurarDesdeBackup(validBackup)).not.toThrow()
  })

  it.runIf(nativeAbiAvailable)('rechaza un backup con archivo SQLite corrupto', () => {
    const invalidBackup = join(backupsDir, 'corrupto.db')
    // Escribimos texto plano simulando un archivo dañado o de otra extensión.
    writeFileSync(invalidBackup, 'not-a-sqlite-database')
    expect(() => restaurarDesdeBackup(invalidBackup)).toThrow(/integridad/i)
  })

  it('reporta "no encontrado" si el path es válido pero el archivo no existe', () => {
    const inexistente = join(backupsDir, 'no-existe.db')
    expect(() => restaurarDesdeBackup(inexistente)).toThrow(/no encontrado/i)
  })

  it('rechaza un symlink dentro del directorio permitido apuntando a /etc/passwd (A1 bypass fix)', () => {
    // /etc/passwd existe en macOS/Linux. En Windows se skip el test.
    if (process.platform === 'win32') return
    const linkPath = join(backupsDir, 'evil-link.db')
    symlinkSync('/etc/passwd', linkPath)
    expect(() => restaurarDesdeBackup(linkPath)).toThrow(/inválida/i)
  })

  it('rechaza un symlink que apunta a un archivo fuera del directorio de backups', () => {
    if (process.platform === 'win32') return
    const externo = join(tmpRoot, 'externo.db')
    writeFileSync(externo, 'contenido-externo')
    const linkPath = join(backupsDir, 'link-a-externo.db')
    symlinkSync(externo, linkPath)
    expect(() => restaurarDesdeBackup(linkPath)).toThrow(/inválida/i)
  })
})

// `restaurarDesdeBackupPorId` reemplaza la entrada legacy por path. El
// renderer envía un identificador (nombre de archivo) en lugar de una
// ruta absoluta del filesystem. Esto reduce la superficie de ataque del
// IPC: aunque el guard subyacente sigue activo, rechazar payloads con
// separadores antes de tocar el FS da errores más claros y evita trabajo
// innecesario.
describe('restaurarDesdeBackupPorId — guard sintáctico del identificador', () => {
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'casa-alberto-test-id-'))
    backupsDir = join(tmpRoot, 'backups')
    dbPath = join(tmpRoot, 'casa-alberto.db')
    writeFileSync(dbPath, 'dummy-db')
    mkdirSync(backupsDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('rechaza identificador vacío', () => {
    expect(() => restaurarDesdeBackupPorId('')).toThrow(/Identificador.*inválido/i)
  })

  it('rechaza identificador con barra (path traversal directo)', () => {
    expect(() => restaurarDesdeBackupPorId('subdir/backup.db')).toThrow(/Identificador.*inválido/i)
  })

  it('rechaza identificador con barra invertida (Windows path traversal)', () => {
    expect(() => restaurarDesdeBackupPorId('..\\..\\evil.db')).toThrow(/Identificador.*inválido/i)
  })

  it('rechaza identificadores especiales "." y ".."', () => {
    expect(() => restaurarDesdeBackupPorId('.')).toThrow(/Identificador.*inválido/i)
    expect(() => restaurarDesdeBackupPorId('..')).toThrow(/Identificador.*inválido/i)
  })

  it('rechaza identificador absurdamente largo (límite 256)', () => {
    const id = 'a'.repeat(257) + '.db'
    expect(() => restaurarDesdeBackupPorId(id)).toThrow(/Identificador.*inválido/i)
  })

  it('rechaza tipos no string', () => {
    expect(() => restaurarDesdeBackupPorId(null as unknown as string)).toThrow(
      /Identificador.*inválido/i
    )
    expect(() => restaurarDesdeBackupPorId(undefined as unknown as string)).toThrow(
      /Identificador.*inválido/i
    )
    expect(() => restaurarDesdeBackupPorId(123 as unknown as string)).toThrow(
      /Identificador.*inválido/i
    )
  })

  it.runIf(nativeAbiAvailable)('acepta un nombre válido y delega al guard de path', () => {
    const validBackup = join(backupsDir, 'casa-alberto-2026-04-25.db')
    crearBackupSqliteValido(validBackup)
    expect(() => restaurarDesdeBackupPorId('casa-alberto-2026-04-25.db')).not.toThrow()
  })

  it('un nombre que no existe en el directorio retorna "no encontrado"', () => {
    expect(() => restaurarDesdeBackupPorId('no-existe.db')).toThrow(/no encontrado/i)
  })
})

describe('vacuumIntoLiteral — defensa contra inyección y handling de specials', () => {
  const { vacuumIntoLiteral } = __testing__

  it('paths normales se envuelven en comillas simples', () => {
    expect(vacuumIntoLiteral('/Users/alberto/backups/casa-alberto.db')).toBe(
      "'/Users/alberto/backups/casa-alberto.db'"
    )
  })

  it('apóstrofo en el path se escapa (estándar SQLite)', () => {
    expect(vacuumIntoLiteral("/Users/John's/file.db")).toBe("'/Users/John''s/file.db'")
  })

  it('múltiples apóstrofos se escapan todos', () => {
    expect(vacuumIntoLiteral("/a'b'c.db")).toBe("'/a''b''c.db'")
  })

  it('caracteres de control son rechazados', () => {
    expect(() => vacuumIntoLiteral('/path/with\x00null.db')).toThrow(/control/)
    expect(() => vacuumIntoLiteral('/path/with\nnewline.db')).toThrow(/control/)
    expect(() => vacuumIntoLiteral('/path/with\ttab.db')).toThrow(/control/)
    expect(() => vacuumIntoLiteral('/path/with\x7fdel.db')).toThrow(/control/)
  })

  it('semicolons y backticks son rechazados', () => {
    expect(() => vacuumIntoLiteral('/path/foo;rm.db')).toThrow(/reservados/)
    expect(() => vacuumIntoLiteral('/path/`foo`.db')).toThrow(/reservados/)
  })

  it('payload de inyección clásico se rechaza', () => {
    expect(() =>
      vacuumIntoLiteral("/path/foo'; ATTACH DATABASE '/tmp/p' AS p; --")
    ).toThrow(/reservados/)
  })

  it('paths con espacios válidos pasan sin cambios', () => {
    expect(vacuumIntoLiteral('/Users/Mi Nombre/backup.db')).toBe(
      "'/Users/Mi Nombre/backup.db'"
    )
  })
})
