// @vitest-environment jsdom

// Tests del componente QuickPayModal. Cubren:
//   - El modal arranca con monto pre-llenado al saldo pendiente
//   - Atajos de teclado Enter/Esc funcionan
//   - Modo cobrar_y_entregar bloquea cobro parcial
//   - Modo solo_cobrar acepta cualquier monto entre 0 y saldo
//   - Errores del backend se muestran inline
//   - Persistencia del último método de pago en localStorage
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@renderer/contexts/toast-context'
import { QuickPayModal } from './quick-pay-modal'
import type { Pedido, Cliente } from '@shared/types'

const PEDIDO_BASE: Pedido = {
  id: 42,
  numero: 'P-0042',
  clienteId: 1,
  tipoTrabajo: 'enmarcacion_estandar',
  descripcion: 'Marco 30x40',
  anchoCm: 30,
  altoCm: 40,
  anchoPaspartuCm: null,
  tipoPaspartu: null,
  tipoVidrio: 'claro_2mm',
  porcentajeMateriales: 10,
  subtotal: 100000,
  totalMateriales: 10000,
  brutoCotizado: 110000,
  precioLista: 110000,
  descuentoMonto: 0,
  descuentoMotivo: null,
  costoEstimadoTotal: 60000,
  margenEstimado: 50000,
  margenEstimadoPct: 45.45,
  estadoRentabilidad: 'saludable',
  precioTotal: 110000,
  estado: 'listo',
  tipoEntrega: 'estandar',
  fechaIngreso: '2026-04-01',
  fechaEntrega: '2026-04-10',
  notas: null,
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01'
}

const CLIENTE: Cliente = {
  id: 1,
  nombre: 'María Gómez',
  telefono: '3201234567',
  cedula: '52123456',
  correo: null,
  direccion: null,
  notas: null,
  esMenor: false,
  activo: true,
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01'
}

function stubApi(overrides: {
  cobrarYEntregar?: ReturnType<typeof vi.fn>
  registrarPago?: ReturnType<typeof vi.fn>
  listarFacturas?: ReturnType<typeof vi.fn>
}): void {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        pedidos: {
          cobrarYEntregar:
            overrides.cobrarYEntregar ??
            vi.fn(async () => ({ ok: true, data: { saldoFinal: 0 } }))
        },
        facturas: {
          listar:
            overrides.listarFacturas ??
            vi.fn(async () => ({
              ok: true,
              data: [{ id: 99, pedidoId: 42, estado: 'pendiente' }]
            })),
          registrarPago:
            overrides.registrarPago ??
            vi.fn(async () => ({ ok: true, data: { saldo: 0 } }))
        }
      }
    })
  )
}

function renderModal(props: {
  modo: 'cobrar_y_entregar' | 'solo_cobrar'
  saldoPendiente?: number
  totalFactura?: number
  onSuccess?: () => void
  onClose?: () => void
}): { onSuccess: ReturnType<typeof vi.fn>; onClose: ReturnType<typeof vi.fn> } {
  const onSuccess = vi.fn()
  const onClose = vi.fn()
  render(
    <ToastProvider>
      <QuickPayModal
        pedido={PEDIDO_BASE}
        cliente={CLIENTE}
        saldoPendiente={props.saldoPendiente ?? 48000}
        totalFactura={props.totalFactura ?? 110000}
        modo={props.modo}
        onClose={props.onClose ?? onClose}
        onSuccess={props.onSuccess ?? onSuccess}
      />
    </ToastProvider>
  )
  return { onSuccess, onClose }
}

