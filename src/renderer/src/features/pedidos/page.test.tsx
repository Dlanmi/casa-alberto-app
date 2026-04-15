// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@renderer/contexts/toast-context'
import PedidosPage from './page'

function installWindowApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: {
      pedidos: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: 1,
              numero: 'P-001',
              clienteId: 10,
              tipoTrabajo: 'enmarcacion_estandar',
              descripcion: 'Marco sala',
              anchoCm: 30,
              altoCm: 40,
              precioTotal: 120000,
              estado: 'confirmado'
            },
            {
              id: 2,
              numero: 'P-002',
              clienteId: 11,
              tipoTrabajo: 'retablo',
              descripcion: 'Retablo comedor',
              anchoCm: 50,
              altoCm: 70,
              precioTotal: 180000,
              estado: 'listo'
            }
          ]
        })),
        alertas: {
          atrasados: vi.fn(async () => ({ ok: true, data: [null, { pedidos: undefined }] })),
          entregaProxima: vi.fn(async () => ({ ok: true, data: [] })),
          sinAbono: vi.fn(async () => ({
            ok: true,
            data: [{ pedido: { id: 1 } }, { pedidos: undefined }]
          }))
        },
        cambiarEstado: vi.fn(async () => ({ ok: true, data: null }))
      },
      clientes: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [
            { id: 10, nombre: 'Ana Pérez' },
            { id: 11, nombre: 'Luis Gómez' }
          ]
        }))
      }
    }
  })
}

describe('PedidosPage', () => {
  beforeEach(() => {
    installWindowApi()
  })

  it('abre la vista enfocada por query y filtra los pedidos que requieren cobro o seguimiento', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/pedidos?focus=sin_abono']}>
        <ToastProvider>
          <Routes>
            <Route path="/pedidos" element={<PedidosPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vista enfocada: Sin abono')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: /lista/i }))

    expect(screen.getByText('P-001')).toBeTruthy()
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.queryByText('P-002')).toBeNull()
  })
})
