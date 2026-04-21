import { describe, it, expect } from 'vitest'
import {
  calcularPrecioMarco,
  redondearArriba10,
  calcularPrecioVidrio,
  calcularPrecioAcolchado,
  aplicarPaspartu,
  aplicarMaterialesAdicionales
} from './cotizador'

describe('calcularPrecioMarco', () => {
  it('ejemplo exacto de la Fase 2 (A.1): ref K473, 50x70, colilla 48cm, $48.000/m', () => {
    // Fase 2: "Perímetro: (50 + 70) × 2 = 240 cm"
    // "Total: 240 + 48 (colilla) = 288 cm = 2.88 metros"
    // "Precio marco: 2.88 × $48.000 = $138.240"
    const result = calcularPrecioMarco(50, 70, 48, 48000)
    expect(result.perimetroCm).toBe(240)
    expect(result.totalCm).toBe(288)
    expect(result.metros).toBe(2.88)
    expect(result.precio).toBe(138240)
  })

  it('calcula perimetro + colilla (UNA vez) correctamente', () => {
    // 30x40, colilla 32cm, $28.000/m
    // Perimetro = (30+40)*2 = 140cm
    // Total = 140 + 32 = 172cm = 1.72m
    // Precio = 1.72 * 28000 = 48160
    const result = calcularPrecioMarco(30, 40, 32, 28000)
    expect(result.perimetroCm).toBe(140)
    expect(result.totalCm).toBe(172)
    expect(result.metros).toBe(1.72)
    expect(result.precio).toBe(48160)
  })

  it('maneja medidas cuadradas', () => {
    const result = calcularPrecioMarco(30, 30, 28, 26000)
    // Perimetro = 120, Total = 120 + 28 = 148cm = 1.48m
    expect(result.perimetroCm).toBe(120)
    expect(result.totalCm).toBe(148)
    expect(result.precio).toBe(1.48 * 26000)
  })

  it('con colilla 0 solo calcula perimetro', () => {
    const result = calcularPrecioMarco(20, 30, 0, 10000)
    expect(result.perimetroCm).toBe(100)
    expect(result.totalCm).toBe(100) // sin colilla
    expect(result.metros).toBe(1)
    expect(result.precio).toBe(10000)
  })
})

describe('redondearArriba10', () => {
  it('redondea exacto no cambia', () => {
    expect(redondearArriba10(30)).toBe(30)
    expect(redondearArriba10(50)).toBe(50)
    expect(redondearArriba10(100)).toBe(100)
  })

  it('redondea hacia arriba', () => {
    expect(redondearArriba10(31)).toBe(40)
    expect(redondearArriba10(45)).toBe(50)
    expect(redondearArriba10(51)).toBe(60)
    expect(redondearArriba10(99)).toBe(100)
  })

  it('redondea 1 a 10', () => {
    expect(redondearArriba10(1)).toBe(10)
  })
})

describe('calcularPrecioVidrio', () => {
  it('calcula area con redondeo 10 en 10', () => {
    // 30x40 → redondeado 30x40 → 0.12m2 × $100.000 = $12.000
    const result = calcularPrecioVidrio(30, 40, 100000)
    expect(result.anchoRedondeado).toBe(30)
    expect(result.altoRedondeado).toBe(40)
    expect(result.areaM2).toBe(0.12)
    expect(result.precio).toBe(12000)
  })

  it('redondea medidas no exactas', () => {
    // 25x35 → redondeado 30x40 → 0.12m2 × $100.000 = $12.000
    const result = calcularPrecioVidrio(25, 35, 100000)
    expect(result.anchoRedondeado).toBe(30)
    expect(result.altoRedondeado).toBe(40)
    expect(result.areaM2).toBe(0.12)
    expect(result.precio).toBe(12000)
  })

  it('vidrio antirreflectivo a $115.000/m2', () => {
    // 50x70 → redondeado 50x70 → 0.35m2 × $115.000 = $40.250
    const result = calcularPrecioVidrio(50, 70, 115000)
    expect(result.anchoRedondeado).toBe(50)
    expect(result.altoRedondeado).toBe(70)
    expect(result.areaM2).toBe(0.35)
    expect(result.precio).toBe(40250)
  })
})

