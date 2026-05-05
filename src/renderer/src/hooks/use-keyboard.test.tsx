// @vitest-environment jsdom
//
// Tests del hook useKeyboard. Cubren matching por `key`, `code`, `ignoreShift`
// (importante para atajos cuya tecla cambia con shift entre layouts).
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboard } from './use-keyboard'

function dispatchKey(opts: {
  key: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}): void {
  const e = new KeyboardEvent('keydown', {
    key: opts.key,
    code: opts.code,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    metaKey: opts.metaKey ?? false,
    bubbles: true,
    cancelable: true
  })
  window.dispatchEvent(e)
}

describe('useKeyboard — matching por key', () => {
  it('matchea key + ctrl correctamente', () => {
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([{ combo: { key: 'k', ctrl: true }, handler }])
    )
    dispatchKey({ key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('NO matchea cuando faltan modificadores', () => {
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([{ combo: { key: 'k', ctrl: true }, handler }])
    )
    dispatchKey({ key: 'k' }) // sin ctrl
    expect(handler).not.toHaveBeenCalled()
  })

  it('case-insensitive en `key`', () => {
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([{ combo: { key: 'K', ctrl: true }, handler }])
    )
    dispatchKey({ key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('useKeyboard — ignoreShift (layouts donde la tecla requiere shift)', () => {
  it('Ctrl+/ con shift se acepta cuando ignoreShift=true', () => {
    // Caso es-LA: '/' se produce con Shift+7. e.key='/' pero e.shiftKey=true.
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([
        { combo: { key: '/', ctrl: true, ignoreShift: true }, handler }
      ])
    )
    dispatchKey({ key: '/', ctrlKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('Ctrl+/ sin shift también se acepta cuando ignoreShift=true', () => {
    // Caso US-QWERTY: '/' es directo. e.key='/', e.shiftKey=false.
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([
        { combo: { key: '/', ctrl: true, ignoreShift: true }, handler }
      ])
    )
    dispatchKey({ key: '/', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('sin ignoreShift, Ctrl+Shift+/ NO matchea Ctrl+/', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboard([{ combo: { key: '/', ctrl: true }, handler }]))
    dispatchKey({ key: '/', ctrlKey: true, shiftKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('useKeyboard — matching por code (independent del layout)', () => {
  it('matchea por code aunque key sea diferente entre layouts', () => {
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([{ combo: { key: 'unused', code: 'Slash', ctrl: true }, handler }])
    )
    // En cualquier layout, code='Slash' identifica la misma tecla física.
    dispatchKey({ key: '?', code: 'Slash', ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('NO matchea cuando code difiere', () => {
    const handler = vi.fn()
    renderHook(() =>
      useKeyboard([{ combo: { key: 'k', code: 'KeyK', ctrl: true }, handler }])
    )
    dispatchKey({ key: 'k', code: 'KeyJ', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})
