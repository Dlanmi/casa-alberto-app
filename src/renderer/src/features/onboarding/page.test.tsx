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
function stubApi(
  overrides: Partial<{
    step: string | null
    datos: Record<string, string>
    guardarFails: boolean
  }> = {}
): { guardarMock: ReturnType<typeof vi.fn> } {
  const datos = overrides.datos ?? {}
  const guardarMock = vi.fn(async () => {
    if (overrides.guardarFails) {
      throw new Error('IPC offline')
    }
    return { ok: true, data: undefined }
  })
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        configuracion: {
          get: vi.fn(async (clave: string) => {
            if (clave === 'onboarding_step') return { ok: true, data: overrides.step ?? null }
            return { ok: true, data: datos[clave] ?? null }
          }),
          guardar: guardarMock,
          marcarOnboardingCompleto: vi.fn(async () => ({ ok: true, data: undefined }))
        }
      }
    })
  )
  return { guardarMock }
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

  it('restaura el paso persistido al remontar', async () => {
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

  it('precarga datos del negocio ya guardados', async () => {
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

  // `setStep` persiste de forma optimista. Si la mutación falla y no
  // revertimos, el state local queda desincronizado: el dueño ve "paso 2"
  // en pantalla pero la DB sigue en "paso 1", y al reabrir la app
  // retrocede. Este test verifica que ahora revertimos y mostramos toast.
  it('revierte el step y muestra toast cuando guardar() falla', async () => {
    const user = userEvent.setup()
    const { guardarMock } = stubApi({ guardarFails: true })

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
      expect(screen.getByText('Qué vas a resolver en este onboarding')).toBeTruthy()
    })

    // Avanzar al paso de datos. La persistencia de "step=1" va a fallar.
    await user.click(screen.getByRole('button', { name: /comenzar configuración/i }))

    // El toast aparece (avisa al usuario, no falla en silencio).
    await waitFor(() => {
      expect(screen.getByText(/no se pudo guardar el paso/i)).toBeTruthy()
    })

    // Y el state revierte al paso 0 (Bienvenida) para que el usuario reintente.
    await waitFor(() => {
      expect(screen.getByText('Qué vas a resolver en este onboarding')).toBeTruthy()
    })

    // Confirmamos que la mutación fue invocada (avance optimista) antes de
    // revertir, no que estuvimos bloqueando antes de tiempo.
    expect(guardarMock).toHaveBeenCalled()
  })
})
