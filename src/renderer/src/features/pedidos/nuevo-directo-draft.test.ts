// Tests del validador de draft del pedido directo. Cubre los PoCs del
// informe de seguridad sobre el commit `65762f0` (validator shallow que
// dejaba pasar items malformados y crasheaba el render) además de los
// caminos hostiles típicos: enums fuera de rango, números no-finitos,
// strings excesivamente largos, payloads completos válidos.
//
// Política bajo prueba: si CUALQUIER campo del draft está malformado,
// el validator retorna null. `loadAutoSaveDraft` se encarga de limpiar
// la key cuando el validator devuelve null, así el crash persistente
// del bug original no puede reocurrir.
import { describe, expect, it } from 'vitest'
import {
  clampearDias,
  validarPedidoDirectoDraft,
  type PedidoDirectoDraft
} from './nuevo-directo-draft'

// Helper: arma un draft válido base, los tests sobreescriben campos
// específicos para probar rechazos puntuales.
function draftBase(overrides: Partial<PedidoDirectoDraft> = {}): unknown {
  return {
    clienteId: null,
    tipoTrabajo: 'enmarcacion_estandar',
    descripcion: '',
    anchoCm: null,
    altoCm: null,
    fechaIngreso: '2026-05-12',
    fechaEntregaEditada: null,
    tipoEntrega: 'estandar',
    estadoInicial: 'confirmado',
    notas: '',
    items: [],
    trabajos: [],
    precioTotalOverride: null,
    conAbono: false,
    abonoMonto: 0,
    abonoMetodo: 'efectivo',
    abonoFechaEditada: null,
    generarPDF: false,
    ...overrides
  }
}

function itemValido(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: 'item-1',
    tipoItem: 'otro',
    descripcion: 'Item de prueba',
    referencia: '',
    cantidad: 1,
    precioUnitario: 1000,
    costoUnitarioEstimado: null,
    trabajoIdLocal: null,
    ...overrides
  }
}

function trabajoValido(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { idLocal: 't-abc', nombre: 'Cuadro de la abuela', ...overrides }
}

describe('validarPedidoDirectoDraft — happy path', () => {
  it('acepta un draft vacío válido (compat con pedido directo simple)', () => {
    const draft = validarPedidoDirectoDraft(draftBase())
    expect(draft).not.toBeNull()
    expect(draft?.items).toEqual([])
    expect(draft?.trabajos).toEqual([])
  })

  it('acepta un draft con 1 item válido', () => {
    const draft = validarPedidoDirectoDraft(draftBase({ items: [itemValido()] as never }))
    expect(draft).not.toBeNull()
    expect(draft?.items).toHaveLength(1)
    expect(draft?.items[0]?.descripcion).toBe('Item de prueba')
  })

  it('acepta un draft con 1 trabajo + 2 items asociados', () => {
    const draft = validarPedidoDirectoDraft(
      draftBase({
        trabajos: [trabajoValido()] as never,
        items: [
          itemValido({ uid: 'item-1', trabajoIdLocal: 't-abc' }),
          itemValido({ uid: 'item-2', trabajoIdLocal: 't-abc' })
        ] as never
      })
    )
    expect(draft).not.toBeNull()
    expect(draft?.trabajos).toHaveLength(1)
    expect(draft?.items).toHaveLength(2)
  })

  it('acepta items con descripcion vacía mientras se llena el form', () => {
    // El form permite que el dueño tenga un item recién creado con
    // descripcion="". Esto debe pasar el validator (no es malformación,
    // es estado intermedio normal).
    const draft = validarPedidoDirectoDraft(
      draftBase({ items: [itemValido({ descripcion: '' })] as never })
    )
    expect(draft).not.toBeNull()
  })
})

