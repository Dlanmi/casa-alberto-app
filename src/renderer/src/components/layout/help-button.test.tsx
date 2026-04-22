// @vitest-environment jsdom
// Regression tests para el bug de v1.4.0 donde el popover del HelpButton se
// cerraba solo al abrirlo (useEffect con `open` en deps creaba un loop).
// El test que lo detectaría es 'click abre y mantiene abierto'.
//
// v1.5.0 agrega cobertura para tips dinámicos (matriz de urgencia), tabs
// Tips/FAQ, y búsqueda global extendida a FAQs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { MatrizUrgencia } from '@shared/types'
import { HelpButton } from './help-button'

// Mock de resetWelcomeTour — no queremos que reload() rompa jsdom.
vi.mock('./welcome-tour', () => ({
  resetWelcomeTour: vi.fn()
}))

// Matriz por defecto: todo en cero (caso "todo al día" — sin tips dinámicos).
const EMPTY_MATRIZ: MatrizUrgencia = {
  urgenteSinAbono: 0,
  urgenteConAbono: 0,
  normalSinAbono: 0,
  normalConAbono: 0,
  atrasados: 0,
  total: 0,
  diasUrgencia: 2
}

type StubSpies = {
  matriz: ReturnType<typeof vi.fn>
  stats: ReturnType<typeof vi.fn>
  proveedores: ReturnType<typeof vi.fn>
}

function installApiStub(matriz: MatrizUrgencia = EMPTY_MATRIZ): StubSpies {
  const stats = {
    clientes: 10,
    pedidos: 5,
    facturas: 3,
    proveedores: 2,
    inventario: 4,
    clases: 1,
    estudiantes: 3,
    contratos: 0
  }
  const spies: StubSpies = {
    matriz: vi.fn().mockResolvedValue({ ok: true, data: matriz }),
    stats: vi.fn().mockResolvedValue({ ok: true, data: stats }),
    proveedores: vi.fn().mockResolvedValue({ ok: true, data: [] })
  }
  ;(window as unknown as { api: unknown }).api = {
    pedidos: { matrizUrgencia: spies.matriz },
    app: { statsGenerales: spies.stats },
    proveedores: { listar: spies.proveedores }
  }
  return spies
}

function renderAt(path = '/cotizador'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<HelpButton />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  installApiStub()
})

afterEach(() => {
  delete (window as unknown as { api?: unknown }).api
})

describe('HelpButton (regresión v1.4.0)', () => {
  it('click abre el popover y SE QUEDA abierto (bug raíz)', () => {
    renderAt('/cotizador')
    const toggle = screen.getByRole('button', { name: /abrir ayuda/i })

    fireEvent.click(toggle)

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

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('HelpButton — búsqueda global', () => {
  it('con query corta (<2 chars) sigue mostrando los tips de la ruta actual', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'a' } })

    expect(screen.getByText('Cotizar un trabajo')).toBeTruthy()
    expect(screen.queryByText(/resultados de búsqueda/i)).toBeNull()
  })

  it('con query ≥2 chars filtra tips de todas las rutas', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'factura' } })

    expect(screen.getByText(/resultados de búsqueda/i)).toBeTruthy()
    const hits = screen.getAllByText(/factura/i)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('la búsqueda también encuentra preguntas frecuentes (FAQ)', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'imprimir' } })

    // El FAQ "¿Cómo genero una factura en PDF para imprimir?" debe aparecer.
    expect(screen.getByText(/pregunta común/i)).toBeTruthy()
    expect(screen.getByText(/¿cómo genero una factura/i)).toBeTruthy()
  })

  it('mensaje amable cuando la búsqueda no encuentra nada', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'xyzinexistente123' } })

    expect(screen.getByText(/no encontramos nada/i)).toBeTruthy()
  })
})

describe('HelpButton — tips con navegación', () => {
  it('muestra botón "Ir ahí" cuando el tip tiene un destino', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

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

describe('HelpButton — tips dinámicos (v1.5.0)', () => {
  it('NO muestra tips dinámicos cuando la matriz está vacía', async () => {
    installApiStub(EMPTY_MATRIZ)
    renderAt('/pedidos')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    // Esperamos a que el hook resuelva (primer microtask).
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByText(/pedidos atrasados/i)).toBeNull()
  })

  it('muestra tip "Tienes N pedidos atrasados" cuando hay atrasados', async () => {
    installApiStub({ ...EMPTY_MATRIZ, atrasados: 3, total: 10 })
    renderAt('/pedidos')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    // Esperar a que el hook resuelva.
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/3 pedidos atrasados/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /ver ahora/i })).toBeTruthy()
  })

  it('muestra tip "Hay N pedidos sin abono" cuando corresponde', async () => {
    installApiStub({ ...EMPTY_MATRIZ, urgenteSinAbono: 1, normalSinAbono: 2, total: 3 })
    renderAt('/pedidos')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/3 pedidos sin abono/i)).toBeTruthy()
  })

  it('los tips dinámicos también aparecen en el dashboard (/)', async () => {
    installApiStub({ ...EMPTY_MATRIZ, atrasados: 1, total: 5 })
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/1 pedido atrasado/i)).toBeTruthy()
  })
})

