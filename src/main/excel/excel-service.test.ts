// Regression tests for the A5 Excel import hardening. The importer now:
//  - rejects files larger than 10 MB (DoS guard)
//  - caps rows at 10,000
//  - truncates strings to 200 chars
//  - filters __proto__/constructor/prototype keys (prototype pollution guard)
//  - validates numeric ranges
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as XLSX from '@e965/xlsx'
import { importarMarcosDesdeRuta } from './excel-service'
import { createTestDb, nativeAbiAvailable } from '../db/test-utils'
import { muestrasMarcos } from '../db/schema'
import type { DB } from '../db'

vi.mock('electron', () => {
  return {
    app: { getPath: () => '/tmp' },
    dialog: { showOpenDialogSync: vi.fn(() => undefined) }
  }
})

describe.runIf(nativeAbiAvailable)('importarMarcosDesdeRuta (A5)', () => {
  let db: DB
  let tmpRoot: string

  beforeEach(() => {
    db = createTestDb().db
    tmpRoot = mkdtempSync(join(tmpdir(), 'casa-alberto-xlsx-test-'))
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function crearXlsx(
    rows: Array<Record<string, unknown>> | unknown[][],
    opts: { useAoa?: boolean } = {}
  ): string {
    const wb = XLSX.utils.book_new()
    const sheet = opts.useAoa
      ? XLSX.utils.aoa_to_sheet(rows as unknown[][])
      : XLSX.utils.json_to_sheet(rows as Record<string, unknown>[])
    XLSX.utils.book_append_sheet(wb, sheet, 'Marcos')
    const path = join(tmpRoot, `test-${Math.random().toString(36).slice(2)}.xlsx`)
    XLSX.writeFile(wb, path)
    return path
  }

  it('importa un xlsx válido con 3 marcos', () => {
    const path = crearXlsx([
      { Referencia: 'REF-001', 'Colilla cm': 48, 'Precio/m': 48000, Descripcion: 'Caoba' },
      { Referencia: 'REF-002', 'Colilla cm': 50, 'Precio/m': 52000, Descripcion: 'Roble' },
      { Referencia: 'REF-003', 'Colilla cm': 45, 'Precio/m': 60000, Descripcion: 'Pino' }
    ])
    const result = importarMarcosDesdeRuta(db, path)
    expect(result.imported).toBe(3)
    expect(result.updated).toBe(0)

    const todos = db.select().from(muestrasMarcos).all()
    expect(todos.length).toBe(3)
    expect(todos.find((m) => m.referencia === 'REF-001')?.precioMetro).toBe(48000)
  })

  it('rechaza archivos mayores a 10 MB', () => {
    const bigPath = join(tmpRoot, 'big.xlsx')
    // 11 MB de basura. El guard de tamaño dispara antes de XLSX.readFile.
    writeFileSync(bigPath, Buffer.alloc(11 * 1024 * 1024, 0))
    expect(() => importarMarcosDesdeRuta(db, bigPath)).toThrow(/supera 10 MB/i)
  })

  it('rechaza archivos con más de 10.000 filas', () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => ({
      Referencia: `R-${i}`,
      'Colilla cm': 48,
      'Precio/m': 50000
    }))
    const path = crearXlsx(rows)
    expect(() => importarMarcosDesdeRuta(db, path)).toThrow(/Máximo permitido/i)
  })

  it('no pollutea Object.prototype con claves __proto__', () => {
    // Construimos headers manualmente para que __proto__ sea literalmente una
    // columna. aoa_to_sheet respeta los strings de la primera fila.
    const path = crearXlsx(
      [
        ['Referencia', 'Colilla cm', 'Precio/m', '__proto__'],
        ['REF-EVIL', 48, 50000, 'polluted']
      ],
      { useAoa: true }
    )
    importarMarcosDesdeRuta(db, path)
    // Si el guard funciona, Object.prototype.polluted NO existe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined()
  })

  it('trunca strings largos a 200 caracteres', () => {
    const ref = 'A'.repeat(500)
    const desc = 'B'.repeat(500)
    const path = crearXlsx([
      { Referencia: ref, 'Colilla cm': 48, 'Precio/m': 50000, Descripcion: desc }
    ])
    importarMarcosDesdeRuta(db, path)
    const stored = db.select().from(muestrasMarcos).all()[0]
    expect(stored?.referencia.length).toBe(200)
    expect(stored?.descripcion?.length).toBe(200)
  })

  it('salta filas con colilla fuera de rango', () => {
    const path = crearXlsx([
      { Referencia: 'OK', 'Colilla cm': 48, 'Precio/m': 50000 },
      { Referencia: 'MAL-NEG', 'Colilla cm': -5, 'Precio/m': 50000 },
      { Referencia: 'MAL-BIG', 'Colilla cm': 1000, 'Precio/m': 50000 }
    ])
    const result = importarMarcosDesdeRuta(db, path)
    expect(result.imported).toBe(1)
    expect(
      db
        .select()
        .from(muestrasMarcos)
        .all()
        .map((m) => m.referencia)
    ).toEqual(['OK'])
  })

  it('salta filas con precio inválido o negativo', () => {
    const path = crearXlsx([
      { Referencia: 'OK', 'Colilla cm': 48, 'Precio/m': 50000 },
      { Referencia: 'CERO', 'Colilla cm': 48, 'Precio/m': 0 },
      { Referencia: 'NEG', 'Colilla cm': 48, 'Precio/m': -10 },
      { Referencia: 'NAN', 'Colilla cm': 48, 'Precio/m': NaN }
    ])
    const result = importarMarcosDesdeRuta(db, path)
    expect(result.imported).toBe(1)
  })
})
