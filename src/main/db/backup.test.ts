// Regression tests for the A1 path-traversal guard added to
// `restaurarDesdeBackup`. The guard rejects any path outside of
// `getBackupsDir()` so a compromised renderer cannot copy arbitrary files
// over the live SQLite database.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { restaurarDesdeBackup } from './backup'

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

  it('acepta un backup válido dentro del directorio permitido', () => {
    const validBackup = join(backupsDir, 'casa-alberto-2026-04-16T12-00.db')
    writeFileSync(validBackup, 'valid-backup-contents')
    // No debe tirar error; la copia ocurre (testeamos que el guard no bloquee).
    expect(() => restaurarDesdeBackup(validBackup)).not.toThrow()
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
