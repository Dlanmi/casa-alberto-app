// Regression tests for the PDF security hardening (A2, A7, A8, B3):
//  - sanitizePdfText strips control characters from user-provided strings
//  - generarFacturaPDF rejects corrupt `numero` values (path traversal defense)
//  - abrirPDF rejects paths outside `<userData>/pdfs/` and rejects symlinks
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { abrirPDF, generarFacturaPDF, sanitizePdfText, NUMERO_REGEX } from './factura-pdf'

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
