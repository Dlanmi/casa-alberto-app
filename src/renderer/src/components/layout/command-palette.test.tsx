// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CommandPalette } from './command-palette'
import { getEntityProviders, type CommandProvider } from './command-providers'

function LocationEcho(): React.JSX.Element {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function RouteShell({ onClose }: { onClose: () => void }): React.JSX.Element {
  // Reusamos el set real de providers para que el test cubra la integración
  // entre palette + providers, no solo el palette aislado.
  const providers = getEntityProviders()
  return (
    <>
      <CommandPalette open onClose={onClose} providers={providers} />
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
      },
      proveedores: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
      },
      clases: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
      },
      estudiantes: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
      },
      contratos: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
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

    const input = screen.getByPlaceholderText(/buscar o ejecutar una acción/i)
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
    expect(options.length).toBeGreaterThanOrEqual(3)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      // El segundo resultado en orden visual (Pedidos viene después de Clientes
      // por prioridad) debe ser el pedido P-010.
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

    const input = screen.getByPlaceholderText(/buscar o ejecutar una acción/i)
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('agrupa resultados por sección con header visible', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RouteShell onClose={onClose} />} />
        </Routes>
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText(/buscar o ejecutar una acción/i)
    fireEvent.change(input, { target: { value: 'an' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    await waitFor(() => {
      expect(screen.getByText('Clientes')).toBeTruthy()
      expect(screen.getByText('Pedidos')).toBeTruthy()
      expect(screen.getByText('Facturas')).toBeTruthy()
    })
  })

  it('descarta items sin icono sin crashear el render (defense-in-depth)', async () => {
    // Provider stub que devuelve un item válido y otro con icono undefined.
    // Sin la guarda en command-palette.tsx, React lanza
    // "Element type is invalid" al renderizar `<Icon />`. Con la guarda,
    // el item inválido se omite y el válido se renderiza normalmente.
    const providerHibrido: CommandProvider = {
      nombre: 'stub-hibrido',
      prioridad: 1,
      mostrarSinQuery: true,
      buscar: async () => [
        {
          id: 'stub:valido',
          kind: 'navigation',
          seccion: 'Stub',
          titulo: 'Item válido',
          icono: Users,
          ejecutar: () => undefined
        },
        {
          id: 'stub:roto',
          kind: 'navigation',
          seccion: 'Stub',
          titulo: 'Item con icono undefined',
          // Cast unsafe que simula el bug del informe: kind corrupto en
          // localStorage → ICONO_POR_KIND[kind] === undefined.
          icono: undefined as unknown as LucideIcon,
          ejecutar: () => undefined
        }
      ]
    }

    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<CommandPalette open onClose={onClose} providers={[providerHibrido]} />}
          />
        </Routes>
      </MemoryRouter>
    )

    // Esperamos a que el debounce procese (200ms) y se rendericen los items.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    await waitFor(() => {
      expect(screen.getByText('Item válido')).toBeTruthy()
    })
    // El item inválido se omitió silenciosamente — no hay TypeError.
    expect(screen.queryByText('Item con icono undefined')).toBeNull()
    // Solo 1 option, el inválido se descartó.
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })
})
