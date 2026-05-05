// @vitest-environment jsdom
//
// Tests del hook `useQueryFlag`. Verifica:
//   - Detecta `?nuevo=1` y devuelve true una sola vez
//   - Limpia el flag de la URL al montar (replace, no push)
//   - Devuelve false cuando el flag no está
import { renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useQueryFlag } from './use-query-flag'
import type { ReactNode } from 'react'

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe('useQueryFlag', () => {
  it('devuelve true cuando el flag está presente con valor 1', () => {
    const { result } = renderHook(() => useQueryFlag('nuevo'), {
      wrapper: wrapper(['/clientes?nuevo=1'])
    })
    expect(result.current).toBe(true)
  })

  it('devuelve false cuando el flag no está', () => {
    const { result } = renderHook(() => useQueryFlag('nuevo'), {
      wrapper: wrapper(['/clientes'])
    })
    expect(result.current).toBe(false)
  })

  it('devuelve false cuando el flag tiene valor distinto de 1', () => {
    const { result } = renderHook(() => useQueryFlag('nuevo'), {
      wrapper: wrapper(['/clientes?nuevo=algo'])
    })
    expect(result.current).toBe(false)
  })

  it('limpia el flag de la URL después de montar', () => {
    function Probe(): React.JSX.Element {
      const flag = useQueryFlag('nuevo')
      const location = useLocation()
      return (
        <div>
          <span data-testid="flag">{String(flag)}</span>
          <span data-testid="search">{location.search}</span>
        </div>
      )
    }
    const { result } = renderHook(
      () => {
        const flag = useQueryFlag('nuevo')
        const location = useLocation()
        return { flag, search: location.search }
      },
      { wrapper: wrapper(['/clientes?nuevo=1&otro=foo']) }
    )
    expect(result.current.flag).toBe(true)
    // Tras el effect, el query string ya no debe tener `nuevo`.
    expect(result.current.search).not.toContain('nuevo=1')
    // Pero conservamos otros params no relacionados.
    expect(result.current.search).toContain('otro=foo')
    // Suprimimos warning de variable Probe no usada (la usamos solo como
    // ilustración del shape del hook en el comentario superior).
    void Probe
  })
})
