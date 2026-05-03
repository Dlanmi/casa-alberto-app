// @vitest-environment jsdom

import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast-context'

// Espejo en test del TOAST_EXIT_MS interno: tras cerrar un toast aplicamos
// animate-toast-out durante esta duración antes de desmontarlo del DOM.
const TOAST_EXIT_MS = 200

function ToastHarness({
  onAction,
  onUndo
}: {
  onAction: () => void
  onUndo: () => void
}): React.JSX.Element {
  const { showToast } = useToast()

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          showToast({
            tone: 'warning',
            title: 'Saldo pendiente',
            message: 'Registra un abono para cerrar la factura.',
            actionLabel: 'Ver detalle',
            onAction,
            persistent: true
          })
        }
      >
        Mostrar toast nuevo
      </button>

      <button type="button" onClick={() => showToast('success', 'Guardado', onUndo)}>
        Mostrar toast legado
      </button>

      <button
        type="button"
        onClick={() =>
          showToast({
            tone: 'info',
            message: 'Este mensaje se cierra solo.',
            durationMs: 1000
          })
        }
      >
        Mostrar toast temporal
      </button>
    </div>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('muestra la API nueva con acción persistente', async () => {
    const onAction = vi.fn()
    const onUndo = vi.fn()

    render(
      <ToastProvider>
        <ToastHarness onAction={onAction} onUndo={onUndo} />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /mostrar toast nuevo/i }))

    expect(screen.getByText('Saldo pendiente')).toBeTruthy()
    expect(screen.getByText('Registra un abono para cerrar la factura.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /ver detalle/i }))

    expect(onAction).toHaveBeenCalledTimes(1)
    // Tras cerrar el toast queda con animate-toast-out por TOAST_EXIT_MS
    // antes de salir del DOM. Avanzamos timers para esperar la animación.
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('Saldo pendiente')).toBeNull()
  })

  it('mantiene compatibilidad legacy y respeta el auto cierre', async () => {
    const onAction = vi.fn()
    const onUndo = vi.fn()

    render(
      <ToastProvider>
        <ToastHarness onAction={onAction} onUndo={onUndo} />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /mostrar toast legado/i }))
    expect(screen.getByText('Guardado')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('Guardado')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /mostrar toast temporal/i }))
    expect(screen.getByText('Este mensaje se cierra solo.')).toBeTruthy()

    // Auto-cierre dispara removeToast a 1000ms; luego TOAST_EXIT_MS extra
    // hasta que el toast sale del DOM.
    await act(async () => {
      vi.advanceTimersByTime(1000 + TOAST_EXIT_MS)
    })

    expect(screen.queryByText('Este mensaje se cierra solo.')).toBeNull()
  })

  it('dedupe: no muestra dos toasts idénticos simultáneamente (C2)', () => {
    const onAction = vi.fn()
    const onUndo = vi.fn()

    render(
      <ToastProvider>
        <ToastHarness onAction={onAction} onUndo={onUndo} />
      </ToastProvider>
    )

    // Dispara el mismo toast success 3 veces — debería quedar solo uno
    // (success/info/progress se dedupean para evitar pilas de confirmaciones).
    fireEvent.click(screen.getByRole('button', { name: /mostrar toast legado/i }))
    fireEvent.click(screen.getByRole('button', { name: /mostrar toast legado/i }))
    fireEvent.click(screen.getByRole('button', { name: /mostrar toast legado/i }))

    expect(screen.getAllByText('Guardado').length).toBe(1)
  })

  it('errores secuenciales NO se dedupean: el dueño debe ver cada fallo', () => {
    function ErrorThrice(): React.JSX.Element {
      const { showToast } = useToast()
      return (
        <button
          type="button"
          onClick={() => {
            // Tres errores idénticos seguidos: si la operación falla varias
            // veces, papá tiene que ver cada toast — silenciar el segundo
            // ocultaría el síntoma.
            showToast({ tone: 'error', message: 'Conexión perdida' })
            showToast({ tone: 'error', message: 'Conexión perdida' })
            showToast({ tone: 'error', message: 'Conexión perdida' })
          }}
        >
          Disparar 3 errores
        </button>
      )
    }

    render(
      <ToastProvider>
        <ErrorThrice />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /disparar 3 errores/i }))

    // El cap limita a MAX_TOASTS=3 simultáneos. Como ningún error se
    // dedupea, deberíamos ver los 3 textos (limit del cap).
    expect(screen.getAllByText('Conexión perdida').length).toBe(3)
  })

  it('cap: máximo 3 toasts simultáneos, el más viejo se descarta (C2)', () => {
    function FourToasts(): React.JSX.Element {
      const { showToast } = useToast()
      return (
        <button
          type="button"
          onClick={() => {
            showToast({ tone: 'info', message: 'M1', persistent: true })
            showToast({ tone: 'info', message: 'M2', persistent: true })
            showToast({ tone: 'info', message: 'M3', persistent: true })
            showToast({ tone: 'info', message: 'M4', persistent: true })
          }}
        >
          Disparar 4
        </button>
      )
    }

    render(
      <ToastProvider>
        <FourToasts />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /disparar 4/i }))

    expect(screen.queryByText('M1')).toBeNull() // el más viejo se sacó
    expect(screen.getByText('M2')).toBeTruthy()
    expect(screen.getByText('M3')).toBeTruthy()
    expect(screen.getByText('M4')).toBeTruthy()
  })
})
