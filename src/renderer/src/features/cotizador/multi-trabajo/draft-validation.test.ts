// Tests del validador de drafts del flujo multi-trabajo. Hardening
// del informe e2fe3c7: localStorage corrupto bajo `multitrabajo:wip`
// crasheaba la ruta porque solo se chequeaba `Array.isArray(parsed.trabajos)`.
import { describe, expect, it } from 'vitest'
import { validarEstadoMultiTrabajo } from './draft-validation'
import type { TrabajoEnSesion, EstadoMultiTrabajo } from './types'

// Factory de un trabajo válido completo. Cada test parte de éste y lo muta
// para producir el caso edge a probar — más legible que repetir el shape.
function trabajoValido(): TrabajoEnSesion {
  return {
    idLocal: 't-1',
    tipoTrabajo: 'enmarcacion_estandar',
    data: {
      anchoCm: 50,
      altoCm: 70,
      muestraMarcoId: 1,
      muestraMarco: {
        id: 1,
        referencia: 'M-001',
        descripcion: null,
        colillaCm: 20,
        precioMetro: 10000,
        costoMetroEstimado: 6000,
        proveedorId: null,
        proveedorNombre: null,
        proveedorActivo: null,
        activo: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      },
      conPaspartu: false,
      tipoPaspartu: 'pintado',
      anchoPaspartuCm: 5,
      conSuplemento: false,
      conVidrio: true,
      tipoVidrio: 'claro',
      porcentajeMateriales: 10,
      precioManual: 0,
      costoManualEstimado: 0,
      descripcionManual: '',
      precioInstalacion: 0,
      costoInstalacionEstimado: 0,
      tipoVidrioEspejo: '',
      conDescuento: false,
      descuentoNum: 0,
      motivoDescuento: '',
      conAbono: true,
      abonoNum: 0,
      metodoPago: 'efectivo',
      notas: '',
      tipoEntrega: 'estandar'
    },
    cotizacion: {
      items: [],
      subtotal: 100000,
      totalMateriales: 10000,
      brutoCotizado: 110000,
      precioLista: 110000,
      precioTotal: 110000,
      costoEstimadoTotal: 60000,
      margenEstimado: 50000,
      margenEstimadoPct: 4545,
      estadoRentabilidad: 'saludable'
    }
  }
}

function estadoValido(): EstadoMultiTrabajo {
  return {
    cliente: null,
    trabajos: [trabajoValido()],
    descuento: null,
    abono: null,
    tipoEntrega: 'estandar',
    notas: '',
    fechaIngreso: '2026-05-06',
    fechaEntrega: null
  }
}