describe('HelpButton — tabs Tips/FAQ (v1.5.0)', () => {
  it('muestra Tips por defecto cuando se abre el popover', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const tipsTab = screen.getByRole('tab', { name: /tips/i })
    const faqTab = screen.getByRole('tab', { name: /preguntas comunes/i })
    expect(tipsTab.getAttribute('aria-selected')).toBe('true')
    expect(faqTab.getAttribute('aria-selected')).toBe('false')
  })

  it('click en "Preguntas comunes" cambia al tab FAQ', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const faqTab = screen.getByRole('tab', { name: /preguntas comunes/i })
    fireEvent.click(faqTab)

    expect(faqTab.getAttribute('aria-selected')).toBe('true')
    // Debe aparecer al menos una pregunta FAQ.
    expect(screen.getByText(/¿cómo cobro un abono/i)).toBeTruthy()
  })

  it('click en una pregunta FAQ la expande y muestra los pasos', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    fireEvent.click(screen.getByRole('tab', { name: /preguntas comunes/i }))

    // Expandir la primera FAQ.
    const faqButton = screen.getByRole('button', { name: /¿cómo cobro un abono/i })
    expect(faqButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(faqButton)
    expect(faqButton.getAttribute('aria-expanded')).toBe('true')

    // Los pasos (ol > li) deben aparecer.
    const pasos = document.querySelectorAll('ol li')
    expect(pasos.length).toBeGreaterThan(1)
  })

  it('durante búsqueda se ocultan los tabs', () => {
    renderAt('/cotizador')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))

    const input = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(input, { target: { value: 'factura' } })

    expect(screen.queryByRole('tab', { name: /tips/i })).toBeNull()
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

// Smoke test: abrir el popover en cada uno de los 12 módulos y verificar
// que renderiza sin errores con el heading esperado. Detecta rutas mal
// configuradas que el usuario no notaría hasta que las abra.
describe('HelpButton — alcance por módulo (smoke)', () => {
  const rutas: Array<[string, string]> = [
    ['/', '¿Qué hacer hoy?'],
    ['/cotizador', 'Cotizar un trabajo'],
    ['/pedidos', 'Gestionar pedidos'],
    ['/facturas', 'Facturas y cobros'],
    ['/clientes', 'Directorio de clientes'],
    ['/proveedores', 'Proveedores'],
    ['/clases', 'Clases de dibujo'],
    ['/inventario', 'Inventario de materiales'],
    ['/finanzas', 'Finanzas del taller'],
    ['/agenda', 'Agenda de entregas'],
    ['/contratos', 'Contratos'],
    ['/configuracion', 'Configuración']
  ]

  it.each(rutas)('ruta %s muestra heading esperado', (ruta, heading) => {
    renderAt(ruta)
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))
    expect(screen.getByText(heading)).toBeTruthy()
  })
})

describe('HelpButton — auto-refresh al abrir (v1.5.0)', () => {
  it('llama a los refetch de matriz, stats y proveedores al abrir el popover', async () => {
    const spies = installApiStub()
    renderAt('/pedidos')

    // Esperamos al primer fetch de montaje (los hooks llaman una vez al mount).
    await act(async () => {
      await Promise.resolve()
    })
    const matrizInicial = spies.matriz.mock.calls.length
    const statsInicial = spies.stats.mock.calls.length
    const proveedoresInicial = spies.proveedores.mock.calls.length

    // Abrir el popover debe disparar un refetch adicional.
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(spies.matriz.mock.calls.length).toBeGreaterThan(matrizInicial)
    expect(spies.stats.mock.calls.length).toBeGreaterThan(statsInicial)
    expect(spies.proveedores.mock.calls.length).toBeGreaterThan(proveedoresInicial)
  })
})

describe('HelpButton — empty-state (v1.5.0)', () => {
  it('muestra tip "Aún no tienes clientes" cuando clientes = 0', async () => {
    ;(window as unknown as { api: unknown }).api = {
      pedidos: { matrizUrgencia: vi.fn().mockResolvedValue({ ok: true, data: EMPTY_MATRIZ }) },
      app: {
        statsGenerales: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            clientes: 0,
            pedidos: 5,
            facturas: 3,
            proveedores: 2,
            inventario: 4,
            clases: 1,
            estudiantes: 3,
            contratos: 0
          }
        })
      },
      proveedores: { listar: vi.fn().mockResolvedValue({ ok: true, data: [] }) }
    }

    renderAt('/clientes')
    fireEvent.click(screen.getByRole('button', { name: /abrir ayuda/i }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/aún no tienes clientes/i)).toBeTruthy()
  })
})
