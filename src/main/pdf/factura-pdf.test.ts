// Regression tests for the PDF security hardening (A2, A7, A8, B3):
//  - sanitizePdfText strips control characters from user-provided strings
//  - generarFacturaPDF rejects corrupt `numero` values (path traversal defense)
//  - abrirPDF rejects paths outside `<userData>/pdfs/` and rejects symlinks
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  abrirPDF,
  agruparItemsPorTrabajo,
  decidirMostrarHeaders,
  generarFacturaPDF,
  sanitizePdfText,
  NUMERO_REGEX,
  type GrupoFactura
} from './factura-pdf'

// vi.mock es hoisted al top del archivo, así que las variables de estado
// que el mock necesita compartir con el test deben declararse con vi.hoisted.
const mocks = vi.hoisted(() => {
  return {
    userDataDir: '',
    openPathMock: vi.fn(async () => '')
  }
})

vi.mock('electron', () => {
  return {
    app: {
      getPath: () => mocks.userDataDir
    },
    shell: {
      openPath: mocks.openPathMock
    }
  }
})

describe('sanitizePdfText (A8, B3)', () => {
  it('retorna string vacío para null/undefined', () => {
    expect(sanitizePdfText(null)).toBe('')
    expect(sanitizePdfText(undefined)).toBe('')
    expect(sanitizePdfText('')).toBe('')
  })

  it('remueve null byte y caracteres de control', () => {
    expect(sanitizePdfText('Juan\x00Pérez')).toBe('JuanPérez')
    expect(sanitizePdfText('Test\x01\x02\x03End')).toBe('TestEnd')
    expect(sanitizePdfText('\x7FDEL')).toBe('DEL')
  })

  it('preserva whitespace aceptable (tab, newline, CR)', () => {
    expect(sanitizePdfText('Linea 1\nLinea 2')).toBe('Linea 1\nLinea 2')
    expect(sanitizePdfText('Col1\tCol2')).toBe('Col1\tCol2')
    expect(sanitizePdfText('CRLF\r\nEnd')).toBe('CRLF\r\nEnd')
  })

  it('no toca texto normal con acentos y ñ', () => {
    expect(sanitizePdfText('Piñata de María Ángeles — $15.000')).toBe(
      'Piñata de María Ángeles — $15.000'
    )
  })
})

describe('NUMERO_REGEX (A7)', () => {
  it('acepta formatos válidos de consecutivos', () => {
    expect(NUMERO_REGEX.test('F-0001')).toBe(true)
    expect(NUMERO_REGEX.test('P-12345')).toBe(true)
    expect(NUMERO_REGEX.test('CC-1')).toBe(true)
  })

  it('rechaza path traversal y formatos no reconocidos', () => {
    expect(NUMERO_REGEX.test('../hack')).toBe(false)
    expect(NUMERO_REGEX.test('F-0001/../x')).toBe(false)
    expect(NUMERO_REGEX.test('../../etc/passwd')).toBe(false)
    expect(NUMERO_REGEX.test('F_0001')).toBe(false)
    expect(NUMERO_REGEX.test('f-0001')).toBe(false) // minúscula
    expect(NUMERO_REGEX.test('F-')).toBe(false) // sin dígitos
    expect(NUMERO_REGEX.test('')).toBe(false)
  })
})

describe('abrirPDF — path traversal guard (A2)', () => {
  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'casa-alberto-pdf-test-'))
    mkdirSync(join(mocks.userDataDir, 'pdfs'), { recursive: true })
    mocks.openPathMock.mockClear()
  })

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true })
  })

  it('rechaza path fuera de <userData>/pdfs/', () => {
    expect(() => abrirPDF('/etc/passwd')).toThrow(/Ruta de PDF inválida/i)
    expect(mocks.openPathMock).not.toHaveBeenCalled()
  })

  it('rechaza path con ../../', () => {
    const pdfDir = join(mocks.userDataDir, 'pdfs')
    const escape = join(pdfDir, '..', '..', 'tmp', 'evil.pdf')
    expect(() => abrirPDF(escape)).toThrow(/Ruta de PDF inválida/i)
  })

  it('acepta un path válido dentro de <userData>/pdfs/', () => {
    const validPath = join(mocks.userDataDir, 'pdfs', 'factura-F-0001-carta.pdf')
    writeFileSync(validPath, '%PDF-1.4 dummy')
    expect(() => abrirPDF(validPath)).not.toThrow()
    expect(mocks.openPathMock).toHaveBeenCalledOnce()
  })

  it('rechaza un symlink dentro de pdfs apuntando a /etc/passwd', () => {
    if (process.platform === 'win32') return
    const linkPath = join(mocks.userDataDir, 'pdfs', 'evil-link.pdf')
    symlinkSync('/etc/passwd', linkPath)
    expect(() => abrirPDF(linkPath)).toThrow(/inválida/i)
    expect(mocks.openPathMock).not.toHaveBeenCalled()
  })
})