describe('validarEstadoMultiTrabajo', () => {
  // -- Rechazos en el shape raíz -------------------------------------------

  it('rechaza null/undefined/primitivos', () => {
    expect(validarEstadoMultiTrabajo(null)).toBeNull()
    expect(validarEstadoMultiTrabajo(undefined)).toBeNull()
    expect(validarEstadoMultiTrabajo('foo')).toBeNull()
    expect(validarEstadoMultiTrabajo(42)).toBeNull()
    expect(validarEstadoMultiTrabajo(true)).toBeNull()
  })

  it('rechaza arrays como root', () => {
    expect(validarEstadoMultiTrabajo([])).toBeNull()
    expect(validarEstadoMultiTrabajo([1, 2])).toBeNull()
  })

  it('rechaza objeto sin trabajos array (PoC informe — `{}`)', () => {
    expect(validarEstadoMultiTrabajo({})).toBeNull()
  })

  it('rechaza trabajos no-array', () => {
    expect(validarEstadoMultiTrabajo({ trabajos: 'foo' })).toBeNull()
    expect(validarEstadoMultiTrabajo({ trabajos: null })).toBeNull()
    expect(validarEstadoMultiTrabajo({ trabajos: 42 })).toBeNull()
  })

  // -- Rechazos por trabajo malformado (PoCs del informe) -----------------

  it('rechaza trabajos con entry vacía `{}` (PoC del informe)', () => {
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [{}] })
    ).toBeNull()
  })

  it('rechaza tipoTrabajo desconocido', () => {
    const t = trabajoValido()
    const malo = { ...t, tipoTrabajo: 'inventado' as never }
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [malo] })
    ).toBeNull()
  })

  it('rechaza idLocal vacío o no string', () => {
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        trabajos: [{ ...trabajoValido(), idLocal: '' }]
      })
    ).toBeNull()
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        trabajos: [{ ...trabajoValido(), idLocal: 42 as never }]
      })
    ).toBeNull()
  })

  it('rechaza cotizacion missing', () => {
    const t = trabajoValido()
    const sinCot = { idLocal: t.idLocal, tipoTrabajo: t.tipoTrabajo, data: t.data }
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [sinCot] })
    ).toBeNull()
  })

  it('rechaza cotizacion.precioLista no-finito (Infinity, NaN, string)', () => {
    for (const valor of [Infinity, -Infinity, NaN, '110000']) {
      const t = trabajoValido()
      const malo = { ...t, cotizacion: { ...t.cotizacion, precioLista: valor as never } }
      expect(
        validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [malo] })
      ).toBeNull()
    }
  })

  it('rechaza data missing o no objeto', () => {
    const base = trabajoValido()
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        trabajos: [{ idLocal: base.idLocal, tipoTrabajo: base.tipoTrabajo, cotizacion: base.cotizacion }]
      })
    ).toBeNull()
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        trabajos: [{ ...base, data: 'foo' as never }]
      })
    ).toBeNull()
  })

  it('rechaza data con campo numérico no-finito', () => {
    const t = trabajoValido()
    const malo = { ...t, data: { ...t.data, anchoCm: NaN } }
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [malo] })
    ).toBeNull()
  })

  // -- Rechazos en cliente / descuento / abono / tipoEntrega -----------

  it('rechaza cliente con shape inválido', () => {
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), cliente: 'string-no-objeto' })
    ).toBeNull()
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), cliente: { id: 'no-numero', nombre: 'Ana' } })
    ).toBeNull()
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), cliente: { id: 0, nombre: 'Ana' } })
    ).toBeNull()
  })

  it('rechaza descuento con monto no-numérico', () => {
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        descuento: { monto: 'abc' as never, motivo: 'x' }
      })
    ).toBeNull()
  })

  it('rechaza abono con metodoPago fuera de catálogo', () => {
    expect(
      validarEstadoMultiTrabajo({
        ...estadoValido(),
        abono: { monto: 1000, metodoPago: 'criptomoneda' as never, fecha: '2026-05-06' }
      })
    ).toBeNull()
  })

  it('rechaza tipoEntrega fuera de catálogo', () => {
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), tipoEntrega: 'lo-que-sea' as never })
    ).toBeNull()
  })

  it('rechaza notas no-string', () => {
    expect(
      validarEstadoMultiTrabajo({ ...estadoValido(), notas: 42 as never })
    ).toBeNull()
  })

  // -- Aceptación happy path ----------------------------------------------

  it('acepta estado mínimo válido (trabajos vacío)', () => {
    const r = validarEstadoMultiTrabajo({ ...estadoValido(), trabajos: [] })
    expect(r).not.toBeNull()
    expect(r!.trabajos).toEqual([])
  })

  it('acepta estado con un trabajo válido (round-trip)', () => {
    const original = estadoValido()
    const round = JSON.parse(JSON.stringify(original))
    const r = validarEstadoMultiTrabajo(round)
    expect(r).not.toBeNull()
    expect(r!.trabajos).toHaveLength(1)
    expect(r!.trabajos[0]!.cotizacion.precioLista).toBe(110000)
  })

  it('acepta cliente válido y normaliza', () => {
    const cliente = {
      id: 5,
      nombre: 'Ana Pérez',
      cedula: null,
      telefono: null,
      direccion: null,
      notas: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }
    const r = validarEstadoMultiTrabajo({ ...estadoValido(), cliente })
    expect(r).not.toBeNull()
    expect(r!.cliente).toEqual(cliente)
  })

  it('acepta descuento y abono con shape correcto', () => {
    const r = validarEstadoMultiTrabajo({
      ...estadoValido(),
      descuento: { monto: 5000, motivo: 'cliente recurrente' },
      abono: { monto: 50000, metodoPago: 'efectivo', fecha: '2026-05-06' }
    })
    expect(r).not.toBeNull()
    expect(r!.descuento).toEqual({ monto: 5000, motivo: 'cliente recurrente' })
    expect(r!.abono).toEqual({
      monto: 50000,
      metodoPago: 'efectivo',
      fecha: '2026-05-06'
    })
  })
})
