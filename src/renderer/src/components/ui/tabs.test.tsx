// @vitest-environment jsdom

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs } from './tabs'

const tabs = [
  { key: 'clientes', label: 'Clientes', count: 12 },
  { key: 'pedidos', label: 'Pedidos', count: 4 },
  { key: 'facturas', label: 'Facturas', count: 2 }
]

function TabsHarness(): React.JSX.Element {
  const [active, setActive] = useState('clientes')

  return (
    <div>
      <Tabs
        tabs={tabs}
        active={active}
        onChange={setActive}
        ariaLabel="Secciones principales"
        idBase="demo-tabs"
      />

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`demo-tabs-panel-${tab.key}`}
          aria-labelledby={`demo-tabs-tab-${tab.key}`}
          hidden={active !== tab.key}
        >
          Panel {tab.label}
        </div>
      ))}
    </div>
  )
}

describe('Tabs', () => {
  it('conecta tabs y paneles con ARIA y roving tabindex', () => {
    render(<TabsHarness />)

    const clientesTab = screen.getByRole('tab', { name: /clientes/i })
    const pedidosTab = screen.getByRole('tab', { name: /pedidos/i })

    expect(clientesTab.getAttribute('aria-controls')).toBe('demo-tabs-panel-clientes')
    expect(clientesTab.getAttribute('id')).toBe('demo-tabs-tab-clientes')
    expect(clientesTab.getAttribute('aria-selected')).toBe('true')
    expect(clientesTab.getAttribute('tabindex')).toBe('0')

    expect(pedidosTab.getAttribute('aria-controls')).toBe('demo-tabs-panel-pedidos')
    expect(pedidosTab.getAttribute('aria-selected')).toBe('false')
    expect(pedidosTab.getAttribute('tabindex')).toBe('-1')
  })

  it('permite navegar con flechas, Home y End', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)

    const clientesTab = screen.getByRole('tab', { name: /clientes/i })
    clientesTab.focus()

    await user.keyboard('{ArrowRight}')
    const pedidosTab = screen.getByRole('tab', { name: /pedidos/i })
    expect(document.activeElement).toBe(pedidosTab)
    expect(pedidosTab.getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{End}')
    const facturasTab = screen.getByRole('tab', { name: /facturas/i })
    expect(document.activeElement).toBe(facturasTab)
    expect(facturasTab.getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(clientesTab)
    expect(clientesTab.getAttribute('aria-selected')).toBe('true')
  })
})
