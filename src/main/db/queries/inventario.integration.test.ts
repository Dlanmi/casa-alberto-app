// Integration tests for the inventario guard added by the business-correctness
// audit: los marcos NO se almacenan (Fase 2 §E.2).
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import { crearItemInventario, listarInventario } from './inventario'
import { inventario } from '../schema'

describe.runIf(nativeAbiAvailable)('inventario — marcos no se almacenan (Fase 2 §E.2)', () => {
  let db: DB

  beforeEach(() => {
    db = createTestDb().db
  })

  it('rechaza crear item de tipo marco', () => {
    expect(() =>
      crearItemInventario(db, {
        nombre: 'Marco K473',
        tipo: 'marco',
        unidad: 'metros'
      })
    ).toThrow(/marco/i)
  })

  it('acepta crear item de tipo vidrio', () => {
    const item = crearItemInventario(db, {
      nombre: 'Vidrio claro 3mm',
      tipo: 'vidrio',
      unidad: 'laminas',
      stockActual: 5,
      stockMinimo: 2
    })
    expect(item.tipo).toBe('vidrio')
    expect(item.nombre).toBe('Vidrio claro 3mm')
  })

  it('listarInventario filtra registros legacy con tipo marco aunque existan en la tabla', () => {
    // Simulamos un registro legado bypassando la guardia de `crearItemInventario`
    // (por ejemplo, creado antes de la auditoría). Debe quedar invisible en la UI.
    db.insert(inventario)
      .values({
        nombre: 'Marco legado K999',
        tipo: 'marco',
        unidad: 'metros',
        stockActual: 3,
        stockMinimo: 0
      })
      .run()
    db.insert(inventario)
      .values({
        nombre: 'Cartón visible',
        tipo: 'carton',
        unidad: 'laminas',
        stockActual: 10,
        stockMinimo: 2
      })
      .run()
    const items = listarInventario(db)
    const tipos = items.map((i) => i.tipo)
    expect(tipos).toContain('carton')
    expect(tipos).not.toContain('marco')
  })
})
