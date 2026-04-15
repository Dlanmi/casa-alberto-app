// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@renderer/contexts/toast-context'
import OnboardingPage from './page'

describe('OnboardingPage', () => {
  it('muestra guías claras desde la bienvenida hasta los datos básicos', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <ToastProvider>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Qué vas a resolver en este onboarding')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /comenzar configuración/i }))

    expect(screen.getByText('Empieza por lo mínimo')).toBeTruthy()
    expect(
      screen.getByText(/Estos datos aparecen en facturas, cotizaciones y contratos./i)
    ).toBeTruthy()
  })
})
