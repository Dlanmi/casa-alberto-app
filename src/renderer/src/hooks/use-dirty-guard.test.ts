// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDirtyGuard } from './use-dirty-guard'

describe('useDirtyGuard', () => {
  it('sin dirty, onBeforeClose retorna true y no abre confirm', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDirtyGuard(false, onClose))

    let allowed: boolean
    act(() => {
      allowed = result.current.onBeforeClose()
    })

    expect(allowed!).toBe(true)
    expect(result.current.confirmOpen).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('con dirty, onBeforeClose retorna false y abre confirm', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDirtyGuard(true, onClose))

    let allowed: boolean
    act(() => {
      allowed = result.current.onBeforeClose()
    })

    expect(allowed!).toBe(false)
    expect(result.current.confirmOpen).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancelClose cierra el confirm sin ejecutar onClose', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDirtyGuard(true, onClose))

    act(() => {
      result.current.onBeforeClose()
    })
    expect(result.current.confirmOpen).toBe(true)

    act(() => {
      result.current.cancelClose()
    })

    expect(result.current.confirmOpen).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirmClose cierra confirm Y ejecuta onClose', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDirtyGuard(true, onClose))

    act(() => {
      result.current.onBeforeClose()
    })

    act(() => {
      result.current.confirmClose()
    })

    expect(result.current.confirmOpen).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