describe('generarFacturaPDF — validación del numero (A7)', () => {
  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'casa-alberto-pdf-gen-'))
  })

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true })
  })

  it('rechaza numero con path traversal antes de tocar la DB', () => {
    const fakeDb = {} as never // no se debe alcanzar a usar
    const data = {
      numero: '../hack',
      fecha: '2026-04-16',
      clienteNombre: 'Cliente',
      items: [],
      subtotal: 0,
      totalMateriales: 0,
      total: 0,
      pagos: [],
      saldo: 0
    }
    expect(() => generarFacturaPDF(fakeDb, data)).toThrow(/Número de factura.*inválido/i)
  })

  it('rechaza numero en minúsculas', () => {
    const fakeDb = {} as never
    const data = {
      numero: 'f-0001',
      fecha: '2026-04-16',
      clienteNombre: 'Cliente',
      items: [],
      subtotal: 0,
      totalMateriales: 0,
      total: 0,
      pagos: [],
      saldo: 0
    }
    expect(() => generarFacturaPDF(fakeDb, data)).toThrow(/Número de factura.*inválido/i)
  })
})

// El tipo PdfFormato es solo TypeScript; en runtime un renderer comprometido
// podría enviar `formato: "../../evil"` que se interpolaría en el path
// `factura-{numero}-{formato}.pdf` y, tras path.normalize, escaparía del
// directorio de PDFs. Validamos contra el whitelist exportado.
describe('generarFacturaPDF — validación del formato (defense in depth)', () => {
  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'casa-alberto-pdf-formato-'))
  })

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true })
  })

  function makeData(formato: unknown): Parameters<typeof generarFacturaPDF>[1] {
    return {
      numero: 'F-0001',
      fecha: '2026-04-16',
      clienteNombre: 'Cliente',
      items: [],
      subtotal: 0,
      totalMateriales: 0,
      total: 0,
      pagos: [],
      saldo: 0,
      formato: formato as never
    }
  }

  it('rechaza formato con path traversal', () => {
    const fakeDb = {} as never
    expect(() => generarFacturaPDF(fakeDb, makeData('../../evil'))).toThrow(
      /Formato de PDF inválido/i
    )
  })

  it('rechaza formato fuera del whitelist', () => {
    const fakeDb = {} as never
    expect(() => generarFacturaPDF(fakeDb, makeData('xml'))).toThrow(/Formato de PDF inválido/i)
    expect(() => generarFacturaPDF(fakeDb, makeData(''))).toThrow(/Formato de PDF inválido/i)
  })

  it('acepta los tres formatos válidos sin lanzar (omitido vale como carta)', () => {
    const fakeDb = {} as never
    // No nos interesa el render real; capturamos solo que no se rechace en
    // la guarda de validación. pdfkit sí intentará renderizar, pero la
    // validación se ejecuta antes de tocar el filesystem.
    expect(() => generarFacturaPDF(fakeDb, makeData(undefined))).not.toThrow(
      /Formato de PDF inválido/i
    )
    expect(() => generarFacturaPDF(fakeDb, makeData('carta'))).not.toThrow(
      /Formato de PDF inválido/i
    )
    expect(() => generarFacturaPDF(fakeDb, makeData('a4'))).not.toThrow(/Formato de PDF inválido/i)
    expect(() => generarFacturaPDF(fakeDb, makeData('termico80'))).not.toThrow(
      /Formato de PDF inválido/i
    )
  })
})

// ---------------------------------------------------------------------------
// Bug del informe sobre b206a5f — headers de grupo cuando hay 1 trabajo +
// items sueltos quedaban omitidos en ambos formatos (carta y térmico).
// Auditoría reveló bug paralelo: térmico nunca mostraba header "Otros".
// ---------------------------------------------------------------------------

function grupoTrabajo(id: number, nombre: string, itemsCount = 1): GrupoFactura {
  const items = Array.from({ length: itemsCount }, (_, i) => ({
    descripcion: `Item ${i + 1}`,
    cantidad: 1,
    precioUnitario: 10000,
    subtotal: 10000,
    trabajoId: id,
    trabajoNombre: nombre
  }))
  return { trabajoId: id, items, nombre }
}

function grupoSueltos(itemsCount = 1): GrupoFactura {
  const items = Array.from({ length: itemsCount }, (_, i) => ({
    descripcion: `Suelto ${i + 1}`,
    cantidad: 1,
    precioUnitario: 5000,
    subtotal: 5000
  }))
  return { trabajoId: null, items }
}

