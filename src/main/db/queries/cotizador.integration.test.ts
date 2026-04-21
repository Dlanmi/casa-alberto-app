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
  cotizarAdherido,
  cotizarEnmarcacionPaspartu,
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
      expect(() => crearPrecioPaspartuPintado(db, { anchoCm: 30, altoCm: 40, precio: 0 })).toThrow(
        /precio.*mayor a 0/i
      )
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
      expect(() => crearPrecioRetablo(db, { anchoCm: 30, altoCm: 40, precio: Number.NaN })).toThrow(
        /precio.*mayor a 0/i
      )
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

// ---------------------------------------------------------------------------
// Fase 2 §A.6 — Enmarcación Adherida (standalone)
// ---------------------------------------------------------------------------

describe.runIf(nativeAbiAvailable)('cotizarAdherido (Fase 2 §A.6)', () => {
  let db: DB

  beforeEach(() => {
    const testDb = createTestDb()
    db = testDb.db
  })

  it('tarifa pequeña (×10) + materiales: 30×40 genera item correcto', () => {
    // 30×40 → dentro de 55×65 → ×10 → 12.000 base.
    // Materiales 10% = 1.200. Bruto = 13.200 → redondeado a 14.000 (múltiplo de $1.000).
    const result = cotizarAdherido(db, {
      anchoCm: 30,
      altoCm: 40,
      porcentajeMateriales: 10
    })

    const adherido = result.items.find((i) => i.tipoItem === 'adherido')
    expect(adherido).toBeDefined()
    expect(adherido!.subtotal).toBe(12000)
    expect(adherido!.metadata?.multiplicadorAdherido).toBe(10)
    expect(adherido!.descripcion).toBe('Adherido 30x40cm')

    expect(result.subtotal).toBe(12000)
    expect(result.totalMateriales).toBe(1200)
    expect(result.precioTotal).toBe(14000)
  })

  it('tarifa grande (×7): 70×100 usa multiplicador 7', () => {
    // 70×100 → fuera de límite → ×7 → 49.000 base.
    // Materiales 10% = 4.900. Bruto = 53.900 → redondeo al múltiplo de $1.000.
    const result = cotizarAdherido(db, {
      anchoCm: 70,
      altoCm: 100,
      porcentajeMateriales: 10
    })

    const adherido = result.items.find((i) => i.tipoItem === 'adherido')
    expect(adherido!.subtotal).toBe(49000)
    expect(adherido!.metadata?.multiplicadorAdherido).toBe(7)

    expect(result.subtotal).toBe(49000)
    expect(result.totalMateriales).toBe(4900)
    // 53.900 redondeado al próximo múltiplo de $1.000 = 54.000.
    expect(result.precioTotal).toBe(54000)
  })

  it('frontera exacta 55×65: queda en tarifa pequeña (×10)', () => {
    // Garantiza que la regla "ambos lados dentro" sea inclusiva, tal como
    // confirmó el papá.
    const result = cotizarAdherido(db, {
      anchoCm: 55,
      altoCm: 65,
      porcentajeMateriales: 10
    })

    const adherido = result.items.find((i) => i.tipoItem === 'adherido')
    expect(adherido!.subtotal).toBe(35750)
    expect(adherido!.metadata?.multiplicadorAdherido).toBe(10)
  })

  it('cruce del límite: 56×65 salta a tarifa grande', () => {
    const result = cotizarAdherido(db, {
      anchoCm: 56,
      altoCm: 65,
      porcentajeMateriales: 10
    })
    const adherido = result.items.find((i) => i.tipoItem === 'adherido')
    expect(adherido!.subtotal).toBe(25480)
    expect(adherido!.metadata?.multiplicadorAdherido).toBe(7)
  })

  it('50×70 (lado mayor supera 65): tarifa grande aunque el menor sea ≤55', () => {
    // Este es el caso clave de la ambigüedad original: 50≤55 pero 70>65.
    // La regla "ambos dentro" → 70>65 descalifica → ×7.
    const result = cotizarAdherido(db, {
      anchoCm: 50,
      altoCm: 70,
      porcentajeMateriales: 10
    })
    const adherido = result.items.find((i) => i.tipoItem === 'adherido')
    expect(adherido!.subtotal).toBe(24500) // 50 × 70 × 7
    expect(adherido!.metadata?.multiplicadorAdherido).toBe(7)
  })

  it('materiales adicionales aplican sobre el subtotal correctamente', () => {
    // Verificamos que el porcentaje custom funciona (5% en vez del 10% default).
    const result = cotizarAdherido(db, {
      anchoCm: 30,
      altoCm: 40,
      porcentajeMateriales: 5
    })
    expect(result.subtotal).toBe(12000)
    expect(result.totalMateriales).toBe(600) // 5% de 12000
    // 12.600 redondeado al próximo múltiplo de $1.000 = 13.000.
    expect(result.precioTotal).toBe(13000)
  })
})

