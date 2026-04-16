// @vitest-environment jsdom
//
// Regression tests for the C1 onBeforeClose hook on Modal. When the form
// inside has unsaved changes, the consumer returns false and the close is
// blocked — applies to: backdrop click, Escape key, and X button.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Modal } from './modal'

function Harness({
  onBeforeClose,
  onClose
}: {
  onBeforeClose?: () => boolean
  onClose: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        setOpen(false)
      }}
      title="Editar cliente"
      onBeforeClose={onBeforeClose}
    >
      <div>Contenido del modal</div>
    </Modal>
  )
}

describe('Modal onBeforeClose (C1)', () => {
  it('sin onBeforeClose, el botón X cierra normalmente', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('si onBeforeClose retorna false, el botón X NO cierra', () => {
    const onClose = vi.fn()
    const onBeforeClose = vi.fn(() => false)
    render(<Harness onClose={onClose} onBeforeClose={onBeforeClose} />)

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onBeforeClose).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Contenido del modal')).toBeTruthy()
  })

  it('si onBeforeClose retorna true, el botón X cierra', () => {
    const onClose = vi.fn()
    const onBeforeClose = vi.fn(() => true)
    render(<Harness onClose={onClose} onBeforeClose={onBeforeClose} />)

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onBeforeClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('si onBeforeClose retorna false, click en backdrop NO cierra', () => {
    const onClose = vi.fn()
    const onBeforeClose = vi.fn(() => false)
    render(<Harness onClose={onClose} onBeforeClose={onBeforeClose} />)

    // El dialog raíz actúa como backdrop cuando se le hace click directo
    const dialog = screen.getByRole('dialog', { hidden: true })
    fireEvent.click(dialog)

    expect(onBeforeClose).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // jsdom no dispara nativamente el evento 'cancel' al recibir Escape en <dialog>,
  // así que despachamos el evento manualmente para simular lo que Chromium hace
  // en la app real. La prueba valida que el listener 'cancel' del Modal llame
  // a onBeforeClose y bloquee el cierre.
  it('Escape con onBeforeClose=false NO cierra (C1)', () => {
    const onClose = vi.fn()
    const onBeforeClose = vi.fn(() => false)
    render(<Harness onClose={onClose} onBeforeClose={onBeforeClose} />)

    const dialog = screen.getByRole('dialog', { hidden: true })
    const cancelEvent = new Event('cancel', { bubbles: false, cancelable: true })
    dialog.dispatchEvent(cancelEvent)

    expect(onBeforeClose).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Contenido del modal')).toBeTruthy()
  })
})
