// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useUpdateStatus } from './use-update-status'
import type { UpdateStatus } from '@shared/types'

// Stub mínimo de window.api.updater. Los tests controlan:
// - initialStatus: lo que retorna getStatus() al montar.
// - notifier: función para disparar onStatusChange a demanda desde el test.
type Notifier = (status: UpdateStatus) => void
function installUpdaterStub(initialStatus: UpdateStatus = { state: 'idle' }): {
  notify: Notifier
  quitAndInstall: ReturnType<typeof vi.fn>
  checkNow: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
} {
  let listener: Notifier | null = null
  const unsubscribe = vi.fn()
  const quitAndInstall = vi.fn().mockResolvedValue({ ok: true, data: undefined })
  const checkNow = vi.fn().mockResolvedValue({ ok: true, data: undefined })

  ;(window as unknown as { api: unknown }).api = {
    updater: {
      getStatus: vi.fn().mockResolvedValue({ ok: true, data: initialStatus }),
      quitAndInstall,
      checkNow,
      onStatusChange: (cb: Notifier) => {
        listener = cb
        return unsubscribe
      }
    }
  }

  return {
    notify: (s) => listener?.(s),
    quitAndInstall,
    checkNow,
    unsubscribe
  }
}

describe('useUpdateStatus', () => {
  beforeEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('arranca en idle y hidrata con el estado inicial del main', async () => {
    installUpdaterStub({ state: 'downloaded', version: '1.4.0' })
    const { result } = renderHook(() => useUpdateStatus())

    expect(result.current.status).toEqual({ state: 'idle' })

    await waitFor(() => {
      expect(result.current.status).toEqual({ state: 'downloaded', version: '1.4.0' })
    })
  })

  it('refleja eventos subsecuentes emitidos por el main', async () => {
    const { notify } = installUpdaterStub()
    const { result } = renderHook(() => useUpdateStatus())

    await waitFor(() => expect(result.current.status.state).toBe('idle'))

    act(() => notify({ state: 'downloading', percent: 42 }))
    expect(result.current.status).toEqual({ state: 'downloading', percent: 42 })

    act(() => notify({ state: 'downloaded', version: '1.5.0' }))
    expect(result.current.status).toEqual({ state: 'downloaded', version: '1.5.0' })
  })

  it('quitAndInstall y checkNow delegan al preload', async () => {
    const { quitAndInstall, checkNow } = installUpdaterStub()
    const { result } = renderHook(() => useUpdateStatus())

    await act(async () => {
      await result.current.quitAndInstall()
    })
    expect(quitAndInstall).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.checkNow()
    })
    expect(checkNow).toHaveBeenCalledTimes(1)
  })

  it('desuscribe al desmontar para evitar fugas', async () => {
    const { unsubscribe } = installUpdaterStub()
    const { unmount } = renderHook(() => useUpdateStatus())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('ignora el estado inicial si el componente se desmontó antes de resolver', async () => {
    // getStatus retorna una promesa que resolvemos después del unmount.
    let resolveStatus: (value: { ok: boolean; data: UpdateStatus }) => void = () => {}
    ;(window as unknown as { api: unknown }).api = {
      updater: {
        getStatus: () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          }),
        quitAndInstall: vi.fn(),
        checkNow: vi.fn(),
        onStatusChange: () => () => {}
      }
    }

    const { result, unmount } = renderHook(() => useUpdateStatus())
    unmount()

    // Resolver tras unmount no debe romper (no hay assertion de setState post-unmount).
    resolveStatus({ ok: true, data: { state: 'downloaded', version: '9.9.9' } })
    await new Promise((r) => setTimeout(r, 0))

    // El estado del hook desmontado no importa, solo validamos que no crashea.
    expect(result.current).toBeDefined()
  })
})
