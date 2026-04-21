// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UpdateNotification } from './update-notification'
import type { UpdateStatus } from '@shared/types'

type Notifier = (status: UpdateStatus) => void

function installUpdaterStub(initialStatus: UpdateStatus = { state: 'idle' }): {
  notify: Notifier
  quitAndInstall: ReturnType<typeof vi.fn>
} {
  let listener: Notifier | null = null
  const quitAndInstall = vi.fn().mockResolvedValue({ ok: true, data: undefined })

  ;(window as unknown as { api: unknown }).api = {
    updater: {
      getStatus: vi.fn().mockResolvedValue({ ok: true, data: initialStatus }),
      quitAndInstall,
      checkNow: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      onStatusChange: (cb: Notifier) => {
        listener = cb
        return () => {
          listener = null
        }
      }
    }
  }

  return { notify: (s) => listener?.(s), quitAndInstall }
}

describe('UpdateNotification', () => {
  beforeEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('no renderiza nada en estado idle', async () => {
    installUpdaterStub({ state: 'idle' })
    const { container } = render(<UpdateNotification />)
    // Esperamos al hidrate inicial y verificamos que sigue vacío.
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('no renderiza durante checking o available (transientes)', async () => {
    const { notify } = installUpdaterStub({ state: 'idle' })
    const { container } = render(<UpdateNotification />)

    act(() => notify({ state: 'checking' }))
    expect(container.firstChild).toBeNull()

    act(() => notify({ state: 'available', version: '1.4.0' }))
    expect(container.firstChild).toBeNull()
  })

  it('muestra progreso durante downloading con progressbar accesible', async () => {
    const { notify } = installUpdaterStub({ state: 'idle' })
    render(<UpdateNotification />)

    act(() => notify({ state: 'downloading', percent: 35 }))

    expect(screen.getByText(/Descargando actualización/i)).toBeTruthy()
    expect(screen.getByText(/35%/)).toBeTruthy()

    const bar = screen.getByRole('progressbar', { name: /progreso/i })
    expect(bar.getAttribute('aria-valuenow')).toBe('35')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('muestra botón de reiniciar cuando la update está descargada', async () => {
    const { notify } = installUpdaterStub({ state: 'idle' })
    render(<UpdateNotification />)

    act(() => notify({ state: 'downloaded', version: '1.4.0' }))

    expect(screen.getByText(/Actualización lista/i)).toBeTruthy()
    expect(screen.getByText(/1\.4\.0/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reiniciar/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Después/i })).toBeTruthy()
  })

  it('el click en "Reiniciar ahora" llama quitAndInstall', async () => {
    const { notify, quitAndInstall } = installUpdaterStub({ state: 'idle' })
    render(<UpdateNotification />)

    act(() => notify({ state: 'downloaded', version: '1.4.0' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reiniciar/i }))
    })

    expect(quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('el click en "Después" oculta el banner hasta el próximo cambio de estado', async () => {
    const { notify } = installUpdaterStub({ state: 'idle' })
    const { container } = render(<UpdateNotification />)

    act(() => notify({ state: 'downloaded', version: '1.4.0' }))
    expect(container.firstChild).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Después/i }))
    expect(container.firstChild).toBeNull()

    // Un nuevo estado (ej. error después) debe volver a mostrar el banner.
    act(() => notify({ state: 'error', message: 'fallo' }))
    expect(container.firstChild).not.toBeNull()
  })

  it('muestra mensaje de error sin detalles técnicos y permite cerrarlo', async () => {
    const { notify } = installUpdaterStub({ state: 'idle' })
    const { container } = render(<UpdateNotification />)

    act(() => notify({ state: 'error', message: 'ENOENT: update.exe' }))

    // Usa role="alert" para que sea assertive.
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/No pudimos actualizar/i)).toBeTruthy()
    // No debe filtrar el mensaje técnico.
    expect(screen.queryByText(/ENOENT/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Entendido/i }))
    expect(container.firstChild).toBeNull()
  })
})
