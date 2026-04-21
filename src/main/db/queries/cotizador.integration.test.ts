// Integration tests for the DB-backed cotizador entry points added by the
// business-correctness audit (worktree-agent-ad7e00e2). These complement the
// pure-function tests in `cotizador.test.ts` by exercising the functions that
// read from the price lists and compose multiple items.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { muestrasMarcos, preciosVidrios } from '../schema'
import { redondearPrecioFinal } from '@shared/redondeo'
import {
  actualizarPrecioRetablo,
  actualizarPrecioVidrio,
  cotizarAcolchado,
  cotizarVidrioEspejo,
  crearMuestraMarco,
  crearPrecioBastidor,
  crearPrecioPaspartuAcrilico,
  crearPrecioPaspartuPintado,
  crearPrecioRetablo,
  crearPrecioTapa,
  crearPrecioVidrio
} from './cotizador'

describe.runIf(nativeAbiAvailable)('cotizarVidrioEspejo (Fase 2 §A.8)', () => {
  let db: DB

  beforeEach(() => {
    const testDb = createTestDb()
    db = testDb.db
    // Seed the vidrio lookup: claro a $100.000/m2, antirreflectivo a $115.000/m2.
    db.insert(preciosVidrios).values({ tipo: 'claro', precioM2: 100000 }).run()
    db.insert(preciosVidrios).values({ tipo: 'antirreflectivo', precioM2: 115000 }).run()
  })

  it('redondea dimensiones al múltiplo de 10 y calcula área × precio/m²', () => {
    // 46x37 → redondea a 50x40 → área 0.20 m² → × $100.000 = $20.000.
    const result = cotizarVidrioEspejo(db, {
      anchoCm: 46,
      altoCm: 37,
      tipoVidrio: 'claro'
    })
    expect(result.items).toHaveLength(1)
    const vidrio = result.items[0]
    expect(vidrio.tipoItem).toBe('vidrio')
    expect(vidrio.subtotal).toBe(20000)
    expect(vidrio.metadata?.anchoRedondeado).toBe(50)
    expect(vidrio.metadata?.altoRedondeado).toBe(40)
    expect(vidrio.metadata?.areaM2).toBeCloseTo(0.2, 5)
    // No materiales adicionales para vidrio/espejo a domicilio.
    expect(result.totalMateriales).toBe(0)
    expect(result.precioTotal).toBe(20000)
  })

  it('suma el costo de instalación como ítem separado', () => {
    const result = cotizarVidrioEspejo(db, {
      anchoCm: 46,
      altoCm: 37,
      tipoVidrio: 'claro',
      precioInstalacion: 35000
    })
    expect(result.items).toHaveLength(2)
    expect(result.items[1].tipoItem).toBe('instalacion')
    expect(result.items[1].subtotal).toBe(35000)
    expect(result.precioTotal).toBe(20000 + 35000)
  })

  it('ignora precioInstalacion negativo/NaN (clamp a 0)', () => {
    const result = cotizarVidrioEspejo(db, {
      anchoCm: 50,
      altoCm: 40,
      tipoVidrio: 'claro',
      precioInstalacion: -500
    })
    // Sólo el ítem de vidrio, ninguna instalación con monto inválido.
    expect(result.items).toHaveLength(1)
    expect(result.precioTotal).toBe(20000)
  })

  it('lanza si el tipo de vidrio no está configurado', () => {
    // Borramos la fila antirreflectivo para simular la ausencia del precio.
    const freshDb = createTestDb().db
    freshDb.insert(preciosVidrios).values({ tipo: 'claro', precioM2: 100000 }).run()
    expect(() =>
      cotizarVidrioEspejo(freshDb, {
        anchoCm: 50,
        altoCm: 40,
        tipoVidrio: 'antirreflectivo'
      })
    ).toThrow(/antirreflectivo/)
  })
})

