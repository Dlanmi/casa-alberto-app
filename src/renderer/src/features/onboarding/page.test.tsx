// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@renderer/contexts/toast-context'
import OnboardingPage from './page'

// Mock mínimo de window.api para los GETs/SETs que el wizard dispara al montar
// (hidratación del step + campos del negocio). Por defecto devuelve vacío —
// primer uso sin estado persistido.
function stubApi(overrides: Partial<{ step: string | null; datos: Record<string, string> }> = {}) {
  const datos = overrides.datos ?? {}
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        configuracion: {
          get: vi.fn(async (clave: string) => {
            if (clave === 'onboarding_step') return { ok: true, data: overrides.step ?? null }
            return { ok: true, data: datos[clave] ?? null }
          }),
          guardar: vi.fn(async () => ({ ok: true, data: undefined })),
          marcarOnboardingCompleto: vi.fn(async () => ({ ok: true, data: undefined }))
        }
      }
    })
  )
}

describe('OnboardingPage', () => {
  beforeEach(() => stubApi())
  afterEach(() => vi.unstubAllGlobals())

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

    // Esperamos a que la hidratación termine y aparezca el paso 0.
    await waitFor(() => {
      expect(screen.getByText('Qué vas a resolver en este onboarding')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /comenzar configuración/i }))

    expect(screen.getByText('Empieza por lo mínimo')).toBeTruthy()
    expect(
      screen.getByText(/Estos datos aparecen en facturas, cotizaciones y contratos./i)
    ).toBeTruthy()
  })

  it('restaura el paso persistido al remontar (fix #5)', async () => {
    stubApi({ step: '2' })

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <ToastProvider>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )

    // Debe saltar directo al paso de precios (step === 2)
    await waitFor(() => {
      expect(screen.getByText(/Precios iniciales/i)).toBeTruthy()
    })
  })

  it('precarga datos del negocio ya guardados (fix #5)', async () => {
    stubApi({
      step: '1',
      datos: {
        nombre_negocio: 'Marquetería Casa Alberto',
        telefono: '310 123 4567'
      }
    })

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <ToastProvider>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      const nombreInput = screen.getByLabelText(/Nombre del negocio/i) as HTMLInputElement
      expect(nombreInput.value).toBe('Marquetería Casa Alberto')
    })
    const telInput = screen.getByLabelText(/Teléfono/i) as HTMLInputElement
    expect(telInput.value).toBe('310 123 4567')
  })
})
