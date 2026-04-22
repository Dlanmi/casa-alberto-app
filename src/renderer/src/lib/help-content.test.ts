// Tests puros de los resolvers dinámicos y helpers de help-content.ts.
// Sin renderizar componentes — solo funciones puras ejercitadas con
// contextos controlados.
import { describe, expect, it } from 'vitest'
import type { MatrizUrgencia, Proveedor, StatsGenerales } from '@shared/types'
import {
  getHelpForRoute,
  HELP_FAQ,
  HELP_ROUTES,
  resolveDynamicTips,
  tipAtrasados,
  tipDiaProveedorHoy,
  tipEmptyClases,
  tipEmptyClientes,
  tipEmptyContratos,
  tipEmptyInventario,
  tipEmptyPedidos,
  tipEmptyProveedores,
  tipSinAbono,
  tipUrgentes
} from './help-content'
import type { HelpContext } from './help-content'

const EMPTY_MATRIZ: MatrizUrgencia = {
  urgenteSinAbono: 0,
  urgenteConAbono: 0,
  normalSinAbono: 0,
  normalConAbono: 0,
  atrasados: 0,
  total: 0,
  diasUrgencia: 2
}

const EMPTY_STATS: StatsGenerales = {
  clientes: 0,
  pedidos: 0,
  facturas: 0,
  proveedores: 0,
  inventario: 0,
  clases: 0,
  estudiantes: 0,
  contratos: 0
}

function proveedor(overrides: Partial<Proveedor> = {}): Proveedor {
  return {
    id: 1,
    nombre: 'Alberto',
    producto: null,
    tipo: 'otro',
    telefono: null,
    diasPedido: null,
    formaPago: null,
    formaEntrega: null,
    notas: null,
    activo: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides
  } as Proveedor
}

describe('tipAtrasados', () => {
  it('devuelve null si no hay matriz', () => {
    expect(tipAtrasados({})).toBeNull()
  })

  it('devuelve null si atrasados = 0', () => {
    expect(tipAtrasados({ matriz: EMPTY_MATRIZ })).toBeNull()
  })

  it('singular cuando hay 1', () => {
    const tip = tipAtrasados({ matriz: { ...EMPTY_MATRIZ, atrasados: 1 } })
    expect(tip?.title).toMatch(/1 pedido atrasado$/)
  })

  it('plural cuando hay >1', () => {
    const tip = tipAtrasados({ matriz: { ...EMPTY_MATRIZ, atrasados: 5 } })
    expect(tip?.title).toMatch(/5 pedidos atrasados/)
    expect(tip?.to).toBe('/pedidos')
  })
})

describe('tipSinAbono', () => {
  it('suma urgente + normal sinAbono', () => {
    const tip = tipSinAbono({
      matriz: { ...EMPTY_MATRIZ, urgenteSinAbono: 2, normalSinAbono: 3 }
    })
    expect(tip?.title).toMatch(/5 pedidos sin abono/)
  })

  it('singular con 1', () => {
    const tip = tipSinAbono({ matriz: { ...EMPTY_MATRIZ, urgenteSinAbono: 1 } })
    expect(tip?.title).toMatch(/1 pedido sin abono$/)
  })

  it('null cuando todo al día', () => {
    expect(tipSinAbono({ matriz: EMPTY_MATRIZ })).toBeNull()
  })

  it('null cuando matriz es null', () => {
    expect(tipSinAbono({ matriz: null })).toBeNull()
  })
})

describe('tipUrgentes', () => {
  it('suma urgente con + sin abono', () => {
    const tip = tipUrgentes({
      matriz: { ...EMPTY_MATRIZ, urgenteSinAbono: 1, urgenteConAbono: 2 }
    })
    expect(tip?.title).toMatch(/3 pedidos entregan hoy/)
  })

  it('null sin urgentes', () => {
    expect(tipUrgentes({ matriz: EMPTY_MATRIZ })).toBeNull()
  })
})

describe('tipDiaProveedorHoy', () => {
  // Lunes 2026-04-20 — usamos fecha fija inyectada al contexto para
  // no depender del día real al correr los tests.
  const LUNES = new Date('2026-04-20T10:00:00')
  const MARTES = new Date('2026-04-21T10:00:00')

  it('null sin proveedores configurados', () => {
    expect(tipDiaProveedorHoy({ hoy: LUNES, proveedores: [] })).toBeNull()
    expect(tipDiaProveedorHoy({ hoy: LUNES, proveedores: null })).toBeNull()
  })

  it('null si ningún proveedor tiene hoy como día', () => {
    const ctx: HelpContext = {
      hoy: MARTES,
      proveedores: [proveedor({ diasPedido: 'lunes,miercoles' })]
    }
    expect(tipDiaProveedorHoy(ctx)).toBeNull()
  })

  it('singular cuando un solo proveedor tiene hoy', () => {
    const ctx: HelpContext = {
      hoy: LUNES,
      proveedores: [proveedor({ diasPedido: 'lunes,miercoles', nombre: 'Alberto' })]
    }
    const tip = tipDiaProveedorHoy(ctx)
    expect(tip?.title).toBe('Hoy toca pedir a Alberto')
    expect(tip?.to).toBe('/proveedores')
  })

  it('lista múltiples cuando varios coinciden', () => {
    const ctx: HelpContext = {
      hoy: LUNES,
      proveedores: [
        proveedor({ id: 1, diasPedido: 'lunes', nombre: 'Alberto' }),
        proveedor({ id: 2, diasPedido: 'lunes,viernes', nombre: 'Edimol' })
      ]
    }
    const tip = tipDiaProveedorHoy(ctx)
    expect(tip?.title).toMatch(/Alberto/)
    expect(tip?.title).toMatch(/Edimol/)
  })

  it('ignora proveedores inactivos', () => {
    const ctx: HelpContext = {
      hoy: LUNES,
      proveedores: [proveedor({ diasPedido: 'lunes', activo: false })]
    }
    expect(tipDiaProveedorHoy(ctx)).toBeNull()
  })

  it('respeta capitalización y espacios en el CSV', () => {
    const ctx: HelpContext = {
      hoy: LUNES,
      proveedores: [proveedor({ diasPedido: ' LUNES , miercoles ' })]
    }
    expect(tipDiaProveedorHoy(ctx)).not.toBeNull()
  })
})

