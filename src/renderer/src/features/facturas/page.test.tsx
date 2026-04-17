// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@renderer/contexts/toast-context'
import { EmojisProvider } from '@renderer/contexts/emojis-context'
import FacturasPage from './page'

function installWindowApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: {
      facturas: {
        listar: vi.fn(async () => ({ ok: true, data: [] })),
        crear: vi.fn(async () => ({ ok: true, data: { id: 99 } })),
        registrarPago: vi.fn(async () => ({ ok: true, data: null }))
      },
      clientes: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [{ id: 10, nombre: 'Ana Pérez' }]
        }))
      },
      pedidos: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: 1,
              numero: 'P-001',
              clienteId: 10,
              descripcion: 'Marco sala',
              precioTotal: 120000,
              estado: 'listo'
            }
          ]
        }))
      },
      configuracion: {
        get: vi.fn(async () => ({ ok: true, data: '1' })),
        set: vi.fn(async () => ({ ok: true, data: null }))
      }
    }
  })
}

describe('FacturasPage', () => {
  beforeEach(() => {
    installWindowApi()
  })

  it('muestra el nombre del cliente al elegir un pedido elegible y al confirmar la factura', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/facturas']}>
        <EmojisProvider>
          <ToastProvider>
            <Routes>
              <Route path="/facturas" element={<FacturasPage />} />
            </Routes>
          </ToastProvider>
        </EmojisProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nueva factura/i })).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /nueva factura/i }))

    await waitFor(() => {
      expect(screen.getByText(/P-001 · Ana Pérez/i)).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /P-001 · Ana Pérez/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.getByText('P-001')).toBeTruthy()
  })
})
