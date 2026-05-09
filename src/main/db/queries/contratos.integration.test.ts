// Hardening: handlers IPC `contratos:crear` y `cuentasCobro:crear` reciben
// payloads numéricos del renderer. Sin validarMonto/validarFechaISO, el
// producto cantidad*valorUnitario o las sumas pueden overflow a Infinity, y
// retencionPorcentaje/retencion permiten NaN porque las comparaciones < 0
// y > N son siempre false con NaN. Los CHECK del schema no rechazan Infinity.
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import { createTestDb, nativeAbiAvailable } from '../test-utils'
import {
  cambiarEstadoContrato,
  crearContrato,
  crearCuentaCobro
} from './contratos'
import { clientes, contratoItems, contratos, cuentasCobro } from '../schema'

describe.runIf(nativeAbiAvailable)('crearContrato — defense in depth', () => {
  let db: DB
  let clienteId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db
      .insert(clientes)
      .values({ nombre: 'Cliente Empresa SAS', cedula: '900123456' })
      .returning()
      .get().id
  })

  function inputValido() {
    return {
      clienteId,
      fecha: '2026-05-06',
      retencionPorcentaje: 0,
      items: [
        { descripcion: 'Marco grande', cantidad: 1, valorUnitario: 100000 }
      ]
    }
  }

  it('rechaza item con cantidad Infinity', () => {
    expect(() =>
      crearContrato(db, {
        ...inputValido(),
        items: [{ descripcion: 'overflow', cantidad: Number.POSITIVE_INFINITY, valorUnitario: 1 }]
      })
    ).toThrow(/no es un número finito válido/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(contratos).get()?.n).toBe(0)
    expect(db.select({ n: sql<number>`count(*)` }).from(contratoItems).get()?.n).toBe(0)
  })

  it('rechaza item con valorUnitario NaN', () => {
    expect(() =>
      crearContrato(db, {
        ...inputValido(),
        items: [{ descripcion: 'nan', cantidad: 1, valorUnitario: NaN }]
      })
    ).toThrow(/no es un número finito válido/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(contratos).get()?.n).toBe(0)
  })

  it('rechaza item cuyo cantidad*valorUnitario overflow a Infinity (PoC)', () => {
    expect(() =>
      crearContrato(db, {
        ...inputValido(),
        items: [{ descripcion: 'overflow', cantidad: 1e200, valorUnitario: 1e200 }]
      })
    ).toThrow(/no es un número finito válido/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(contratos).get()?.n).toBe(0)
  })

  it('rechaza suma agregada de subtotales que overflow entre múltiples items', () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      descripcion: `item-${i}`,
      cantidad: 1,
      valorUnitario: Number.MAX_VALUE
    }))
    expect(() => crearContrato(db, { ...inputValido(), items })).toThrow(
      /no es un número finito válido/i
    )
    expect(db.select({ n: sql<number>`count(*)` }).from(contratos).get()?.n).toBe(0)
  })

  it('rechaza retencionPorcentaje NaN', () => {
    expect(() =>
      crearContrato(db, { ...inputValido(), retencionPorcentaje: NaN })
    ).toThrow(/finito.*entre 0 y 100/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(contratos).get()?.n).toBe(0)
  })

  it('rechaza retencionPorcentaje Infinity', () => {
    expect(() =>
      crearContrato(db, { ...inputValido(), retencionPorcentaje: Number.POSITIVE_INFINITY })
    ).toThrow(/finito.*entre 0 y 100/i)
  })

  it('rechaza retencionPorcentaje fuera de rango', () => {
    expect(() =>
      crearContrato(db, { ...inputValido(), retencionPorcentaje: 150 })
    ).toThrow(/entre 0 y 100/i)
    expect(() =>
      crearContrato(db, { ...inputValido(), retencionPorcentaje: -5 })
    ).toThrow(/entre 0 y 100/i)
  })

  it('rechaza fecha con formato inválido', () => {
    expect(() => crearContrato(db, { ...inputValido(), fecha: '2026/05/06' })).toThrow(
      /formato/i
    )
  })

  it('rechaza contrato sin items', () => {
    expect(() => crearContrato(db, { ...inputValido(), items: [] })).toThrow(/al menos un/i)
  })

  it('crea contrato válido y persiste items', () => {
    const c = crearContrato(db, inputValido())
    expect(c.total).toBe(100000)
    const items = db
      .select()
      .from(contratoItems)
      .where(sql`${contratoItems.contratoId} = ${c.id}`)
      .all()
    expect(items).toHaveLength(1)
    expect(items[0]!.subtotal).toBe(100000)
  })
})

describe.runIf(nativeAbiAvailable)('crearCuentaCobro — defense in depth', () => {
  let db: DB
  let clienteId: number
  let contratoId: number

  beforeEach(() => {
    db = createTestDb().db
    clienteId = db
      .insert(clientes)
      .values({ nombre: 'Cliente Empresa SAS', cedula: '900123456' })
      .returning()
      .get().id
    const contrato = crearContrato(db, {
      clienteId,
      fecha: '2026-05-06',
      retencionPorcentaje: 0,
      items: [{ descripcion: 'Trabajo único', cantidad: 1, valorUnitario: 1_000_000 }]
    })
    contratoId = contrato.id
    // Aprobar para permitir crear cuenta de cobro.
    cambiarEstadoContrato(db, contratoId, 'aprobada')
  })

  it('rechaza retencion NaN (PoC)', () => {
    expect(() =>
      crearCuentaCobro(db, {
        contratoId,
        total: 1_000_000,
        retencion: NaN,
        fecha: '2026-05-06'
      })
    ).toThrow(/finito/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(cuentasCobro).get()?.n).toBe(0)
  })

  it('rechaza retencion Infinity', () => {
    expect(() =>
      crearCuentaCobro(db, {
        contratoId,
        total: 1_000_000,
        retencion: Number.POSITIVE_INFINITY,
        fecha: '2026-05-06'
      })
    ).toThrow(/finito/i)
    expect(db.select({ n: sql<number>`count(*)` }).from(cuentasCobro).get()?.n).toBe(0)
  })

  it('rechaza total Infinity (ya cubierto previamente, regresión)', () => {
    expect(() =>
      crearCuentaCobro(db, {
        contratoId,
        total: Number.POSITIVE_INFINITY,
        fecha: '2026-05-06'
      })
    ).toThrow()
  })

  it('rechaza fecha con formato inválido', () => {
    expect(() =>
      crearCuentaCobro(db, {
        contratoId,
        total: 500_000,
        fecha: '06-05-2026'
      })
    ).toThrow(/formato/i)
  })

  it('crea cuenta de cobro válida con retencion 0', () => {
    const cc = crearCuentaCobro(db, {
      contratoId,
      total: 1_000_000,
      fecha: '2026-05-06'
    })
    expect(cc.total).toBe(1_000_000)
    expect(cc.retencion).toBe(0)
    expect(cc.totalNeto).toBe(1_000_000)
  })
})
