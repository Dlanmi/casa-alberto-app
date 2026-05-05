// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useIntegerInput } from './use-integer-input'

describe('useIntegerInput', () => {
  it('letras producen 0', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useIntegerInput(0, onChange))
    act(() => {
      result.current.handleChange({ target: { value: 'abc' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('decimales se truncan', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useIntegerInput(0, onChange))
    act(() => {
      result.current.handleChange({ target: { value: '1.5' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('coma como decimal se trunca', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useIntegerInput(0, onChange))
    act(() => {
      result.current.handleChange({ target: { value: '1,5' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('respeta clamp min/max', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useIntegerInput(0, onChange, { min: 1, max: 10 }))
    act(() => {
      result.current.handleChange({ target: { value: '99' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith(10)
    act(() => {
      result.current.handleChange({ target: { value: '0' } } as never)
    })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('blur muestra el valor canónico', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(({ v }) => useIntegerInput(v, onChange), {
      initialProps: { v: 0 }
    })
    act(() => {
      result.current.handleChange({ target: { value: '42abc' } } as never)
    })
    rerender({ v: 42 })
    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.raw).toBe('42')
  })

  it('vacío en blur muestra ""', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useIntegerInput(0, onChange))
    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.raw).toBe('')
  })
})