describe('validarPedidoDirectoDraft — PoCs del informe de seguridad', () => {
  // El payload exacto del informe.
  it('rechaza draft con items vacíos {} (PoC original del informe)', () => {
    const malicioso = {
      fechaIngreso: '2026-01-01',
      tipoTrabajo: 'enmarcacion_estandar',
      tipoEntrega: 'estandar',
      estadoInicial: 'confirmado',
      abonoMetodo: 'efectivo',
      descripcion: '',
      notas: '',
      items: [{}], // <-- item shape vacío, crasheaba it.descripcion.trim()
      trabajos: [],
      clienteId: null,
      anchoCm: null,
      altoCm: null,
      fechaEntregaEditada: null,
      precioTotalOverride: null,
      conAbono: false,
      abonoMonto: 0,
      abonoFechaEditada: null,
      generarPDF: false
    }
    expect(validarPedidoDirectoDraft(malicioso)).toBeNull()
  })

  it('rechaza item con descripcion null', () => {
    const draft = draftBase({ items: [itemValido({ descripcion: null })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con descripcion undefined (falta el campo)', () => {
    const item = itemValido()
    delete (item as Record<string, unknown>).descripcion
    const draft = draftBase({ items: [item] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con cantidad como string', () => {
    const draft = draftBase({ items: [itemValido({ cantidad: 'abc' })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con precioUnitario Infinity', () => {
    const draft = draftBase({
      items: [itemValido({ precioUnitario: Number.POSITIVE_INFINITY })] as never
    })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con precioUnitario NaN', () => {
    const draft = draftBase({ items: [itemValido({ precioUnitario: Number.NaN })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con costoUnitarioEstimado como string (debería ser number|null)', () => {
    const draft = draftBase({
      items: [itemValido({ costoUnitarioEstimado: 'abc' })] as never
    })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con tipoItem fuera del enum (ni TIPOS_ITEM_PEDIDO ni "otro")', () => {
    const draft = draftBase({ items: [itemValido({ tipoItem: 'inventado' })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza item con uid no-string', () => {
    const draft = draftBase({ items: [itemValido({ uid: 42 })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza si UN item de N falla (política todo-o-nada)', () => {
    const draft = draftBase({
      items: [itemValido(), itemValido({ descripcion: null }), itemValido()] as never
    })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza trabajo sin idLocal', () => {
    const draft = draftBase({ trabajos: [trabajoValido({ idLocal: '' })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza trabajo sin nombre (no es string)', () => {
    const draft = draftBase({ trabajos: [trabajoValido({ nombre: 42 })] as never })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })

  it('rechaza si UN trabajo de N falla', () => {
    const draft = draftBase({
      trabajos: [trabajoValido(), trabajoValido({ idLocal: '' })] as never
    })
    expect(validarPedidoDirectoDraft(draft)).toBeNull()
  })
})

describe('validarPedidoDirectoDraft — campos top-level malformados', () => {
  it('rechaza raw no-objeto', () => {
    expect(validarPedidoDirectoDraft(null)).toBeNull()
    expect(validarPedidoDirectoDraft('hola')).toBeNull()
    expect(validarPedidoDirectoDraft(42)).toBeNull()
    expect(validarPedidoDirectoDraft([])).toBeNull()
  })

  it('rechaza tipoTrabajo fuera de enum', () => {
    expect(validarPedidoDirectoDraft(draftBase({ tipoTrabajo: 'inventado' as never }))).toBeNull()
  })

  it('rechaza tipoEntrega fuera de enum', () => {
    expect(
      validarPedidoDirectoDraft(draftBase({ tipoEntrega: 'cuandoSea' as never }))
    ).toBeNull()
  })

  it('rechaza estadoInicial fuera de enum', () => {
    expect(
      validarPedidoDirectoDraft(draftBase({ estadoInicial: 'pintado' as never }))
    ).toBeNull()
  })

  it('rechaza abonoMetodo fuera de enum', () => {
    expect(
      validarPedidoDirectoDraft(draftBase({ abonoMetodo: 'bitcoin' as never }))
    ).toBeNull()
  })

  it('rechaza clienteId con valor negativo', () => {
    expect(validarPedidoDirectoDraft(draftBase({ clienteId: -1 }))).toBeNull()
  })

  it('rechaza clienteId con decimal', () => {
    expect(validarPedidoDirectoDraft(draftBase({ clienteId: 1.5 }))).toBeNull()
  })

  it('rechaza precioTotalOverride Infinity', () => {
    expect(
      validarPedidoDirectoDraft(draftBase({ precioTotalOverride: Number.POSITIVE_INFINITY }))
    ).toBeNull()
  })

  it('rechaza conAbono no-boolean', () => {
    expect(validarPedidoDirectoDraft(draftBase({ conAbono: 'true' as never }))).toBeNull()
  })

  it('rechaza descripcion > 500 chars', () => {
    expect(
      validarPedidoDirectoDraft(draftBase({ descripcion: 'a'.repeat(501) }))
    ).toBeNull()
  })

  it('rechaza notas > 2000 chars (defense contra payloads de saturación)', () => {
    expect(validarPedidoDirectoDraft(draftBase({ notas: 'b'.repeat(2001) }))).toBeNull()
  })
})

describe('clampearDias — defense in depth contra DB corrupta', () => {
  it('valores válidos pasan tal cual', () => {
    expect(clampearDias(0, 7)).toBe(0)
    expect(clampearDias(3, 7)).toBe(3)
    expect(clampearDias(365, 7)).toBe(365)
  })

  it('null/undefined → fallback', () => {
    expect(clampearDias(null, 7)).toBe(7)
    expect(clampearDias(undefined, 7)).toBe(7)
  })

  it('PoC del informe: -2 → fallback (no propaga fecha en el pasado)', () => {
    expect(clampearDias(-2, 7)).toBe(7)
  })

  it('PoC del informe: 3.5 → fallback (no entero)', () => {
    expect(clampearDias(3.5, 7)).toBe(7)
  })

  it('PoC del informe: 100000000 → fallback (fuera de rango)', () => {
    expect(clampearDias(100000000, 7)).toBe(7)
  })

  it('NaN → fallback', () => {
    expect(clampearDias(Number.NaN, 7)).toBe(7)
  })

  it('Infinity → fallback', () => {
    expect(clampearDias(Number.POSITIVE_INFINITY, 7)).toBe(7)
  })

  it('366 → fallback (justo fuera de rango)', () => {
    expect(clampearDias(366, 7)).toBe(7)
  })
})
