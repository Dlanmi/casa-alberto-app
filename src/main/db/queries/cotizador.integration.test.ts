// Integration tests for the DB-backed cotizador entry points added by the
// business-correctness audit (worktree-agent-ad7e00e2). These complement the
// pure-function tests in `cotizador.test.ts` by exercising the functions that
// read from the price lists and compose multiple items.
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { muestrasMarcos, preciosVidrios } from '../schema'
import { cotizarAcolchado, cotizarVidrioEspejo } from './cotizador'

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
    // 30×40 → 18000 base + 10% materiales = 19800.
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
    expect(result.precioTotal).toBe(19800)
  })

  it('con marco: suma acolchado + marco y aplica materiales sobre el combinado', () => {
    // 50×70 acolchado = 50*70*15 = 52500.
    // Marco K473 @ 50×70 colilla 48 $48k/m = (perímetro 240 + 48) = 288 cm = 2.88 m × 48000 = 138240.
    // Subtotal combinado = 52500 + 138240 = 190740.
    // Materiales 10% = 19074.
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
    expect(result.precioTotal).toBe(result.subtotal + result.totalMateriales)
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