describe('calcularPrecioAcolchado', () => {
  it('formula: ancho x alto x 15', () => {
    expect(calcularPrecioAcolchado(25, 35)).toBe(25 * 35 * 15)
    expect(calcularPrecioAcolchado(30, 40)).toBe(18000)
    expect(calcularPrecioAcolchado(50, 70)).toBe(52500)
  })

  it('ambas formulaciones de Fase 2 (§A.5) son matemáticamente equivalentes', () => {
    // Fase 2 define el acolchado con dos fórmulas equivalentes:
    //   (a) ancho_cm × alto_cm × 15
    //   (b) ancho_m × alto_m × 150000
    // Probamos para varios tamaños que ambas dan el mismo valor.
    const casos = [
      { ancho: 30, alto: 40 },
      { ancho: 50, alto: 70 },
      { ancho: 25, alto: 35 },
      { ancho: 100, alto: 150 }
    ]
    for (const { ancho, alto } of casos) {
      const viaCm = calcularPrecioAcolchado(ancho, alto)
      const viaMetros = Math.round((ancho / 100) * (alto / 100) * 150000)
      expect(viaMetros).toBe(viaCm)
    }
  })
})

describe('validaciones de sanidad (BR-002, BR-007)', () => {
  it('rechaza colilla negativa', () => {
    expect(() => calcularPrecioMarco(30, 40, -1, 28000)).toThrow(/colilla/i)
  })

  it('rechaza colilla desorbitada (> máximo operativo)', () => {
    // COLILLA_MAX_CM = 200 — un valor de 999 es claramente un error de captura.
    expect(() => calcularPrecioMarco(30, 40, 999, 28000)).toThrow(/colilla/i)
  })

  it('acepta colilla 0 (caso sin desperdicio)', () => {
    expect(() => calcularPrecioMarco(30, 40, 0, 28000)).not.toThrow()
  })

  it('rechaza medidas fuera de rango', () => {
    expect(() => calcularPrecioMarco(0, 40, 20, 28000)).toThrow(/ancho/i)
    expect(() => calcularPrecioMarco(30, 0, 20, 28000)).toThrow(/alto/i)
    expect(() => calcularPrecioMarco(600, 40, 20, 28000)).toThrow(/ancho/i)
  })

  it('rechaza paspartú con ancho negativo o cero', () => {
    expect(() => aplicarPaspartu(30, 40, 0)).toThrow(/paspartú/i)
    expect(() => aplicarPaspartu(30, 40, -5)).toThrow(/paspartú/i)
  })

  it('rechaza paspartú con ancho excesivo (BR-007)', () => {
    // PASPARTU_MAX_CM = 20 — un paspartú de 50 cm es un error de captura.
    expect(() => aplicarPaspartu(30, 40, 50)).toThrow(/paspartú/i)
  })

  it('acepta paspartú dentro del rango razonable', () => {
    expect(() => aplicarPaspartu(30, 40, 5)).not.toThrow()
    expect(() => aplicarPaspartu(30, 40, 15)).not.toThrow()
  })
})

describe('aplicarPaspartu', () => {
  it('agrega ancho de paspartu en ambos lados', () => {
    // 20x30 con paspartu de 5cm → exterior 30x40
    const result = aplicarPaspartu(20, 30, 5)
    expect(result.anchoExterior).toBe(30)
    expect(result.altoExterior).toBe(40)
  })

  it('paspartu de 10cm', () => {
    const result = aplicarPaspartu(30, 40, 10)
    expect(result.anchoExterior).toBe(50)
    expect(result.altoExterior).toBe(60)
  })

  it('paspartu minimo de 2cm', () => {
    const result = aplicarPaspartu(30, 40, 2)
    expect(result.anchoExterior).toBe(34)
    expect(result.altoExterior).toBe(44)
  })
})

describe('aplicarMaterialesAdicionales', () => {
  it('10% por defecto', () => {
    expect(aplicarMaterialesAdicionales(100000, 10)).toBe(10000)
  })

  it('5% minimo', () => {
    expect(aplicarMaterialesAdicionales(100000, 5)).toBe(5000)
  })

  // Sprint 2 · A5 — el clamp silencioso fue reemplazado por error explícito.
  // Antes la función aceptaba 1% o 20% y los ajustaba a 5% / 10% sin avisar,
  // lo que tapaba bugs en la UI o payloads IPC mal formados. Ahora debe lanzar.
  it('rechaza porcentaje por debajo del mínimo (5%)', () => {
    expect(() => aplicarMaterialesAdicionales(100000, 1)).toThrow(/entre 5% y 10%/i)
  })

  it('rechaza porcentaje por encima del máximo (10%)', () => {
    expect(() => aplicarMaterialesAdicionales(100000, 20)).toThrow(/entre 5% y 10%/i)
  })

  it('rechaza NaN explícitamente', () => {
    expect(() => aplicarMaterialesAdicionales(100000, NaN)).toThrow(/no es un número válido/i)
  })
})
