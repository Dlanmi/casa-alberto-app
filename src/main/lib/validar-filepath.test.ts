import { describe, expect, it } from 'vitest'
import { validarFilePathInput } from './validar-filepath'

describe('validarFilePathInput — guard sintáctico del boundary IPC', () => {
  it('acepta strings normales', () => {
    const r = validarFilePathInput(
      '/Users/papa/Library/Application Support/casa-alberto/pdfs/F-001.pdf'
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeDefined()
  })

  it('rechaza string vacío', () => {
    const r = validarFilePathInput('')
    expect(r.ok).toBe(false)
  })

  it('rechaza tipos no string (null, undefined, número, objeto, array)', () => {
    expect(validarFilePathInput(null).ok).toBe(false)
    expect(validarFilePathInput(undefined).ok).toBe(false)
    expect(validarFilePathInput(123).ok).toBe(false)
    expect(validarFilePathInput({}).ok).toBe(false)
    expect(validarFilePathInput([]).ok).toBe(false)
    expect(validarFilePathInput(true).ok).toBe(false)
  })

  it('rechaza strings absurdamente largos (límite 4096)', () => {
    const enorme = 'a'.repeat(4097)
    const r = validarFilePathInput(enorme)
    expect(r.ok).toBe(false)
  })

  it('acepta el límite exacto', () => {
    const justo = 'a'.repeat(4096)
    const r = validarFilePathInput(justo)
    expect(r.ok).toBe(true)
  })

  it('NO valida path traversal — eso es responsabilidad del consumidor', () => {
    // Este helper solo hace guard sintáctico. Path traversal lo rechaza
    // `validarPathSeguro` en pdf/factura-pdf.ts y db/backup.ts.
    const r = validarFilePathInput('../../etc/passwd')
    expect(r.ok).toBe(true)
  })
})
