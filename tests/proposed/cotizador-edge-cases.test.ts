/**
 * Proposed tests — added by tester/QA agent.
 *
 * These expand coverage on the Fase 2 cotizador formulas with edge cases
 * that weren't in the original suite. They import pure functions only
 * (no DB), so they run fast.
 */
import { describe, it, expect } from 'vitest'
import {
  calcularPrecioMarco,
  redondearArriba10,
  calcularPrecioVidrio,
  calcularPrecioAcolchado,
  aplicarPaspartu,
  aplicarMaterialesAdicionales
} from '../../src/main/db/queries/cotizador'

describe('[proposed] redondearArriba10 — edge cases alrededor del múltiplo de 10', () => {
  it('redondea 10 a 10 (ya exacto)', () => {
    expect(redondearArriba10(10)).toBe(10)
  })
  it('redondea 11 a 20', () => {
    expect(redondearArriba10(11)).toBe(20)
  })
  it('redondea 19 a 20', () => {
    expect(redondearArriba10(19)).toBe(20)
  })
  it('redondea 20 a 20', () => {
    expect(redondearArriba10(20)).toBe(20)
  })
  it('redondea 0 a 0', () => {
    // Math.ceil(0/10)*10 = 0 — caso degenerado pero no debe lanzar
    expect(redondearArriba10(0)).toBe(0)
  })
  it('maneja enteros grandes', () => {
    expect(redondearArriba10(1999)).toBe(2000)
    expect(redondearArriba10(2000)).toBe(2000)
    expect(redondearArriba10(2001)).toBe(2010)
  })
})

describe('[proposed] calcularPrecioVidrio — casos borrosos del redondeo', () => {
  it('vidrio 46×37 antirreflectivo → redondea a 50×40 → 0.20 m² × 115.000 = 23.000', () => {
    const r = calcularPrecioVidrio(46, 37, 115000)
    expect(r.anchoRedondeado).toBe(50)
    expect(r.altoRedondeado).toBe(40)
    expect(r.areaM2).toBe(0.2)
    expect(r.precio).toBe(23000)
  })

  it('vidrio claro de 10×10 → 0.01 m² × 100.000 = 1.000', () => {
    const r = calcularPrecioVidrio(10, 10, 100000)
    expect(r.anchoRedondeado).toBe(10)
    expect(r.altoRedondeado).toBe(10)
    expect(r.areaM2).toBe(0.01)
    expect(r.precio).toBe(1000)
  })

  it('vidrio grande 100×150 claro → 1.5 m² × 100.000 = 150.000', () => {
    const r = calcularPrecioVidrio(100, 150, 100000)
    expect(r.areaM2).toBe(1.5)
    expect(r.precio).toBe(150000)
  })

  it('ambos lados se redondean INDEPENDIENTEMENTE', () => {
    // 11×19 → 20×20, NO 20×10
    const r = calcularPrecioVidrio(11, 19, 100000)
    expect(r.anchoRedondeado).toBe(20)
    expect(r.altoRedondeado).toBe(20)
    expect(r.areaM2).toBe(0.04)
  })
})

describe('[proposed] calcularPrecioMarco — casos límite', () => {
  it('colilla 0 y medidas cuadradas', () => {
    const r = calcularPrecioMarco(40, 40, 0, 20000)
    expect(r.perimetroCm).toBe(160)
    expect(r.totalCm).toBe(160)
    expect(r.metros).toBe(1.6)
    expect(r.precio).toBe(32000)
  })

  it('muestra la documentación exacta de Fase 2 A.1: ref K473, 50×70, colilla 48, $48k/m', () => {
    const r = calcularPrecioMarco(50, 70, 48, 48000)
    expect(r.precio).toBe(138240)
  })

  it('precio se redondea (Math.round) a peso entero', () => {
    // 25×35 con colilla 30 → (25+35)*2+30 = 150 cm = 1.5 m × 33333 = 49999.5 → 50000
    const r = calcularPrecioMarco(25, 35, 30, 33333)
    expect(r.metros).toBe(1.5)
    expect(r.precio).toBe(50000)
  })

  it('medidas muy pequeñas (10×10) y colilla muy pequeña', () => {
    const r = calcularPrecioMarco(10, 10, 5, 10000)
    expect(r.perimetroCm).toBe(40)
    expect(r.totalCm).toBe(45)
    expect(r.metros).toBe(0.45)
    expect(r.precio).toBe(4500)
  })
})

describe('[proposed] calcularPrecioAcolchado — fórmula ancho × alto × 15', () => {
  it('50×70 = 52.500 (documentado en Fase 2 A.5)', () => {
    expect(calcularPrecioAcolchado(50, 70)).toBe(52500)
  })
  it('10×10 = 1.500', () => {
    expect(calcularPrecioAcolchado(10, 10)).toBe(1500)
  })
  it('100×100 = 150.000', () => {
    expect(calcularPrecioAcolchado(100, 100)).toBe(150000)
  })
})

describe('[proposed] aplicarPaspartu — cambio de dimensiones por paspartú', () => {
  it('paspartú 5cm sobre 50×70 → exterior 60×80', () => {
    const r = aplicarPaspartu(50, 70, 5)
    expect(r.anchoExterior).toBe(60)
    expect(r.altoExterior).toBe(80)
  })

  // BR-007: aplicarPaspartu debe llamarse SOLO cuando hay paspartú real. Si el
  // ancho es 0 o negativo, lanza error defensivo (en vez de retornar no-op).
  // Si el usuario no quiere paspartú, simplemente no se invoca esta función.
  it('paspartú 0 cm lanza error defensivo (BR-007)', () => {
    expect(() => aplicarPaspartu(30, 40, 0)).toThrow(/mayor a 0/)
  })

  it('paspartú negativo lanza error defensivo (BR-007)', () => {
    expect(() => aplicarPaspartu(30, 40, -1)).toThrow(/mayor a 0/)
  })

  it('cuando aplicamos paspartú y luego recalculamos el marco, el marco usa las medidas exteriores', () => {
    const { anchoExterior, altoExterior } = aplicarPaspartu(50, 70, 5)
    const marco = calcularPrecioMarco(anchoExterior, altoExterior, 48, 48000)
    // Perimetro = (60+80)*2 = 280, +48 = 328 cm = 3.28 m, ×48000 = 157440
    expect(marco.perimetroCm).toBe(280)
    expect(marco.totalCm).toBe(328)
    expect(marco.precio).toBe(157440)
  })
})

describe('[proposed] aplicarMaterialesAdicionales — clamp 5–10%', () => {
  it('clampea porcentajes debajo de 5% a exactamente 5%', () => {
    expect(aplicarMaterialesAdicionales(100000, 0)).toBe(5000)
    expect(aplicarMaterialesAdicionales(100000, -99)).toBe(5000)
    expect(aplicarMaterialesAdicionales(100000, 4.9)).toBe(5000)
  })
  it('clampea porcentajes sobre 10% a exactamente 10%', () => {
    expect(aplicarMaterialesAdicionales(100000, 10.1)).toBe(10000)
    expect(aplicarMaterialesAdicionales(100000, 100)).toBe(10000)
  })
  it('maneja subtotales grandes (cuadros grandes → 5%)', () => {
    expect(aplicarMaterialesAdicionales(5_000_000, 5)).toBe(250000)
  })
  it('redondea al peso entero', () => {
    // 12345 * 10% = 1234.5 → 1235
    expect(aplicarMaterialesAdicionales(12345, 10)).toBe(1235)
  })
})
