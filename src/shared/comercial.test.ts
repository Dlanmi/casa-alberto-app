// Tests del módulo compartido @shared/comercial. La lógica vive aquí porque
// la usan tanto el wizard (renderer) como el backend (main al guardar el
// pedido). Si esta función diverge entre lados, el panel del wizard mostraría
// un margen distinto al guardado en DB — peor síntoma posible.
import { describe, expect, it } from 'vitest'
import {
  calcularEvaluacionComercial,
  sugerenciasDejarEnTotal
} from './comercial'

describe('calcularEvaluacionComercial', () => {
  it('sin descuento, precio final = sugerido', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 138_000,
      descuentoMonto: 0,
      costoEstimado: 80_000,
      margenMinimoAlertaPct: 20
    })
    expect(ev.precioFinal).toBe(138_000)
    expect(ev.descuentoMonto).toBe(0)
    expect(ev.margenEstimado).toBe(58_000)
    expect(ev.estadoRentabilidad).toBe('saludable')
  })

  it('auto-redondea precio final al múltiplo de $1.000 cuando hay descuento', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 138_000,
      descuentoMonto: 5_500,
      costoEstimado: 80_000,
      margenMinimoAlertaPct: 20,
      autoRedondear: true
    })
    // 138.000 - 5.500 = 132.500 → redondea hacia abajo a 132.000
    expect(ev.precioFinal).toBe(132_000)
    // descuento efectivo se ajusta para que el total caiga en el millar
    expect(ev.descuentoMonto).toBe(6_000)
    expect(ev.descuentoSolicitado).toBe(5_500)
  })

  it('NO auto-redondea cuando autoRedondear=false (modo backend)', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 138_000,
      descuentoMonto: 5_500,
      costoEstimado: 80_000,
      margenMinimoAlertaPct: 20,
      autoRedondear: false
    })
    expect(ev.precioFinal).toBe(132_500)
    expect(ev.descuentoMonto).toBe(5_500)
  })

  it('descuento del 100% (regalo) → precio final = 0', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 138_000,
      descuentoMonto: 138_000,
      costoEstimado: 80_000,
      margenMinimoAlertaPct: 20
    })
    expect(ev.precioFinal).toBe(0)
    expect(ev.descuentoMonto).toBe(138_000)
    expect(ev.estadoRentabilidad).toBe('critica')
  })

  it('descuento mayor al precio se trunca al precio (no permite total negativo)', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 100_000,
      descuentoMonto: 200_000,
      costoEstimado: 50_000,
      margenMinimoAlertaPct: 20
    })
    expect(ev.precioFinal).toBe(0)
    expect(ev.descuentoMonto).toBe(100_000)
  })

  it('costo null → estado incompleta y margen null', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 138_000,
      descuentoMonto: 0,
      costoEstimado: null,
      margenMinimoAlertaPct: 20
    })
    expect(ev.estadoRentabilidad).toBe('incompleta')
    expect(ev.margenEstimado).toBeNull()
    expect(ev.margenEstimadoPct).toBeNull()
  })

  it('margen positivo pero por debajo del umbral → estado baja', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 100_000,
      descuentoMonto: 0,
      costoEstimado: 90_000,
      margenMinimoAlertaPct: 20
    })
    // margen 10% < umbral 20%
    expect(ev.estadoRentabilidad).toBe('baja')
    expect(ev.margenEstimado).toBe(10_000)
  })

  it('margen <= 0 → estado critica', () => {
    const ev = calcularEvaluacionComercial({
      precioSugerido: 100_000,
      descuentoMonto: 0,
      costoEstimado: 100_000,
      margenMinimoAlertaPct: 20
    })
    expect(ev.estadoRentabilidad).toBe('critica')
  })
})

describe('sugerenciasDejarEnTotal', () => {
  it('produce hasta 3 múltiplos limpios menores al precio', () => {
    const sug = sugerenciasDejarEnTotal(138_500, 3)
    expect(sug.length).toBeGreaterThan(0)
    expect(sug.every((s) => s < 138_500 && s > 0)).toBe(true)
    // Devuelve ordenados de mayor a menor (más cerca primero)
    for (let i = 1; i < sug.length; i++) {
      expect(sug[i - 1]).toBeGreaterThan(sug[i])
    }
  })

  it('precio ya cerrado en múltiplo de $10.000 produce sugerencias menores', () => {
    const sug = sugerenciasDejarEnTotal(150_000)
    expect(sug.every((s) => s < 150_000)).toBe(true)
  })

  it('precio 0 o negativo → array vacío', () => {
    expect(sugerenciasDejarEnTotal(0)).toEqual([])
    expect(sugerenciasDejarEnTotal(-1)).toEqual([])
  })
})
