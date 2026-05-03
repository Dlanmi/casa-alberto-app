// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmojisProvider } from '@renderer/contexts/emojis-context'
import AgendaPage from './page'

type PedidoFixture = {
  id: number
  numero: string
  clienteId: number
  clienteNombre: string
  clienteTelefono?: string
  estado: 'confirmado' | 'en_proceso' | 'listo' | 'sin_reclamar'
  fechaEntrega: string
  descripcion: string
}

const BASE_PEDIDOS: PedidoFixture[] = [
  {
    id: 1,
    numero: 'P-OLD',
    clienteId: 10,
    clienteNombre: 'Ana Antigua',
    estado: 'confirmado',
    fechaEntrega: '2026-04-10',
    descripcion: 'Marco viejo'
  },
  {
    id: 2,
    numero: 'P-OLD2',
    clienteId: 11,
    clienteNombre: 'Luis Viejo',
    estado: 'en_proceso',
    fechaEntrega: '2026-04-10',
    descripcion: 'Retablo vencido'
  },
  {
    id: 3,
    numero: 'P-CLAIM',
    clienteId: 12,
    clienteNombre: 'Marta Sin Reclamar',
    estado: 'sin_reclamar',
    fechaEntrega: '2026-04-25',
    descripcion: 'Pedido sin reclamar'
  },
  {
    id: 4,
    numero: 'P-TODAY',
    clienteId: 13,
    clienteNombre: 'Carlos Hoy',
    estado: 'listo',
    fechaEntrega: '2026-05-03',
    descripcion: 'Entrega de hoy'
  },
  {
    id: 5,
    numero: 'P-FUTURE',
    clienteId: 14,
    clienteNombre: 'Sofía Futuro',
    estado: 'confirmado',
    fechaEntrega: '2026-05-08',
    descripcion: 'Entrega futura'
  }
]

function installWindowApi(pedidos: PedidoFixture[] = BASE_PEDIDOS): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    writable: true,
    value: {
      pedidos: {
        agenda: vi.fn(async () => ({
          ok: true,
          data: pedidos.map((p) => ({
            pedidos: {
              id: p.id,
              numero: p.numero,
              clienteId: p.clienteId,
              tipoTrabajo: 'enmarcacion_estandar',
              descripcion: p.descripcion,
              anchoCm: 30,
              altoCm: 40,
              precioTotal: 120000,
              estado: p.estado,
              tipoEntrega: 'estandar',
              fechaEntrega: p.fechaEntrega
            },
            clientes: {
              id: p.clienteId,
              nombre: p.clienteNombre,
              telefono: p.clienteTelefono ?? '3001234567'
            }
          }))
        })),
        saldos: vi.fn(async () => ({
          ok: true,
          data: pedidos.map((p) => ({
            pedidoId: p.id,
            total: 120000,
            pagado: 0,
            saldo: 120000
          }))
        }))
      },
      clases: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
      },
      estudiantes: {
        listar: vi.fn(async () => ({ ok: true, data: [] }))
      },
      clientes: {
        listar: vi.fn(async () => ({
          ok: true,
          data: pedidos.map((p) => ({ id: p.clienteId, nombre: p.clienteNombre }))
        })),
        listarAcudientes: vi.fn(async () => ({ ok: true, data: [] })),
        estadisticas: vi.fn(async () => ({
          ok: true,
          data: {
            totalPedidos: 1,
            totalFacturado: 120000,
            totalPagado: 0,
            saldoPendiente: 120000,
            ultimoPedido: null
          }
        }))
      },
      pagosClases: {
        listarMes: vi.fn(async () => ({ ok: true, data: [] }))
      },
      configuracion: {
        get: vi.fn(async () => ({ ok: true, data: '1' })),
        set: vi.fn(async () => ({ ok: true, data: null }))
      },
      shell: {
        openExternal: vi.fn(async () => ({ ok: true, data: undefined }))
      }
    }
  })
}

function renderAgenda(): void {
  render(
    <MemoryRouter initialEntries={['/agenda']}>
      <EmojisProvider>
        <Routes>
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/pedidos/:id" element={<div>Pedido destino</div>} />
          <Route path="/clases" element={<div>Clases destino</div>} />
          <Route path="/clientes/:id" element={<div>Cliente destino</div>} />
        </Routes>
      </EmojisProvider>
    </MemoryRouter>
  )
}

