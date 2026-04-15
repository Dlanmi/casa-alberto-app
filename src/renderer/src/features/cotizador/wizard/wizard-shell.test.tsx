// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WizardShell } from './wizard-shell'

function installWindowApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: {
      cotizador: {
        listarMuestrasMarcos: vi.fn(async () => ({
          ok: true,
          data: []
        }))
      }
    }
  })
}

describe('WizardShell', () => {
  beforeEach(() => {
    installWindowApi()
  })

  it('guía el paso inicial y habilita el avance cuando hay medidas válidas', async () => {
    const user = userEvent.setup()
    render(
      <WizardShell
        tipoTrabajo="enmarcacion_estandar"
        onBack={vi.fn()}
        cliente={null}
        onClienteChange={vi.fn()}
      />
    )

    expect(screen.getByText('Empieza por la obra')).toBeTruthy()

    const nextButton = screen.getByRole('button', { name: /completa este paso para continuar/i })
    expect(nextButton.getAttribute('disabled')).not.toBeNull()

    await user.type(screen.getByLabelText('Ancho (cm)'), '30')
    await user.type(screen.getByLabelText('Alto (cm)'), '40')

    await waitFor(() => {
      expect(screen.getByText('Medidas listas')).toBeTruthy()
    })

    expect(
      screen.getByRole('button', { name: /siguiente: marco/i }).getAttribute('disabled')
    ).toBeNull()
  })
})
