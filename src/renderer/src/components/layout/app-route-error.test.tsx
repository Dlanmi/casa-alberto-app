// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRouteError } from './app-route-error'

function BrokenScreen(): never {
  throw new Error('Fallo controlado de prueba')
}

describe('AppRouteError', () => {
  it('muestra una experiencia amigable cuando una ruta falla', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <BrokenScreen />,
        errorElement: <AppRouteError />
      }
    ])

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Algo salió mal al abrir esta vista')).toBeTruthy()
    expect(screen.getByRole('button', { name: /volver al inicio/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /recargar la app/i })).toBeTruthy()
    expect(screen.getByText('Fallo controlado de prueba')).toBeTruthy()
  })
})