describe('AgendaPage — filtros globales de pedidos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-05-03T09:00:00-05:00'))
    installWindowApi()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra todos los pedidos activos agrupados por fecha, incluyendo varios el mismo día', async () => {
    renderAgenda()
    // Por defecto la vista inicial está "limpia" (sin mostrar el card de entregas).
    expect(screen.queryByText('P-OLD · Ana Antigua')).toBeNull()

    // Al activar un filtro (p. ej. Solo atrasadas) la sección de entregas aparece.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: /solo atrasadas/i }))

    await waitFor(() => {
      expect(screen.getByText('P-OLD · Ana Antigua')).toBeTruthy()
    })

    expect(screen.getByText('P-OLD2 · Luis Viejo')).toBeTruthy()
    expect(screen.getByText('P-CLAIM · Marta Sin Reclamar')).toBeTruthy()

    // Los pedidos de hoy y futuros no deben mostrarse en "Solo atrasadas"
    expect(screen.queryByText('P-TODAY · Carlos Hoy')).toBeNull()
    expect(screen.queryByText('P-FUTURE · Sofía Futuro')).toBeNull()

    const abril10 = screen.getByRole('button', { name: /10 de abril de 2026.*2 entregas/i })
    expect(abril10).toBeTruthy()
  })

  it('filtra atrasadas globales de distintas semanas e incluye sin_reclamar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAgenda()

    // Reveal entregas then filter
    await user.click(screen.getByRole('button', { name: /solo atrasadas/i }))

    expect(screen.getByText('P-OLD · Ana Antigua')).toBeTruthy()
    expect(screen.getByText('P-OLD2 · Luis Viejo')).toBeTruthy()
    expect(screen.getByText('P-CLAIM · Marta Sin Reclamar')).toBeTruthy()
    expect(screen.queryByText('P-TODAY · Carlos Hoy')).toBeNull()
    expect(screen.queryByText('P-FUTURE · Sofía Futuro')).toBeNull()

    expect(screen.getAllByText('Atrasada').length).toBeGreaterThanOrEqual(3)
  })

  it('muestra vacío específico cuando no hay atrasadas', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    installWindowApi([
      {
        id: 6,
        numero: 'P-HOY-SOLO',
        clienteId: 16,
        clienteNombre: 'Cliente Hoy',
        estado: 'confirmado',
        fechaEntrega: '2026-05-03',
        descripcion: 'Pedido actual'
      }
    ])

    renderAgenda()

    // Mostrar entregas de hoy primero
    await user.click(screen.getByRole('button', { name: /solo hoy/i }))
    await screen.findByText('P-HOY-SOLO · Cliente Hoy')
    await user.click(screen.getByRole('button', { name: /solo atrasadas/i }))

    expect(screen.getByText('No hay pedidos atrasados.')).toBeTruthy()
  })

  it('solo hoy mueve la agenda a hoy y conserva el detalle en la fecha actual', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAgenda()
    await user.click(screen.getByRole('button', { name: /semana anterior/i }))
    await user.click(screen.getByRole('button', { name: /solo hoy/i }))

    expect(screen.getByText('P-TODAY · Carlos Hoy')).toBeTruthy()
    expect(screen.queryByText('P-OLD · Ana Antigua')).toBeNull()

    const selectedDay = screen.getByRole('button', { name: /domingo 3,/i })
    expect(selectedDay.getAttribute('aria-pressed')).toBe('true')

    const listbox = screen.getByRole('listbox', { name: /dias de la semana/i })
    const lunes = within(listbox).getByRole('button', { name: /lunes 27,/i })
    expect((lunes as HTMLButtonElement).disabled).toBe(true)
  })

  it('cierra el popup abierto cuando cambia de filtro', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAgenda()
    // Reveal entregas and open popup
    await user.click(screen.getByRole('button', { name: /solo atrasadas/i }))
    await screen.findByText('P-OLD · Ana Antigua')
    await user.click(screen.getByRole('button', { name: /P-OLD · Ana Antigua/i }))

    expect(screen.getByRole('dialog', { name: /Pedido P-OLD/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /solo hoy/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Pedido P-OLD/i })).toBeNull()
    })
  })
})