describe('QuickPayModal', () => {
  beforeEach(() => {
    stubApi({})
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('muestra el saldo pendiente destacado y pre-llena el monto', () => {
    renderModal({ modo: 'cobrar_y_entregar', saldoPendiente: 48000 })
    expect(screen.getByText('María Gómez')).toBeTruthy()
    expect(screen.getByText('P-0042')).toBeTruthy()
    expect(screen.getAllByText(/48[.,]?000/).length).toBeGreaterThan(0)
  })

  it('modo cobrar_y_entregar muestra el título correcto', () => {
    renderModal({ modo: 'cobrar_y_entregar' })
    // El texto "Cobrar y entregar" aparece como título del modal y en el botón;
    // basta con verificar que al menos hay una ocurrencia.
    expect(screen.getAllByText('Cobrar y entregar').length).toBeGreaterThan(0)
  })

  it('modo solo_cobrar muestra título de abono', () => {
    renderModal({ modo: 'solo_cobrar' })
    expect(screen.getAllByText('Cobrar abono').length).toBeGreaterThan(0)
  })

  it('llama cobrarYEntregar al confirmar en modo cobrar_y_entregar', async () => {
    const cobrarYEntregar = vi.fn(async () => ({ ok: true, data: { saldoFinal: 0 } }))
    stubApi({ cobrarYEntregar })
    const { onSuccess } = renderModal({ modo: 'cobrar_y_entregar', saldoPendiente: 48000 })

    const boton = screen.getByRole('button', { name: /cobrar y entregar/i })
    fireEvent.click(boton)

    await waitFor(() => expect(cobrarYEntregar).toHaveBeenCalled())
    expect(cobrarYEntregar).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: 42, monto: 48000, metodoPago: 'efectivo' })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('modo cobrar_y_entregar bloquea cobro parcial con error visible', async () => {
    const cobrarYEntregar = vi.fn()
    stubApi({ cobrarYEntregar })
    const user = userEvent.setup()
    renderModal({ modo: 'cobrar_y_entregar', saldoPendiente: 48000 })

    // Cambia el monto a uno menor que el saldo
    const input = screen.getByLabelText(/Monto a cobrar/i) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '20000')
    fireEvent.blur(input)

    // El botón debe estar deshabilitado en modo cobrar_y_entregar con monto parcial
    const boton = screen.getByRole('button', { name: /cobrar y entregar/i })
    expect(boton).toHaveProperty('disabled', true)

    // No debe haberse llamado el API
    expect(cobrarYEntregar).not.toHaveBeenCalled()
  })

  it('modo solo_cobrar acepta cobro parcial', async () => {
    const registrarPago = vi.fn(async () => ({ ok: true, data: { saldo: 28000 } }))
    stubApi({ registrarPago })
    const user = userEvent.setup()
    renderModal({ modo: 'solo_cobrar', saldoPendiente: 48000 })

    const input = screen.getByLabelText(/Monto a cobrar/i) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '20000')
    fireEvent.blur(input)

    const boton = screen.getByRole('button', { name: /registrar abono/i })
    expect(boton).toHaveProperty('disabled', false)
    fireEvent.click(boton)

    await waitFor(() => expect(registrarPago).toHaveBeenCalled())
    expect(registrarPago).toHaveBeenCalledWith(
      expect.objectContaining({ facturaId: 99, monto: 20000 })
    )
  })

  it('atajo Esc cierra el modal', () => {
    const { onClose } = renderModal({ modo: 'cobrar_y_entregar' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('atajo Enter dispara submit cuando el botón está habilitado', async () => {
    const cobrarYEntregar = vi.fn(async () => ({ ok: true, data: { saldoFinal: 0 } }))
    stubApi({ cobrarYEntregar })
    renderModal({ modo: 'cobrar_y_entregar' })

    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => expect(cobrarYEntregar).toHaveBeenCalled())
  })

  it('muestra error inline cuando el backend rechaza', async () => {
    const cobrarYEntregar = vi.fn(async () => ({ ok: false, error: 'Factura ya anulada' }))
    stubApi({ cobrarYEntregar })
    renderModal({ modo: 'cobrar_y_entregar' })

    fireEvent.click(screen.getByRole('button', { name: /cobrar y entregar/i }))

    await waitFor(() => {
      expect(screen.getByText('Factura ya anulada')).toBeTruthy()
    })
  })

  it('persiste el método de pago en localStorage al confirmar', async () => {
    const cobrarYEntregar = vi.fn(async () => ({ ok: true, data: { saldoFinal: 0 } }))
    stubApi({ cobrarYEntregar })
    const user = userEvent.setup()
    renderModal({ modo: 'cobrar_y_entregar' })

    // Cambia a transferencia
    await user.click(screen.getByRole('button', { name: /transferencia/i }))

    fireEvent.click(screen.getByRole('button', { name: /cobrar y entregar/i }))

    await waitFor(() => expect(cobrarYEntregar).toHaveBeenCalled())
    expect(localStorage.getItem('casa-alberto:ultimo-metodo-pago')).toBe('transferencia')
  })

  it('al re-abrir, recuerda el último método de pago', () => {
    localStorage.setItem('casa-alberto:ultimo-metodo-pago', 'transferencia')
    renderModal({ modo: 'cobrar_y_entregar' })
    const transferenciaBtn = screen.getByRole('button', { name: /transferencia/i })
    // Verifica que tiene la clase de seleccionado
    expect(transferenciaBtn.className).toContain('border-accent')
  })

  it('botón "Cobrar todo" rellena el monto con el saldo completo', async () => {
    const user = userEvent.setup()
    renderModal({ modo: 'solo_cobrar', saldoPendiente: 75000 })

    const input = screen.getByLabelText(/Monto a cobrar/i) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '10000')

    await user.click(screen.getByRole('button', { name: /cobrar todo/i }))

    expect(input.value).toMatch(/75[.,]?000/)
  })
})
