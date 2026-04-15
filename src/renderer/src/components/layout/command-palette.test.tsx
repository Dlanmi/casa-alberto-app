// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './command-palette'

function LocationEcho(): React.JSX.Element {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function RouteShell({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <>
      <CommandPalette open onClose={onClose} />
      <LocationEcho />
    </>
  )
}

function installWindowApi(): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: {
      clientes: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [{ id: 1, nombre: 'Ana Pérez', telefono: '3012345678' }]
        }))
      },
      pedidos: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [{ id: 10, numero: 'P-010', descripcion: 'Pedido Ana' }]
        }))
      },
      facturas: {
        listar: vi.fn(async () => ({
          ok: true,
          data: [{ id: 20, numero: 'AN-020' }]
        }))
      }
    }
  })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    installWindowApi()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('expone semántica accesible y navega con teclado entre resultados', async () => {
    const onClose = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RouteShell onClose={onClose} />} />
          <Route path="/clientes/:id" element={<LocationEcho />} />
          <Route path="/pedidos/:id" element={<LocationEcho />} />
          <Route path="/facturas/:id" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    const input = screen.getByPlaceholderText(/buscar cliente, pedido o factura/i)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-controls')).toBe('command-palette-results')

    fireEvent.change(input, { target: { value: 'an' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeTruthy()
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBe(3)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/pedidos/10')
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra la paleta con Escape', async () => {
    const onClose = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RouteShell onClose={onClose} />} />
        </Routes>
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText(/buscar cliente, pedido o factura/i)
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
