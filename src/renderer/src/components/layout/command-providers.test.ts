// Tests de los providers del CommandPalette. Cubren:
//   - Acciones aparecen con query vacío y filtran por keywords
//   - Recientes solo aparecen con query vacío
//   - Agrupación y aplanado preservan orden visual
import { describe, expect, it } from 'vitest'
import { agruparPorSeccion, aplanar, ejecutarProviders } from './command-providers'
import { createAccionesProvider } from './command-actions-provider'
import { createRecientesProvider } from './command-recent-provider'
import type { RecentEntity } from '@renderer/hooks/use-recent-entities'

const ctxStub = { verAtajos: () => undefined }

describe('CommandPalette providers', () => {
  it('acciones aparecen con query vacío (mostrarSinQuery)', async () => {
    const provider = createAccionesProvider(ctxStub)
    const resultados = await ejecutarProviders([provider], '')
    expect(resultados.length).toBeGreaterThan(0)
    expect(resultados.every((r) => r.seccion === 'Acciones')).toBe(true)
  })

  it('acciones filtran por keyword (case-insensitive)', async () => {
    const provider = createAccionesProvider(ctxStub)
    const resultados = await ejecutarProviders([provider], 'cliente')
    expect(resultados.length).toBeGreaterThanOrEqual(1)
    expect(
      resultados.some((r) => r.titulo.toLowerCase().includes('cliente'))
    ).toBe(true)
  })

  it('acciones filtran por sinónimos en español', async () => {
    const provider = createAccionesProvider(ctxStub)
    const resultados = await ejecutarProviders([provider], 'cobrar')
    // "cobrar" debe matchear "Nueva factura" por su keyword
    expect(resultados.some((r) => r.titulo.includes('factura'))).toBe(true)
  })

  it('recientes solo aparecen con query vacío', async () => {
    const recientes: RecentEntity[] = [
      { kind: 'cliente', id: 1, titulo: 'Ana', visitedAt: '2026-04-01T10:00:00Z' }
    ]
    const provider = createRecientesProvider(() => recientes)
    const conQuery = await ejecutarProviders([provider], 'ana')
    const sinQuery = await ejecutarProviders([provider], '')
    expect(conQuery).toHaveLength(0)
    expect(sinQuery).toHaveLength(1)
    expect(sinQuery[0]?.seccion).toBe('Recientes')
  })

  it('recientes limitan a 5 elementos visibles', async () => {
    const recientes: RecentEntity[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'pedido' as const,
      id: i,
      titulo: `P-${i}`,
      visitedAt: '2026-04-01T10:00:00Z'
    }))
    const provider = createRecientesProvider(() => recientes)
    const resultados = await ejecutarProviders([provider], '')
    expect(resultados).toHaveLength(5)
  })

  it('agruparPorSeccion preserva orden de aparición', () => {
    const items = [
      {
        id: 'a',
        kind: 'action' as const,
        seccion: 'Acciones',
        titulo: 'A',
        icono: (() => null) as never,
        ejecutar: () => undefined
      },
      {
        id: 'b',
        kind: 'entity' as const,
        seccion: 'Clientes',
        titulo: 'B',
        icono: (() => null) as never,
        ejecutar: () => undefined
      },
      {
        id: 'c',
        kind: 'action' as const,
        seccion: 'Acciones',
        titulo: 'C',
        icono: (() => null) as never,
        ejecutar: () => undefined
      }
    ]
    const grupos = agruparPorSeccion(items)
    expect(grupos.map((g) => g.seccion)).toEqual(['Acciones', 'Clientes'])
    expect(grupos[0]?.items.map((i) => i.id)).toEqual(['a', 'c'])
    const plano = aplanar(grupos)
    expect(plano.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('ejecutar acción de tipo callback invoca el contexto sin navegar', async () => {
    let invocado = false
    const provider = createAccionesProvider({
      verAtajos: () => {
        invocado = true
      }
    })
    const resultados = await ejecutarProviders([provider], 'atajos')
    const atajos = resultados.find((r) => r.titulo === 'Ver atajos de teclado')
    expect(atajos).toBeTruthy()
    let navegadoA: string | null = null
    atajos!.ejecutar({ navigate: (p) => (navegadoA = p), cerrar: () => undefined })
    expect(invocado).toBe(true)
    expect(navegadoA).toBeNull()
  })
})
