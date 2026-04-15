// @vitest-environment jsdom

import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast-context'

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
    expect(screen.queryByText('Guardado')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /mostrar toast temporal/i }))
    expect(screen.getByText('Este mensaje se cierra solo.')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.queryByText('Este mensaje se cierra solo.')).toBeNull()
  })
})
