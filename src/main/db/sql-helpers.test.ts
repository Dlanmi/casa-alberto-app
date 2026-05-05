// Tests del helper de escapes LIKE.
import { describe, expect, it } from 'vitest'
import { buildContainsPattern, escapeLikePattern } from './sql-helpers'

describe('escapeLikePattern', () => {
  it('strings sin caracteres especiales pasan sin cambios', () => {
    expect(escapeLikePattern('Juan')).toBe('Juan')
    expect(escapeLikePattern('M-2003')).toBe('M-2003')
    expect(escapeLikePattern('')).toBe('')
  })

  it('escapa porcentaje literal', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%')
    expect(escapeLikePattern('%foo%')).toBe('\\%foo\\%')
  })

  it('escapa underscore literal', () => {
    expect(escapeLikePattern('foo_bar')).toBe('foo\\_bar')
  })

  it('escapa el char de escape mismo (backslash)', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  })

  it('escapa combinaciones', () => {
    expect(escapeLikePattern('50%_foo\\bar')).toBe('50\\%\\_foo\\\\bar')
  })
})

describe('buildContainsPattern', () => {
  it('envuelve en %...% el input escapado', () => {
    expect(buildContainsPattern('Juan')).toBe('%Juan%')
    expect(buildContainsPattern('50%')).toBe('%50\\%%')
  })

  it('vacío produce %%', () => {
    // Pattern vacío matchearía toda la tabla — error explícito.
    expect(() => buildContainsPattern('')).toThrow(/vacío/i)
    expect(() => buildContainsPattern('   ')).toThrow(/vacío/i)
  })
})
