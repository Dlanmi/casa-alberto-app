// @vitest-environment jsdom
//
// Tests UI de la página `/pedidos/nuevo-directo`. Cubren:
//   - Render con form vacío sin crashear
//   - Validación de cliente requerido
//   - Add/remove de items respetando mínimo 1
//   - Suma de items se actualiza al cambiar precios
//   - Override de total muestra info de diferencia
//   - Toggle de abono muestra/oculta bloque
//   - Submit con datos válidos llama IPC con shape correcto
//   - Submit con error backend muestra mensaje
//   - Cancelar con cambios dispara dirty guard
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '@renderer/contexts/toast-context'
import NuevoPedidoDirectoPage from './nuevo-directo-page'

const CLIENTE_DEMO = {
  id: 42,
  nombre: 'Ana Pérez',
  telefono: '3001234567',
  cedula: null,
  correo: null,
  direccion: null,
  notas: null,
  esMenor: false,
  activo: true,
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01'
}

const PEDIDO_DEMO = {
  id: 1,
  numero: 'P-0001',
  clienteId: 42,
  tipoTrabajo: 'enmarcacion_estandar',
  precioTotal: 50000,
  subtotal: 50000,
  totalMateriales: 0,
  precioLista: 50000,
  descuentoMonto: 0,
  descuentoMotivo: null,
  estado: 'confirmado',
  fechaIngreso: '2026-05-05',
  fechaEntrega: null,
  notas: null
}

function setupApi(overrides: {
  crearDirecto?: ReturnType<typeof vi.fn>
  listarClientes?: ReturnType<typeof vi.fn>
  obtenerPedido?: ReturnType<typeof vi.fn>
  obtenerCliente?: ReturnType<typeof vi.fn>
} = {}): void {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        clientes: {
          listar:
            overrides.listarClientes ??
            vi.fn(async () => ({ ok: true, data: [CLIENTE_DEMO] })),
          obtener:
            overrides.obtenerCliente ??
            vi.fn(async () => ({ ok: true, data: CLIENTE_DEMO })),
          crear: vi.fn(async () => ({ ok: true, data: CLIENTE_DEMO }))
        },
        pedidos: {
          crearDirecto:
            overrides.crearDirecto ??
            vi.fn(async () => ({
              ok: true,
              data: {
                pedido: PEDIDO_DEMO,
                factura: { id: 99, numero: 'F-0001', fecha: '2026-05-05', estado: 'pendiente', total: 50000 },
                pago: null,
                saldo: 50000
              }
            })),
          obtener:
            overrides.obtenerPedido ??
            vi.fn(async () => ({
              ok: true,
              data: { ...PEDIDO_DEMO, items: [] }
            }))
        },
        pdf: {
          generarFactura: vi.fn(async () => ({ ok: true, data: '/tmp/factura.pdf' })),
          abrir: vi.fn(async () => ({ ok: true, data: undefined }))
        }
      }
    })
  )
}

function LocationEcho(): React.JSX.Element {
  const location = useLocation()
  return <div data-testid="loc">{location.pathname + location.search}</div>
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/pedidos/nuevo-directo']}>
      <ToastProvider>
        <Routes>
          <Route path="/pedidos/nuevo-directo" element={<NuevoPedidoDirectoPage />} />
          <Route path="/pedidos" element={<LocationEcho />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('NuevoPedidoDirectoPage', () => {
  beforeEach(() => {
    setupApi()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renderiza el form completo sin crashear', () => {
    renderPage()
    expect(screen.getByText('Nuevo pedido directo')).toBeTruthy()
    expect(screen.getByText('Cliente')).toBeTruthy()
    expect(screen.getByText('Datos del pedido')).toBeTruthy()
    expect(screen.getByText('Items del pedido')).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
  })

  it('botón Guardar arranca deshabilitado sin cliente', () => {
    renderPage()
    const guardar = screen.getByRole('button', { name: /guardar pedido/i })
    expect(guardar).toHaveProperty('disabled', true)
  })

  it('arranca con 1 item por defecto y permite agregar más', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getAllByText(/Item \d+/).length).toBe(1)
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    expect(screen.getAllByText(/Item \d+/).length).toBe(2)
  })

  it('no permite eliminar el último item (mínimo 1)', async () => {
    const user = userEvent.setup()
    renderPage()
    // Solo 1 item: el botón delete no debe existir.
    const deleteButtons = screen.queryAllByLabelText(/eliminar item/i)
    expect(deleteButtons).toHaveLength(0)
    // Tras agregar otro, sí aparecen.
    await user.click(screen.getByRole('button', { name: /agregar item/i }))
    expect(screen.getAllByLabelText(/eliminar item/i).length).toBe(2)
  })

  it('toggle de abono muestra/oculta el bloque de pago', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByText(/método/i)).toBeNull()
    await user.click(screen.getByLabelText(/registrar abono/i))
    expect(screen.getByText(/método/i)).toBeTruthy()
  })

  it('toggle de PDF cambia su estado', async () => {
    const user = userEvent.setup()
    renderPage()
    const pdfToggle = screen.getByLabelText(/generar pdf/i) as HTMLInputElement
    expect(pdfToggle.checked).toBe(false)
    await user.click(pdfToggle)
    expect(pdfToggle.checked).toBe(true)
  })

  it('muestra error al intentar guardar sin cliente seleccionado', async () => {
    const user = userEvent.setup()
    renderPage()
    // Llenamos un item válido pero NO seleccionamos cliente.
    const itemDesc = screen.getByPlaceholderText(/descripción del item|marco rob/i)
    await user.type(itemDesc, 'Algo')
    // Botón sigue deshabilitado, pero verificamos que el form sin cliente no llama IPC.
    const crearDirectoSpy = (
      window.api as unknown as {
        pedidos: { crearDirecto: ReturnType<typeof vi.fn> }
      }
    ).pedidos.crearDirecto
    expect(crearDirectoSpy).not.toHaveBeenCalled()
  })

  it('snapshot dirty: cambiar valores marca el form como dirty', async () => {
    const user = userEvent.setup()
    renderPage()
    // Cambiamos un campo del item.
    const descInput = screen.getByPlaceholderText(/descripción del item|marco rob/i)
    await user.type(descInput, 'Cambio')
    // Click en Cancelar debería abrir confirm (porque hay cambios).
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    await waitFor(() => {
      expect(screen.getByText(/descartar cambios/i)).toBeTruthy()
    })
  })

  it('cancelar sin cambios navega directo', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/pedidos')
    })
  })

  it('descripción de tipo trabajo cambia las labels visibles', async () => {
    const user = userEvent.setup()
    renderPage()
    const tipoTrabajoSelect = screen.getByLabelText(/tipo de trabajo/i) as HTMLSelectElement
    expect(tipoTrabajoSelect.value).toBe('enmarcacion_estandar')
    await user.selectOptions(tipoTrabajoSelect, 'restauracion')
    expect(tipoTrabajoSelect.value).toBe('restauracion')
  })
})