// ---------------------------------------------------------------------------
// Fase 2 §A.3.1 — Suplemento decorativo del paspartú
// ---------------------------------------------------------------------------

describe.runIf(nativeAbiAvailable)(
  'cotizarEnmarcacionPaspartu con suplemento (Fase 2 §A.3.1)',
  () => {
    let db: DB
    let muestraMarcoId: number

    beforeEach(() => {
      const testDb = createTestDb()
      db = testDb.db
      // Seed muestra de marco + precio paspartú pintado para que cotizarEnmarcacionPaspartu
      // tenga los lookups que necesita.
      const muestra = crearMuestraMarco(db, {
        referencia: 'K473',
        colillaCm: 48,
        precioMetro: 48000
      })
      muestraMarcoId = muestra.id
      // Precio paspartú para obra 60x80 ampliada con paspartú de 5cm → exterior 70x90.
      crearPrecioPaspartuPintado(db, { anchoCm: 70, altoCm: 90, precio: 22000 })
      // Precio vidrio.
      db.insert(preciosVidrios).values({ tipo: 'claro', precioM2: 100000 }).run()
    })

    it('sin suplemento: el breakdown NO incluye el item de suplemento', () => {
      const result = cotizarEnmarcacionPaspartu(db, {
        anchoCm: 60,
        altoCm: 80,
        anchoPaspartuCm: 5,
        tipoPaspartu: 'pintado',
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10
      })
      const suplementoItem = result.items.find((i) => i.tipoItem === 'suplemento')
      expect(suplementoItem).toBeUndefined()
    })

    it('con suplemento: agrega item y suma al subtotal', () => {
      // Obra 60×80 → perímetro (60+80)×2 = 280 cm = 2.8 m → 2.8 × 15000 = 42.000.
      const sin = cotizarEnmarcacionPaspartu(db, {
        anchoCm: 60,
        altoCm: 80,
        anchoPaspartuCm: 5,
        tipoPaspartu: 'pintado',
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10,
        conSuplemento: false
      })

      const con = cotizarEnmarcacionPaspartu(db, {
        anchoCm: 60,
        altoCm: 80,
        anchoPaspartuCm: 5,
        tipoPaspartu: 'pintado',
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10,
        conSuplemento: true
      })

      const suplementoItem = con.items.find((i) => i.tipoItem === 'suplemento')
      expect(suplementoItem).toBeDefined()
      expect(suplementoItem!.subtotal).toBe(42000)
      expect(suplementoItem!.metadata?.perimetroCm).toBe(280)

      // El subtotal 'con' debe ser exactamente el 'sin' + 42.000.
      expect(con.subtotal).toBe(sin.subtotal + 42000)
      // Los materiales también suben proporcionalmente (10% sobre el nuevo subtotal).
      expect(con.totalMateriales).toBe(Math.round(con.subtotal * 0.1))
    })

    it('suplemento usa medidas de la obra, no las exteriores del paspartú', () => {
      // Esto es CRÍTICO: el listón va en el borde INTERIOR del paspartú (contra la
      // obra), así que su perímetro es el de la obra, no el del marco. Ejemplo:
      // obra 20×30 con paspartú de 5cm → exterior 30×40. El suplemento debe
      // cobrarse sobre 20×30, no sobre 30×40.
      // Para testearlo necesitamos un precio paspartú para 30x40 exterior.
      crearPrecioPaspartuPintado(db, { anchoCm: 30, altoCm: 40, precio: 10000 })

      const result = cotizarEnmarcacionPaspartu(db, {
        anchoCm: 20,
        altoCm: 30,
        anchoPaspartuCm: 5,
        tipoPaspartu: 'pintado',
        muestraMarcoId,
        tipoVidrio: 'ninguno',
        porcentajeMateriales: 10,
        conSuplemento: true
      })

      const sup = result.items.find((i) => i.tipoItem === 'suplemento')!
      // Perímetro de la obra (20+30)×2 = 100 cm, NO (30+40)×2 = 140.
      expect(sup.metadata?.perimetroCm).toBe(100)
      expect(sup.subtotal).toBe(15000) // 1m × 15000
    })

    it('suplemento: el breakdown mantiene el orden esperado (paspartú → suplemento → marco → vidrio)', () => {
      const result = cotizarEnmarcacionPaspartu(db, {
        anchoCm: 60,
        altoCm: 80,
        anchoPaspartuCm: 5,
        tipoPaspartu: 'pintado',
        muestraMarcoId,
        tipoVidrio: 'claro',
        porcentajeMateriales: 10,
        conSuplemento: true
      })

      // Ignoramos el item de materiales_adicionales (siempre al final).
      const sinMateriales = result.items.filter((i) => i.tipoItem !== 'materiales_adicionales')
      expect(sinMateriales.map((i) => i.tipoItem)).toEqual([
        'paspartu_pintado',
        'suplemento',
        'marco',
        'vidrio'
      ])
    })
  }
)
