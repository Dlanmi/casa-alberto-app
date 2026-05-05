// @vitest-environment jsdom
//
// Tests del componente base ChartCard. Cubre: render con título, slot de
// controles, empty state, loading skeleton, footer.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartCard } from './chart-card'

describe('ChartCard', () => {
  it('renderiza título y subtítulo', () => {
    render(
      <ChartCard title="Mi chart" subtitle="Subtítulo">
        <div>Contenido</div>
      </ChartCard>
    )
    expect(screen.getByText('Mi chart')).toBeTruthy()
    expect(screen.getByText('Subtítulo')).toBeTruthy()
    expect(screen.getByText('Contenido')).toBeTruthy()
  })

  it('renderiza el slot de controles cuando se pasa', () => {
    render(
      <ChartCard title="X" controls={<button type="button">Filtro</button>}>
        <div />
      </ChartCard>
    )
    expect(screen.getByRole('button', { name: 'Filtro' })).toBeTruthy()
  })

  it('muestra empty state cuando isEmpty=true en lugar del contenido', () => {
    render(
      <ChartCard title="X" isEmpty emptyMessage="Sin datos aún.">
        <div data-testid="contenido-real">no debería verse</div>
      </ChartCard>
    )
    expect(screen.getByText('Sin datos aún.')).toBeTruthy()
    expect(screen.queryByTestId('contenido-real')).toBeNull()
  })

  it('muestra skeleton cuando loading=true', () => {
    render(
      <ChartCard title="X" loading>
        <div data-testid="contenido-real">no debería verse</div>
      </ChartCard>
    )
    expect(screen.getByRole('status', { name: /cargando/i })).toBeTruthy()
    expect(screen.queryByTestId('contenido-real')).toBeNull()
  })

  it('renderiza footer solo cuando hay datos (no loading, no empty)', () => {
    const { rerender } = render(
      <ChartCard title="X" footer={<span data-testid="footer">F</span>}>
        <div>OK</div>
      </ChartCard>
    )
    expect(screen.getByTestId('footer')).toBeTruthy()

    rerender(
      <ChartCard title="X" footer={<span data-testid="footer">F</span>} isEmpty>
        <div>OK</div>
      </ChartCard>
    )
    expect(screen.queryByTestId('footer')).toBeNull()
  })
})