describe('decidirMostrarHeaders — matriz de casos del informe', () => {
  it('0 trabajos, todos sueltos → false (compat pedido directo simple)', () => {
    expect(decidirMostrarHeaders([grupoSueltos(3)])).toBe(false)
  })

  it('1 trabajo, 0 sueltos → false (single trabajo, no aporta diferenciar)', () => {
    expect(decidirMostrarHeaders([grupoTrabajo(1, 'Cuadro', 3)])).toBe(false)
  })

  it('1 trabajo + 1 suelto → true (BUG-FIX del informe)', () => {
    expect(
      decidirMostrarHeaders([grupoTrabajo(1, 'Cuadro de la abuela'), grupoSueltos(1)])
    ).toBe(true)
  })

  it('1 trabajo + varios sueltos → true', () => {
    expect(decidirMostrarHeaders([grupoTrabajo(1, 'Cuadro'), grupoSueltos(3)])).toBe(true)
  })

  it('2 trabajos sin sueltos → true (multi-trabajo)', () => {
    expect(
      decidirMostrarHeaders([grupoTrabajo(1, 'Cuadro A'), grupoTrabajo(2, 'Cuadro B')])
    ).toBe(true)
  })

  it('2 trabajos + sueltos → true', () => {
    expect(
      decidirMostrarHeaders([
        grupoTrabajo(1, 'A'),
        grupoTrabajo(2, 'B'),
        grupoSueltos(1)
      ])
    ).toBe(true)
  })

  it('grupo de sueltos vacío no cuenta (defense)', () => {
    // Si por algún edge case llega un grupo `null` con 0 items, no cuenta
    // como "hay sueltos" — sin headers para el único trabajo.
    expect(decidirMostrarHeaders([grupoTrabajo(1, 'X'), grupoSueltos(0)])).toBe(false)
  })

  it('array vacío → false', () => {
    expect(decidirMostrarHeaders([])).toBe(false)
  })
})

describe('agruparItemsPorTrabajo — orden y captura de metadata', () => {
  it('items sin trabajoId → un solo grupo null', () => {
    const grupos = agruparItemsPorTrabajo([
      { descripcion: 'A', cantidad: 1, precioUnitario: 100, subtotal: 100 },
      { descripcion: 'B', cantidad: 1, precioUnitario: 200, subtotal: 200 }
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0]!.trabajoId).toBeNull()
    expect(grupos[0]!.items).toHaveLength(2)
  })

  it('captura trabajoNombre del primer item del grupo', () => {
    const grupos = agruparItemsPorTrabajo([
      {
        descripcion: 'Marco',
        cantidad: 1,
        precioUnitario: 100,
        subtotal: 100,
        trabajoId: 1,
        trabajoNombre: 'Cuadro de la abuela'
      },
      {
        descripcion: 'Vidrio',
        cantidad: 1,
        precioUnitario: 50,
        subtotal: 50,
        trabajoId: 1,
        trabajoNombre: 'Cuadro de la abuela'
      }
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0]!.nombre).toBe('Cuadro de la abuela')
  })

  it('ordena trabajos por trabajoId ascendente; null al final', () => {
    const grupos = agruparItemsPorTrabajo([
      { descripcion: 'B', cantidad: 1, precioUnitario: 100, subtotal: 100, trabajoId: 2 },
      { descripcion: 'X', cantidad: 1, precioUnitario: 50, subtotal: 50 }, // suelto
      { descripcion: 'A', cantidad: 1, precioUnitario: 100, subtotal: 100, trabajoId: 1 }
    ])
    expect(grupos.map((g) => g.trabajoId)).toEqual([1, 2, null])
  })

  it('items con trabajoNombre + items sueltos coexisten en grupos distintos', () => {
    // Este es el caso del informe: 1 trabajo + 1 suelto.
    const grupos = agruparItemsPorTrabajo([
      {
        descripcion: 'Marco',
        cantidad: 1,
        precioUnitario: 80000,
        subtotal: 80000,
        trabajoId: 1,
        trabajoNombre: 'Cuadro'
      },
      {
        descripcion: 'Transporte',
        cantidad: 1,
        precioUnitario: 25000,
        subtotal: 25000
      }
    ])
    expect(grupos).toHaveLength(2)
    expect(grupos[0]!.trabajoId).toBe(1)
    expect(grupos[0]!.nombre).toBe('Cuadro')
    expect(grupos[1]!.trabajoId).toBeNull()
    expect(grupos[1]!.items[0]!.descripcion).toBe('Transporte')
    // Y la decisión de mostrar headers en ese caso es true (BUG-FIX).
    expect(decidirMostrarHeaders(grupos)).toBe(true)
  })
})
