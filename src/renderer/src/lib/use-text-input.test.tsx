// @vitest-environment jsdom
//
// Tests adversariales de los hooks de texto/cédula/teléfono. Cubre los
// errores típicos del dueño: copy-paste con espacios, puntos, paréntesis,
// caracteres de control, formatos extranjeros.
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  __helpers__,
  useCedulaInput,
  useTelefonoInput,
  useTextInput
} from './use-text-input'

describe('useTextInput', () => {
  it('trim al perder foco', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTextInput('  Alberto  ', onChange))
    expect(result.current.raw).toBe('  Alberto  ')
    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.raw).toBe('Alberto')
    expect(onChange).toHaveBeenCalledWith('Alberto')
  })

  it('rechaza control chars al teclear', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTextInput('', onChange))
    act(() => {
      result.current.handleChange({
        target: { value: 'hola\x00mundo' }
      } as never)
    })
    expect(onChange).toHaveBeenCalledWith('holamundo')
  })

  it('respeta maxLength truncando', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTextInput('', onChange, { maxLength: 5 }))
    act(() => {
      result.current.handleChange({ target: { value: 'abcdefgh' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith('abcde')
  })

  it('permite tab/newline (whitespace válido)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTextInput('', onChange))
    act(() => {
      result.current.handleChange({
        target: { value: 'linea1\nlinea2\tcol' }
      } as never)
    })
    expect(onChange).toHaveBeenCalledWith('linea1\nlinea2\tcol')
  })
})

describe('useCedulaInput', () => {
  it('limpia puntos colombianos', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useCedulaInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '1.234.567.890' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith('1234567890')
  })

  it('limpia espacios y guiones', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useCedulaInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '12-345 678' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith('12345678')
  })

  it('blur muestra solo dígitos', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useCedulaInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '001.234.567' } } as never)
    })
    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.raw).toBe('001234567')
  })

  it('rechaza letras (las strippea)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useCedulaInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '12abc34' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith('1234')
  })
})

describe('useTelefonoInput', () => {
  it('limpia formato extranjero (+57 (601) 456-7890)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTelefonoInput('', onChange))
    act(() => {
      result.current.handleChange({
        target: { value: '+57 (601) 456-7890' }
      } as never)
    })
    expect(onChange).toHaveBeenCalledWith('576014567890')
  })

  it('blur muestra solo dígitos', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTelefonoInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '300 123 4567' } } as never)
    })
    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.raw).toBe('3001234567')
  })

  it('strippea letras', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useTelefonoInput('', onChange))
    act(() => {
      result.current.handleChange({ target: { value: '300tel4567' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith('3004567')
  })
})

describe('helpers internos', () => {
  it('sanitizarControlChars deja whitespace válido', () => {
    expect(__helpers__.sanitizarControlChars('a\tb\nc')).toBe('a\tb\nc')
  })
  it('sanitizarControlChars elimina NUL/escape', () => {
    expect(__helpers__.sanitizarControlChars('a\x00b\x07c')).toBe('abc')
  })
  it('limpiarCedula caso típico', () => {
    expect(__helpers__.limpiarCedula('1.234.567.890')).toBe('1234567890')
  })
  it('limpiarTelefono con +', () => {
    expect(__helpers__.limpiarTelefono('+57 300 123 4567')).toBe('573001234567')
  })
})