describe('empty-state resolvers', () => {
  const pairs: Array<[string, typeof tipEmptyClientes, keyof StatsGenerales]> = [
    ['clientes', tipEmptyClientes, 'clientes'],
    ['pedidos', tipEmptyPedidos, 'pedidos'],
    ['proveedores', tipEmptyProveedores, 'proveedores'],
    ['inventario', tipEmptyInventario, 'inventario'],
    ['clases', tipEmptyClases, 'clases'],
    ['contratos', tipEmptyContratos, 'contratos']
  ]

  it.each(pairs)('%s: null cuando stats no cargaron', (_label, fn) => {
    expect(fn({})).toBeNull()
    expect(fn({ stats: null })).toBeNull()
  })

  it.each(pairs)('%s: null cuando n > 0', (_label, fn, key) => {
    const stats = { ...EMPTY_STATS, [key]: 3 }
    expect(fn({ stats })).toBeNull()
  })

  it.each(pairs)('%s: tip cuando n === 0', (_label, fn) => {
    const tip = fn({ stats: EMPTY_STATS })
    expect(tip).not.toBeNull()
    expect(tip!.title).toMatch(/Aún no tienes/i)
    expect(tip!.to).toBeDefined()
  })
})

describe('getHelpForRoute', () => {
  it('matchea ruta exacta /cotizador', () => {
    expect(getHelpForRoute('/cotizador').heading).toBe('Cotizar un trabajo')
  })

  it('matchea subrutas via prefix: /pedidos/123', () => {
    expect(getHelpForRoute('/pedidos/123').heading).toBe('Gestionar pedidos')
  })

  it('/ matchea solo exacto (no se come todas las rutas)', () => {
    expect(getHelpForRoute('/').heading).toBe('¿Qué hacer hoy?')
    // Una ruta distinta NO debe caer en '/'.
    expect(getHelpForRoute('/clientes').heading).toBe('Directorio de clientes')
  })

  it('ruta desconocida cae al fallback del dashboard', () => {
    expect(getHelpForRoute('/ruta-inexistente').heading).toBe('¿Qué hacer hoy?')
  })

  it('los 12 módulos del sidebar tienen heading propio', () => {
    const esperados = [
      '/',
      '/cotizador',
      '/pedidos',
      '/facturas',
      '/clientes',
      '/proveedores',
      '/clases',
      '/inventario',
      '/finanzas',
      '/agenda',
      '/contratos',
      '/configuracion'
    ]
    for (const ruta of esperados) {
      const heading = getHelpForRoute(ruta).heading
      expect(heading).toBeTruthy()
      // Ninguno debe caer al fallback genérico (salvo /).
      if (ruta !== '/') {
        expect(heading).not.toBe('¿Qué hacer hoy?')
      }
    }
  })
})

describe('resolveDynamicTips', () => {
  it('vacío si la ruta no tiene dynamicTips', () => {
    const cotizador = HELP_ROUTES.find((r) => r.prefix === '/cotizador')!
    expect(resolveDynamicTips(cotizador.content, {})).toEqual([])
  })

  it('filtra los null (resolvers que no aplican)', () => {
    const pedidos = HELP_ROUTES.find((r) => r.prefix === '/pedidos')!
    // Ctx vacío: todos los resolvers de /pedidos devuelven null.
    const resolved = resolveDynamicTips(pedidos.content, { stats: { ...EMPTY_STATS, pedidos: 5 } })
    expect(resolved).toEqual([])
  })

  it('retorna tips cuando hay datos reales', () => {
    const pedidos = HELP_ROUTES.find((r) => r.prefix === '/pedidos')!
    const resolved = resolveDynamicTips(pedidos.content, {
      matriz: { ...EMPTY_MATRIZ, atrasados: 2, total: 5 },
      stats: { ...EMPTY_STATS, pedidos: 5 }
    })
    expect(resolved.length).toBeGreaterThan(0)
    expect(resolved.some((t) => t.title.includes('atrasados'))).toBe(true)
  })
})

describe('HELP_FAQ', () => {
  it('tiene al menos 6 preguntas (v1.4.1 mínimo)', () => {
    expect(HELP_FAQ.length).toBeGreaterThanOrEqual(6)
  })

  it('cada FAQ tiene pasos no vacíos', () => {
    for (const faq of HELP_FAQ) {
      expect(faq.question.length).toBeGreaterThan(0)
      expect(faq.steps.length).toBeGreaterThan(0)
      for (const step of faq.steps) {
        expect(step.length).toBeGreaterThan(0)
      }
    }
  })
})
