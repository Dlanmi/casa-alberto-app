// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChartPeriodSelector } from './chart-period-selector'

describe('ChartPeriodSelector', () => {
  it('renderiza opciones por defecto en variant tabs', () => {
    const onChange = vi.fn()
    render(<ChartPeriodSelector value="mes_actual" onChange={onChange} />)
    // Hay al menos 6 opciones (ver CHART_PERIODS) — verificamos algunas claves
    expect(screen.getByRole('tab', { name: 'Mes actual' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Últimos 6 meses' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Todo' })).toBeTruthy()
  })

  it('respeta el subset de options cuando se pasa', () => {
    const onChange = vi.fn()
    render(
      <ChartPeriodSelector
        value="mes_actual"
        onChange={onChange}
        options={['mes_actual', 'anio_actual']}
      />
    )
    expect(screen.getByRole('tab', { name: 'Mes actual' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Últimos 6 meses' })).toBeNull()
  })

  it('marca aria-selected en el período activo', () => {
    const onChange = vi.fn()
    render(<ChartPeriodSelector value="anio_actual" onChange={onChange} />)
    const activo = screen.getByRole('tab', { name: 'Año actual' })
    expect(activo.getAttribute('aria-selected')).toBe('true')
    const inactivo = screen.getByRole('tab', { name: 'Mes actual' })
    expect(inactivo.getAttribute('aria-selected')).toBe('false')
  })

  it('dispara onChange con la clave correcta al click', () => {
    const onChange = vi.fn()
    render(<ChartPeriodSelector value="mes_actual" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Año actual' }))
    expect(onChange).toHaveBeenCalledWith('anio_actual')
  })

  it('variant select renderiza un dropdown nativo', () => {
    const onChange = vi.fn()
    render(<ChartPeriodSelector value="mes_actual" onChange={onChange} variant="select" />)
    const select = screen.getByLabelText('Seleccionar período') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    fireEvent.change(select, { target: { value: 'anio_actual' } })
    expect(onChange).toHaveBeenCalledWith('anio_actual')
  })
})