describe.runIf(nativeAbiAvailable)('cotizarAcolchado + marco opcional (Fase 2 §A.5)', () => {
  let db: DB

  beforeEach(() => {
    const testDb = createTestDb()
    db = testDb.db
    db.insert(muestrasMarcos)
      .values({
        referencia: 'K473',
        colillaCm: 48,
        precioMetro: 48000
      })
      .run()
  })

  it('sin marco: sólo aplica la fórmula base (ancho × alto × 15)', () => {
    // 30×40 → 18000 base + 10% materiales = 19800 → redondeado a 20000 (múltiplo de $1.000).
    const result = cotizarAcolchado(db, {
      anchoCm: 30,
      altoCm: 40,
      porcentajeMateriales: 10
    })
    expect(result.items).toHaveLength(2) // acolchado + materiales_adicionales
    expect(result.items[0].tipoItem).toBe('acolchado')
    expect(result.items[0].subtotal).toBe(18000)
    expect(result.subtotal).toBe(18000)
    expect(result.totalMateriales).toBe(1800)
    expect(result.precioTotal).toBe(20000)
    expect(result.precioTotal % 1000).toBe(0)
  })

  it('con marco: suma acolchado + marco y aplica materiales sobre el combinado', () => {
    // 50×70 acolchado = 50*70*15 = 52500.
    // Marco K473 @ 50×70 colilla 48 $48k/m = (perímetro 240 + 48) = 288 cm = 2.88 m × 48000 = 138240.
    // Subtotal combinado = 52500 + 138240 = 190740.
    // Materiales 10% = 19074. Bruto = 209814 → redondeado a 210000 (múltiplo de $1.000).
    const muestra = db.select().from(muestrasMarcos).get()
    expect(muestra).toBeTruthy()
    const result = cotizarAcolchado(db, {
      anchoCm: 50,
      altoCm: 70,
      muestraMarcoId: muestra!.id,
      porcentajeMateriales: 10
    })

    const acolchadoItem = result.items.find((i) => i.tipoItem === 'acolchado')
    const marcoItem = result.items.find((i) => i.tipoItem === 'marco')
    const materialesItem = result.items.find((i) => i.tipoItem === 'materiales_adicionales')

    expect(acolchadoItem?.subtotal).toBe(52500)
    expect(marcoItem?.subtotal).toBe(138240)
    expect(marcoItem?.referencia).toBe('K473')
    expect(result.subtotal).toBe(52500 + 138240)
    expect(result.totalMateriales).toBe(Math.round(result.subtotal * 0.1))
    expect(materialesItem?.subtotal).toBe(result.totalMateriales)
    expect(result.precioTotal).toBe(redondearPrecioFinal(result.subtotal + result.totalMateriales))
    expect(result.precioTotal).toBe(210000)
    expect(result.precioTotal % 1000).toBe(0)
  })

  it('con muestraMarcoId inexistente: lanza error claro', () => {
    expect(() =>
      cotizarAcolchado(db, {
        anchoCm: 30,
        altoCm: 40,
        muestraMarcoId: 99999
      })
    ).toThrow(/muestra de marco/i)
  })
})

// ---------------------------------------------------------------------------
// Sprint 2 · A3 — validación de precios positivos antes del insert.
// Antes las funciones `crear*` aceptaban silenciosamente precios negativos
// o cero; bastaba con un IPC mal armado para envenenar la lista de precios.
// Estos tests garantizan que cada entry point falla con mensaje legible.
// ---------------------------------------------------------------------------

