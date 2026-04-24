// Tests puros de los resolvers dinámicos y helpers de help-content.ts.
// Sin renderizar componentes — solo funciones puras ejercitadas con
// contextos controlados.
import { describe, expect, it } from 'vitest'
import type {
  EntregaDelDia,
  MatrizUrgencia,
  PedidoSinAbonoConSaldo,
  Proveedor,
  StatsGenerales
} from '@shared/types'
import {
  getHelpForRoute,
  HELP_FAQ,
  HELP_ROUTES,
  resolveDynamicTips,
  tipAtrasados,
  tipDeudoresAccionables,
  tipDiaProveedorHoy,
  tipEmptyClases,
  tipEmptyClientes,
  tipEmptyContratos,
  tipEmptyInventario,
  tipEmptyPedidos,
  tipEmptyProveedores,
  tipEntregasHoy,
  tipPlaybookDelDia,
  tipProximaEntrega,
  tipResumenSemana,
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

// ---------------------------------------------------------------------------
// v1.6.0 — tipPlaybookDelDia y tipDeudoresAccionables
// ---------------------------------------------------------------------------

describe('tipPlaybookDelDia', () => {
  it('null si no hay ninguna señal (matriz vacía, sin proveedores hoy)', () => {
    expect(tipPlaybookDelDia({ matriz: EMPTY_MATRIZ, proveedores: [] })).toBeNull()
    expect(tipPlaybookDelDia({})).toBeNull()
  })

  it('incluye "atrasados" cuando matriz.atrasados > 0', () => {
    const tip = tipPlaybookDelDia({
      matriz: { ...EMPTY_MATRIZ, atrasados: 2 }
    })
    expect(tip).not.toBeNull()
    expect(tip!.title).toBe('Tu plan para hoy')
    expect(tip!.actionItems).toBeDefined()
    expect(tip!.actionItems!.length).toBeGreaterThan(0)
    expect(tip!.actionItems![0].label).toMatch(/2 pedidos atrasados/)
  })

  it('ordena prioridades: atrasados → urgentes → sin abono', () => {
    const tip = tipPlaybookDelDia({
      matriz: {
        ...EMPTY_MATRIZ,
        atrasados: 1,
        urgenteSinAbono: 1,
        normalSinAbono: 2
      }
    })
    const labels = tip!.actionItems!.map((i) => i.label.toLowerCase())
    expect(labels[0]).toContain('atrasado')
    expect(labels[1]).toContain('entrega')
    expect(labels[2]).toContain('sin abono')
  })

  it('incluye día de proveedor al final cuando aplica', () => {
    const LUNES = new Date('2026-04-20T10:00:00')
    const proveedor: Proveedor = {
      id: 1,
      nombre: 'Alberto',
      producto: null,
      tipo: 'otro',
      telefono: null,
      diasPedido: 'lunes',
      formaPago: null,
      formaEntrega: null,
      notas: null,
      activo: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as Proveedor
    const tip = tipPlaybookDelDia({
      matriz: { ...EMPTY_MATRIZ, atrasados: 1 },
      hoy: LUNES,
      proveedores: [proveedor]
    })
    const lastItem = tip!.actionItems![tip!.actionItems!.length - 1]
    expect(lastItem.label).toMatch(/Alberto/)
  })

  it('cada item tiene al menos una acción navigate', () => {
    const tip = tipPlaybookDelDia({
      matriz: { ...EMPTY_MATRIZ, atrasados: 1, urgenteSinAbono: 1 }
    })
    for (const item of tip!.actionItems!) {
      expect(item.actions.length).toBeGreaterThan(0)
      expect(item.actions[0].kind).toBe('navigate')
    }
  })
})

describe('tipDeudoresAccionables', () => {
  function deudor(overrides: Partial<PedidoSinAbonoConSaldo> = {}): PedidoSinAbonoConSaldo {
    return {
      pedidoId: 1,
      pedidoNumero: 'P-0001',
      clienteId: 1,
      clienteNombre: 'María López',
      clienteTelefono: '3104567890',
      saldoPendiente: 50000,
      diasSinAbono: 10,
      fechaEntrega: null,
      ...overrides
    }
  }

  it('null cuando no hay deudores', () => {
    expect(tipDeudoresAccionables({ deudores: [] })).toBeNull()
    expect(tipDeudoresAccionables({})).toBeNull()
    expect(tipDeudoresAccionables({ deudores: null })).toBeNull()
  })

  it('singular vs plural en el título', () => {
    expect(tipDeudoresAccionables({ deudores: [deudor()] })!.title).toBe('Un cliente te debe')
    expect(tipDeudoresAccionables({ deudores: [deudor(), deudor({ pedidoId: 2 })] })!.title).toBe(
      '2 clientes te deben'
    )
  })

  it('genera label con nombre y saldo formateado', () => {
    const tip = tipDeudoresAccionables({ deudores: [deudor({ saldoPendiente: 85000 })] })
    expect(tip!.actionItems![0].label).toMatch(/María López/)
    expect(tip!.actionItems![0].label).toMatch(/85/)
  })

  it('sublabel tiene número de pedido y días', () => {
    const tip = tipDeudoresAccionables({
      deudores: [deudor({ pedidoNumero: 'P-XYZ', diasSinAbono: 20 })]
    })
    expect(tip!.actionItems![0].sublabel).toMatch(/P-XYZ/)
    expect(tip!.actionItems![0].sublabel).toMatch(/20 días/)
  })

  it('con teléfono genera 3 acciones (WhatsApp, llamar, ver pedido)', () => {
    const tip = tipDeudoresAccionables({
      deudores: [deudor({ clienteTelefono: '3104567890' })]
    })
    const actions = tip!.actionItems![0].actions
    expect(actions).toHaveLength(3)
    expect(actions.map((a) => a.kind)).toContain('whatsapp')
    expect(actions.map((a) => a.kind)).toContain('call')
    expect(actions.map((a) => a.kind)).toContain('navigate')
  })

  it('sin teléfono solo muestra la acción navigate', () => {
    const tip = tipDeudoresAccionables({
      deudores: [deudor({ clienteTelefono: null })]
    })
    const actions = tip!.actionItems![0].actions
    expect(actions).toHaveLength(1)
    expect(actions[0].kind).toBe('navigate')
  })

  it('la acción "Ver pedido" enlaza al pedido específico (/pedidos/:id)', () => {
    const tip = tipDeudoresAccionables({
      deudores: [deudor({ pedidoId: 42 })]
    })
    const nav = tip!.actionItems![0].actions.find((a) => a.kind === 'navigate')
    expect(nav).toBeDefined()
    if (nav && nav.kind === 'navigate') {
      expect(nav.to).toBe('/pedidos/42')
    }
  })

  it('ignora teléfonos demasiado cortos (<7 dígitos)', () => {
    const tip = tipDeudoresAccionables({
      deudores: [deudor({ clienteTelefono: '12345' })]
    })
    expect(tip!.actionItems![0].actions).toHaveLength(1)
  })

  it('mensaje de WhatsApp incluye nombre y saldo', () => {
    const tip = tipDeudoresAccionables({
      deudores: [
        deudor({ clienteNombre: 'Juan Pérez', pedidoNumero: 'P-JU1', saldoPendiente: 70000 })
      ]
    })
    const wa = tip!.actionItems![0].actions.find((a) => a.kind === 'whatsapp')
    expect(wa).toBeDefined()
    if (wa && wa.kind === 'whatsapp') {
      expect(wa.mensaje).toMatch(/Juan/)
      expect(wa.mensaje).toMatch(/P-JU1/)
      expect(wa.mensaje).toMatch(/70/)
    }
  })
})

// ---------------------------------------------------------------------------
// v1.7.0 — tipEntregasHoy, tipResumenSemana, tipProximaEntrega
// ---------------------------------------------------------------------------

describe('tipEntregasHoy', () => {
  function entrega(overrides: Partial<EntregaDelDia> = {}): EntregaDelDia {
    return {
      pedidoId: 1,
      pedidoNumero: 'P-0001',
      clienteId: 1,
      clienteNombre: 'María López',
      clienteTelefono: '3104567890',
      fechaEntrega: '2026-04-24',
      tipoTrabajo: 'enmarcacion_estandar',
      estado: 'confirmado',
      ...overrides
    }
  }

  it('null cuando no hay entregas', () => {
    expect(tipEntregasHoy({ entregasHoy: [] })).toBeNull()
    expect(tipEntregasHoy({})).toBeNull()
    expect(tipEntregasHoy({ entregasHoy: null })).toBeNull()
  })

  it('singular con 1 entrega', () => {
    expect(tipEntregasHoy({ entregasHoy: [entrega()] })!.title).toBe('1 entrega hoy')
  })

  it('plural con >1', () => {
    const tip = tipEntregasHoy({
      entregasHoy: [entrega(), entrega({ pedidoId: 2 })]
    })
    expect(tip!.title).toBe('2 entregas hoy')
  })

  it('cada item incluye tipo de trabajo en sublabel', () => {
    const tip = tipEntregasHoy({
      entregasHoy: [entrega({ tipoTrabajo: 'acolchado', pedidoNumero: 'P-ACO' })]
    })
    expect(tip!.actionItems![0].sublabel).toMatch(/P-ACO/)
    expect(tip!.actionItems![0].sublabel).toMatch(/Acolchado/)
  })

  it('con teléfono: 2 acciones (llamar + ver pedido)', () => {
    const tip = tipEntregasHoy({
      entregasHoy: [entrega({ clienteTelefono: '3104567890' })]
    })
    const kinds = tip!.actionItems![0].actions.map((a) => a.kind)
    expect(kinds).toContain('call')
    expect(kinds).toContain('navigate')
    expect(kinds).not.toContain('whatsapp') // no es cobro, no tiene sentido WhatsApp
  })

  it('sin teléfono: solo navigate', () => {
    const tip = tipEntregasHoy({
      entregasHoy: [entrega({ clienteTelefono: null })]
    })
    expect(tip!.actionItems![0].actions).toHaveLength(1)
    expect(tip!.actionItems![0].actions[0].kind).toBe('navigate')
  })

  it('navigate enlaza al pedido específico', () => {
    const tip = tipEntregasHoy({
      entregasHoy: [entrega({ pedidoId: 99 })]
    })
    const nav = tip!.actionItems![0].actions.find((a) => a.kind === 'navigate')
    if (nav && nav.kind === 'navigate') {
      expect(nav.to).toBe('/pedidos/99')
    }
  })
})

describe('tipResumenSemana', () => {
  function entrega(overrides: Partial<EntregaDelDia> = {}): EntregaDelDia {
    return {
      pedidoId: 1,
      pedidoNumero: 'P-0001',
      clienteId: 1,
      clienteNombre: 'María',
      clienteTelefono: null,
      fechaEntrega: '2026-04-25',
      tipoTrabajo: 'enmarcacion_estandar',
      estado: 'confirmado',
      ...overrides
    }
  }

  it('null si no hay entregas ni proveedores con días', () => {
    expect(tipResumenSemana({ entregasSemana: [], proveedores: [] })).toBeNull()
  })

  it('incluye cantidad de entregas', () => {
    const tip = tipResumenSemana({
      entregasSemana: [entrega(), entrega({ pedidoId: 2 })]
    })
    expect(tip!.description).toMatch(/2 entregas/)
  })

  it('incluye días de proveedor únicos ordenados', () => {
    const prov: Proveedor = {
      id: 1,
      nombre: 'Alberto',
      producto: null,
      tipo: 'otro',
      telefono: null,
      diasPedido: 'lunes, miercoles',
      formaPago: null,
      formaEntrega: null,
      notas: null,
      activo: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as Proveedor
    const tip = tipResumenSemana({ proveedores: [prov] })
    expect(tip!.description).toMatch(/lunes/)
    expect(tip!.description).toMatch(/miercoles/)
  })

  it('ignora proveedores inactivos o sin diasPedido', () => {
    const inactivo = {
      id: 1,
      nombre: 'X',
      diasPedido: 'lunes',
      activo: false
    } as unknown as Proveedor
    const sinDias = {
      id: 2,
      nombre: 'Y',
      diasPedido: null,
      activo: true
    } as unknown as Proveedor
    expect(tipResumenSemana({ proveedores: [inactivo, sinDias] })).toBeNull()
  })
})

describe('tipProximaEntrega', () => {
  const HOY = new Date('2026-04-24T10:00:00')

  function entrega(fecha: string): EntregaDelDia {
    return {
      pedidoId: 1,
      pedidoNumero: 'P-0001',
      clienteId: 1,
      clienteNombre: 'María',
      clienteTelefono: '3104567890',
      fechaEntrega: fecha,
      tipoTrabajo: 'enmarcacion_estandar',
      estado: 'confirmado'
    }
  }

  it('null si hay entregas hoy (prefiere el tip directo)', () => {
    expect(
      tipProximaEntrega({
        entregasHoy: [entrega('2026-04-24')],
        entregasSemana: [entrega('2026-04-24'), entrega('2026-04-26')],
        hoy: HOY
      })
    ).toBeNull()
  })

  it('null si no hay entregas futuras', () => {
    expect(
      tipProximaEntrega({
        entregasHoy: [],
        entregasSemana: [entrega('2026-04-22')], // ya pasó
        hoy: HOY
      })
    ).toBeNull()
  })

  it('muestra la primera entrega futura', () => {
    const tip = tipProximaEntrega({
      entregasHoy: [],
      entregasSemana: [entrega('2026-04-26'), entrega('2026-04-28')],
      hoy: HOY
    })
    expect(tip).not.toBeNull()
    expect(tip!.title.toLowerCase()).toMatch(/pr.xima entrega/i)
  })
})
