// @vitest-environment jsdom
//
// Tests del hook useChartPeriod. Verifica que cada período devuelve un
// rango ISO consistente (desde ≤ hasta), que el cambio de período actualiza
// el rango, y que las claves CHART_PERIODS están bien tipadas.
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHART_PERIODS, useChartPeriod } from './use-chart-period'

describe('useChartPeriod', () => {
  it('devuelve un rango válido para el período por defecto (ultimos_6m)', () => {
    const { result } = renderHook(() => useChartPeriod())
    expect(result.current.period).toBe('ultimos_6m')
    expect(result.current.desde <= result.current.hasta).toBe(true)
    expect(result.current.label).toBe('Últimos 6 meses')
  })

  it('cambiar de período actualiza el rango y la etiqueta', () => {
    const { result } = renderHook(() => useChartPeriod('mes_actual'))
    const desdeInicial = result.current.desde
    act(() => {
      result.current.setPeriod('anio_actual')
    })
    expect(result.current.period).toBe('anio_actual')
    expect(result.current.label).toBe('Año actual')
    expect(result.current.desde).not.toBe(desdeInicial)
    expect(result.current.desde.endsWith('-01-01')).toBe(true)
  })

  it('todos los períodos del catálogo devuelven rangos válidos', () => {
    for (const p of CHART_PERIODS) {
      const r = p.rango()
      expect(r.desde <= r.hasta).toBe(true)
      expect(/^\d{4}-\d{2}-\d{2}$/.test(r.desde)).toBe(true)
      expect(/^\d{4}-\d{2}-\d{2}$/.test(r.hasta)).toBe(true)
    }
  })

  it('"todo" usa una fecha floor muy antigua', () => {
    const todo = CHART_PERIODS.find((p) => p.key === 'todo')!
    const r = todo.rango()
    expect(r.desde).toBe('1900-01-01')
  })
})
