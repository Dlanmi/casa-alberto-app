// @vitest-environment jsdom
// Regression tests para el bug de v1.4.0 donde el popover del HelpButton se
// cerraba solo al abrirlo (useEffect con `open` en deps creaba un loop).
// El test que lo detectaría es 'click abre y mantiene abierto'.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelpButton } from './help-button'

// Mock de resetWelcomeTour — no queremos que reload() rompa jsdom.
vi.mock('./welcome-tour', () => ({
  resetWelcomeTour: vi.fn()
}))

function renderAt(path = '/cotizador'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<HelpButton />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('HelpButton (regresión v1.4.0)', () => {
  it('click abre el popover y SE QUEDA abierto (bug raíz)', () => {
    renderAt('/cotizador')
    const toggle = screen.getByRole('button', { name: /abrir ayuda/i })

    fireEvent.click(toggle)

    // El dialog debe ser visible. Antes del fix, se cerraba solo por el effect.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: /cerrar ayuda/i })).toBeTruthy()
  })

  it('click de nuevo cierra el popover', () => {
    renderAt('/cotizador')
    const toggle = screen.getByRole('button', { name: /abrir ayuda/i })

    fireEvent.click(toggle)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /cerrar ayuda/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape cierra el popover', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('click afuera cierra el popover', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    // mousedown en document.body (afuera del popover y del botón)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('HelpButton — búsqueda global (v1.4.1)', () => {
  it('con query corta (<2 chars) sigue mostrando los tips de la ruta actual', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'a' } })

    // El heading de ruta actual sigue visible.
    expect(screen.getByText('Cotizar un trabajo')).toBeTruthy()
    // "Resultados de búsqueda" NO debe aparecer.
    expect(screen.queryByText(/resultados de búsqueda/i)).toBeNull()
  })

  it('con query ≥2 chars filtra tips de todas las rutas', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'factura' } })

    // Cambia a modo búsqueda.
    expect(screen.getByText(/resultados de búsqueda/i)).toBeTruthy()
    // Debe encontrar tips que mencionen "factura" (de pedidos o facturas).
    const hits = screen.getAllByText(/factura/i)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('mensaje amable cuando la búsqueda no encuentra nada', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'xyzinexistente123' } })

    expect(screen.getByText(/no encontramos nada/i)).toBeTruthy()
  })
})

describe('HelpButton — tips con navegación (v1.4.1)', () => {
  it('muestra botón "Ir ahí" cuando el tip tiene un destino', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    // Los tips de /cotizador ya tienen 'to' en algunos.
    const iraBotones = screen.getAllByRole('button', { name: /ir ahí/i })
    expect(iraBotones.length).toBeGreaterThan(0)
  })

  it('click en "Ir ahí" cierra el popover (y navega)', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const irBtn = screen.getAllByRole('button', { name: /ir ahí/i })[0]
    act(() => {
      fireEvent.click(irBtn)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('HelpButton — botón tour', () => {
  it('llama resetWelcomeTour cuando el usuario pulsa "Ver el tour"', async () => {
    const mod = await import('./welcome-tour')
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    fireEvent.click(screen.getByRole('button', { name: /ver el tour/i }))

    expect(mod.resetWelcomeTour).toHaveBeenCalledTimes(1)
  })
})