describe.runIf(nativeAbiAvailable)('cotizador · A3 validar precios > 0', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  describe('crearMuestraMarco', () => {
    it('rechaza colilla 0', () => {
      expect(() =>
        crearMuestraMarco(db, { referencia: 'K001', colillaCm: 0, precioMetro: 48000 })
      ).toThrow(/colilla/i)
    })

    it('rechaza colilla negativa', () => {
      expect(() =>
        crearMuestraMarco(db, { referencia: 'K001', colillaCm: -5, precioMetro: 48000 })
      ).toThrow(/colilla/i)
    })

    it('rechaza precioMetro 0', () => {
      expect(() =>
        crearMuestraMarco(db, { referencia: 'K001', colillaCm: 48, precioMetro: 0 })
      ).toThrow(/precio.*metro/i)
    })

    it('rechaza precioMetro negativo', () => {
      expect(() =>
        crearMuestraMarco(db, { referencia: 'K001', colillaCm: 48, precioMetro: -100 })
      ).toThrow(/precio.*metro/i)
    })

    it('rechaza referencia vacía', () => {
      expect(() =>
        crearMuestraMarco(db, { referencia: '   ', colillaCm: 48, precioMetro: 48000 })
      ).toThrow(/referencia/i)
    })

    it('acepta datos válidos', () => {
      const m = crearMuestraMarco(db, {
        referencia: 'K001',
        colillaCm: 48,
        precioMetro: 48000
      })
      expect(m.referencia).toBe('K001')
    })
  })

  describe('crearPrecioVidrio', () => {
    it('rechaza precio 0', () => {
      expect(() => crearPrecioVidrio(db, 'claro', 0)).toThrow(/mayor a 0/i)
    })

    it('rechaza precio negativo', () => {
      expect(() => crearPrecioVidrio(db, 'claro', -1000)).toThrow(/mayor a 0/i)
    })

    it('rechaza tipo vacío', () => {
      expect(() => crearPrecioVidrio(db, '   ', 100000)).toThrow(/tipo/i)
    })

    it('actualizarPrecioVidrio también rechaza valores inválidos', () => {
      const v = crearPrecioVidrio(db, 'claro', 100000)
      expect(() => actualizarPrecioVidrio(db, v!.id, 0)).toThrow(/mayor a 0/i)
      expect(() => actualizarPrecioVidrio(db, v!.id, -1)).toThrow(/mayor a 0/i)
    })
  })

  describe('crearPrecioPaspartu/Retablo/Bastidor/Tapa (validarMedidaPrecioCreate)', () => {
    it('crearPrecioPaspartuPintado rechaza precio 0', () => {
      expect(() =>
        crearPrecioPaspartuPintado(db, { anchoCm: 30, altoCm: 40, precio: 0 })
      ).toThrow(/precio.*mayor a 0/i)
    })

    it('crearPrecioPaspartuPintado rechaza ancho 0', () => {
      expect(() =>
        crearPrecioPaspartuPintado(db, { anchoCm: 0, altoCm: 40, precio: 10000 })
      ).toThrow(/ancho.*mayor a 0/i)
    })

    it('crearPrecioPaspartuAcrilico rechaza alto negativo', () => {
      expect(() =>
        crearPrecioPaspartuAcrilico(db, { anchoCm: 30, altoCm: -5, precio: 10000 })
      ).toThrow(/alto.*mayor a 0/i)
    })

    it('crearPrecioRetablo rechaza precio NaN', () => {
      expect(() =>
        crearPrecioRetablo(db, { anchoCm: 30, altoCm: 40, precio: Number.NaN })
      ).toThrow(/precio.*mayor a 0/i)
    })

    it('crearPrecioBastidor rechaza todo en 0', () => {
      expect(() => crearPrecioBastidor(db, { anchoCm: 0, altoCm: 0, precio: 0 })).toThrow(
        /mayor a 0/i
      )
    })

    it('crearPrecioTapa acepta datos válidos', () => {
      const row = crearPrecioTapa(db, { anchoCm: 30, altoCm: 40, precio: 15000 })
      expect(row.precio).toBe(15000)
    })

    it('actualizarPrecioRetablo rechaza precio 0', () => {
      const r = crearPrecioRetablo(db, { anchoCm: 30, altoCm: 40, precio: 10000 })
      expect(() => actualizarPrecioRetablo(db, r.id, 0)).toThrow(/mayor a 0/i)
    })
  })
})
