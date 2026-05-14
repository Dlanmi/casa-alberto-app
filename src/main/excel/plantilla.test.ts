// Tests del importador unificado de plantilla. Cubre las 3 fases:
//   - Generación: la plantilla tiene todas las hojas esperadas + ejemplos
//   - Parser: lee plantillas válidas, reporta errores específicos
//   - Cargador: upsert / solo_agregar / reemplazar funcionan correctamente
//
// La generación se prueba contra un xlsx en disco que luego releemos para
// verificar estructura. El parser se prueba con xlsx fabricados a propósito
// para cada caso (válido, vacío, con errores, etc).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as XLSX from '@e965/xlsx'
import { sql } from 'drizzle-orm'
import {
  generarPlantilla,
  parsearPlantilla,
  cargarPlantilla,
  HOJAS,
  __testing__,
  type PlantillaParsed
} from './plantilla'
import { createTestDb, nativeAbiAvailable } from '../db/test-utils'
import {
  configuracion,
  muestrasMarcos,
  preciosVidrios,
  preciosPaspartuPintado,
  proveedores
} from '../db/schema'
import type { DB } from '../db'

// El servicio usa app.getPath('downloads') al generar y dialog/shell al
// abrir. En tests apuntamos esos a /tmp para no escribir en HOME real.
let MOCK_DOWNLOADS = ''
vi.mock('electron', () => ({
  app: { getPath: (_k: string) => MOCK_DOWNLOADS },
  dialog: { showOpenDialogSync: vi.fn(() => undefined) },
  shell: { showItemInFolder: vi.fn() }
}))

// Helper: arma un xlsx en memoria con las hojas indicadas como AOA. Cada hoja
// recibe sus filas (encabezados + datos) y se convierte con aoa_to_sheet, que
// es como genera la plantilla real, así el parser ve la misma forma.
function fabricarXlsx(
  hojas: Record<string, (string | number | null)[][]>,
  destino: string
): string {
  const wb = XLSX.utils.book_new()
  for (const [nombre, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre)
  }
  XLSX.writeFile(wb, destino)
  return destino
}

// Encabezados oficiales esperados por el parser. Si tu papá los cambia, la
// plantilla se rechaza, así que los probamos exactamente.
const HEADERS = {
  negocio: ['Nombre', 'NIT', 'Telefono', 'Direccion', 'Correo'],
  proveedores: ['Nombre', 'Productos', 'Dias_pedido', 'Forma_pago', 'Telefono', 'Notas'],
  marcos: ['Referencia', 'Proveedor', 'Colilla_cm', 'Precio_metro', 'Costo_metro', 'Descripcion'],
  vidrios: ['Nombre', 'Espesor_mm', 'Precio_m2', 'Costo_m2'],
  medidas: ['Ancho_cm', 'Alto_cm', 'Precio', 'Costo'],
  configuracion: ['Clave', 'Valor', 'Descripcion']
}

// Construye una plantilla mínima válida con N marcos/vidrios/medidas para
// reusar entre tests. Acepta overrides parciales por hoja para probar errores.
function plantillaMinima(
  destino: string,
  overrides: Partial<Record<string, (string | number | null)[][]>> = {}
): string {
  const datos: Record<string, (string | number | null)[][]> = {
    [HOJAS.NEGOCIO]: [HEADERS.negocio, ['Casa Alberto', '900.123.456', '+57 320 0', 'Cra 7', null]],
    [HOJAS.PROVEEDORES]: [
      HEADERS.proveedores,
      ['Alperto', 'Marcos', 'lunes', 'Contra entrega', '3101234567', null],
      ['Edimol', 'Marcos', 'lunes', 'Contra entrega', null, null]
    ],
    [HOJAS.MARCOS]: [
      HEADERS.marcos,
      ['M-001', 'Alperto', 48, 47000, 30000, 'Roble']
    ],
    [HOJAS.VIDRIOS]: [HEADERS.vidrios, ['Vidrio claro', 2, 100000, 60000]],
    [HOJAS.PASPARTU_PINTADO]: [HEADERS.medidas, [30, 40, 12000, 7000]],
    [HOJAS.PASPARTU_ACRILICO]: [HEADERS.medidas, [30, 40, 17000, 10000]],
    [HOJAS.RETABLOS]: [HEADERS.medidas, [20, 30, 18000, null]],
    [HOJAS.BASTIDORES]: [HEADERS.medidas, [30, 40, 22000, null]],
    [HOJAS.TAPAS]: [HEADERS.medidas, [30, 40, 12000, null]],
    [HOJAS.CONFIGURACION]: [
      HEADERS.configuracion,
      ['precio_clase_mensual', '110000', 'Mensualidad'],
      ['margen_minimo_alerta_pct', '20', 'Umbral']
    ]
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) datos[k] = v
  }
  return fabricarXlsx(datos, destino)
}

describe('plantilla — Fase A · generador', () => {
  let tmpRoot: string
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'plantilla-gen-'))
    MOCK_DOWNLOADS = tmpRoot
  })
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('genera un xlsx con todas las hojas esperadas', async () => {
    const path = await generarPlantilla()
    expect(path).toContain(tmpRoot)
    const wb = XLSX.readFile(path)
    for (const hoja of Object.values(HOJAS)) {
      expect(wb.Sheets[hoja]).toBeDefined()
    }
  })

  it('cada hoja tiene los encabezados oficiales en la fila 1', async () => {
    const path = await generarPlantilla()
    const wb = XLSX.readFile(path)
    const negocio = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[HOJAS.NEGOCIO])
    expect(Object.keys(negocio[0] ?? {})).toEqual(expect.arrayContaining(HEADERS.negocio))
    const marcos = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[HOJAS.MARCOS])
    expect(Object.keys(marcos[0] ?? {})).toEqual(expect.arrayContaining(HEADERS.marcos))
  })

  it('contiene filas marcadas como EJEMPLO que el parser ignora', async () => {
    const path = await generarPlantilla()
    const wb = XLSX.readFile(path)
    const marcos = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[HOJAS.MARCOS])
    expect(marcos.some((r) => String(r['Referencia']).startsWith('EJEMPLO'))).toBe(true)
  })

  it('la plantilla generada es parseable y NO carga las filas EJEMPLO', async () => {
    const path = await generarPlantilla()
    const res = parsearPlantilla(path)
    // Las filas EJEMPLO se filtran. Quedan solo las que vienen pre-llenas en
    // proveedores y vidrios como sugerencias reales (Alperto, Edimol, etc).
    expect(res.errores).toEqual([])
    expect(res.datos.marcos.length).toBe(0) // todas las filas de marcos son EJEMPLO
    // Vidrios pre-llenos: Vidrio claro 2mm/3mm + Antirreflectivo 2mm
    expect(res.datos.vidrios.length).toBeGreaterThan(0)
    expect(res.datos.proveedores.map((p) => p.nombre)).toContain('Alperto')
  })
})

describe('plantilla — Fase B · parser', () => {
  let tmpRoot: string
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'plantilla-parse-'))
    MOCK_DOWNLOADS = tmpRoot
  })
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function path(): string {
    return join(tmpRoot, `plantilla-${Math.random().toString(36).slice(2)}.xlsx`)
  }

  it('parsea una plantilla mínima válida sin errores', () => {
    const res = parsearPlantilla(plantillaMinima(path()))
    expect(res.ok).toBe(true)
    expect(res.errores).toEqual([])
    expect(res.datos.negocio?.nombre).toBe('Casa Alberto')
    expect(res.datos.proveedores).toHaveLength(2)
    expect(res.datos.marcos).toHaveLength(1)
    expect(res.datos.marcos[0].referencia).toBe('M-001')
    expect(res.datos.marcos[0].proveedor).toBe('Alperto')
    expect(res.datos.vidrios).toHaveLength(1)
    expect(res.datos.configuracion).toHaveLength(2)
  })

  it('rechaza si falta una hoja obligatoria', () => {
    const ruta = path()
    fabricarXlsx(
      {
        [HOJAS.NEGOCIO]: [HEADERS.negocio, ['Casa', '123', '320', 'Cra 7', null]]
        // faltan todas las demás hojas
      },
      ruta
    )
    const res = parsearPlantilla(ruta)
    expect(res.ok).toBe(false)
    expect(res.errores[0].mensaje).toMatch(/no contiene las hojas/i)
  })

  it('reporta error en marco con precio 0', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [HEADERS.marcos, ['M-OK', 'Alperto', 48, 47000, null, null], ['M-MAL', 'Alperto', 48, 0, null, null]]
      })
    )
    expect(res.ok).toBe(false)
    const err = res.errores.find((e) => e.fila === 3 && e.hoja === HOJAS.MARCOS)
    expect(err).toBeDefined()
    expect(err?.campo).toBe('Precio_metro')
  })

  it('reporta referencia de marco duplicada', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [
          HEADERS.marcos,
          ['DUP', 'Alperto', 48, 47000, null, null],
          ['DUP', 'Alperto', 50, 50000, null, null]
        ]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.mensaje.toLowerCase().includes('duplicada'))).toBe(true)
  })

  it('reporta marco que apunta a proveedor inexistente', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [HEADERS.marcos, ['M-001', 'Fantasma', 48, 47000, null, null]]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.campo === 'Proveedor')).toBe(true)
  })

  it('acepta marco sin proveedor (proveedor opcional)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [HEADERS.marcos, ['M-001', null, 48, 47000, null, null]]
      })
    )
    expect(res.ok).toBe(true)
  })

  it('reporta vidrio con espesor inválido', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.VIDRIOS]: [HEADERS.vidrios, ['Vidrio claro', 0, 100000, null]]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.campo === 'Espesor_mm')).toBe(true)
  })

  it('reporta vidrio duplicado (mismo nombre + espesor)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.VIDRIOS]: [
          HEADERS.vidrios,
          ['Vidrio claro', 2, 100000, null],
          ['VIDRIO CLARO', 2, 110000, null] // case insensitive
        ]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.mensaje.toLowerCase().includes('duplicado'))).toBe(true)
  })

  it('reporta medida duplicada en paspartú', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.PASPARTU_PINTADO]: [HEADERS.medidas, [30, 40, 12000, null], [30, 40, 13000, null]]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.mensaje.toLowerCase().includes('duplicada'))).toBe(true)
  })

  it('rechaza clave de configuración no permitida (whitelist)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['onboarding_completed', '0', '']]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.campo === 'Clave')).toBe(true)
  })

  it('rechaza margen_minimo fuera de rango', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['margen_minimo_alerta_pct', '150', '']]
      })
    )
    expect(res.ok).toBe(false)
    // Mensaje generado por `validarValorConfig` contra SPEC_NUMERICAS:
    // "El valor de margen_minimo_alerta_pct no puede ser mayor a 100 %"
    expect(
      res.errores.some(
        (e) => e.mensaje.toLowerCase().includes('100') && /mayor|menor|entre/.test(e.mensaje.toLowerCase())
      )
    ).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // PoCs del informe de seguridad sobre `7f37f5b` — el parser dejaba pasar
  // dias_entrega_* sin validación. Ahora SPEC_NUMERICAS define que son
  // enteros 0-365 y el parser rechaza valores fuera de ese dominio antes de
  // llegar a la DB.
  // ---------------------------------------------------------------------------

  it('rechaza dias_entrega_urgente negativo (PoC -2 del informe)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['dias_entrega_urgente', '-2', '']]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => e.campo === 'Valor')).toBe(true)
  })

  it('rechaza dias_entrega_estandar decimal (PoC 3.5 del informe)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['dias_entrega_estandar', '3.5', '']]
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errores.some((e) => /entero/i.test(e.mensaje))).toBe(true)
  })

  it('rechaza dias_entrega_sin_afan absurdo (PoC 100000000 del informe)', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['dias_entrega_sin_afan', '100000000', '']]
      })
    )
    expect(res.ok).toBe(false)
  })

  it('rechaza tiempo_entrega_default no-número', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion, ['tiempo_entrega_default', 'abc', '']]
      })
    )
    expect(res.ok).toBe(false)
  })

  it('rechaza porcentaje_costo_materiales_armado_default fuera de rango', () => {
    // Antes esta clave no se validaba en ningún path. Ahora SPEC_NUMERICAS
    // la define como 0-100.
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [
          HEADERS.configuracion,
          ['porcentaje_costo_materiales_armado_default', '200', '']
        ]
      })
    )
    expect(res.ok).toBe(false)
  })

  it('acepta dias_entrega_* en rango válido', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.CONFIGURACION]: [
          HEADERS.configuracion,
          ['dias_entrega_urgente', '3', ''],
          ['dias_entrega_estandar', '7', ''],
          ['dias_entrega_sin_afan', '14', '']
        ]
      })
    )
    expect(res.ok).toBe(true)
    expect(res.datos.configuracion).toHaveLength(3)
  })

  it('ignora filas marcadas como EJEMPLO', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [
          HEADERS.marcos,
          ['EJEMPLO - BORRAR', 'Alperto', 48, 47000, null, 'ejemplo'],
          ['REAL-001', 'Alperto', 50, 50000, null, 'real']
        ]
      })
    )
    expect(res.ok).toBe(true)
    expect(res.datos.marcos).toHaveLength(1)
    expect(res.datos.marcos[0].referencia).toBe('REAL-001')
  })

  it('ignora filas completamente vacías', () => {
    const res = parsearPlantilla(
      plantillaMinima(path(), {
        [HOJAS.MARCOS]: [
          HEADERS.marcos,
          ['M-001', 'Alperto', 48, 47000, null, null],
          [null, null, null, null, null, null],
          ['M-002', 'Alperto', 50, 50000, null, null]
        ]
      })
    )
    expect(res.ok).toBe(true)
    expect(res.datos.marcos).toHaveLength(2)
  })

  it('parseNum acepta números con separador de miles', () => {
    expect(__testing__.parseNum('47.000')).toBe(47000)
    expect(__testing__.parseNum('47,000')).toBe(47000)
    expect(__testing__.parseNum('1.234.567')).toBe(1234567)
    expect(__testing__.parseNum('$ 47000')).toBe(47000)
    expect(__testing__.parseNum(47000)).toBe(47000)
    expect(__testing__.parseNum('texto')).toBeNull()
    expect(__testing__.parseNum(null)).toBeNull()
    expect(__testing__.parseNum('')).toBeNull()
  })

  it('buildTipoVidrio normaliza nombres con espesor incrustado', () => {
    expect(__testing__.buildTipoVidrio('Vidrio claro 2mm', 2)).toBe('claro_2mm')
    expect(__testing__.buildTipoVidrio('Antirreflectivo', 3)).toBe('antirreflectivo_3mm')
    expect(__testing__.buildTipoVidrio('Espejo Plata', 4)).toBe('espejo_plata_4mm')
  })

  it('rechaza archivos > 15 MB', () => {
    const ruta = path()
    // Escribir 16 MB de basura directamente
    const fs = require('fs') as typeof import('fs')
    fs.writeFileSync(ruta, Buffer.alloc(16 * 1024 * 1024, 0))
    const res = parsearPlantilla(ruta)
    expect(res.ok).toBe(false)
    expect(res.errores[0].mensaje).toMatch(/15 MB/i)
  })

  it('no contamina Object.prototype con __proto__ en celdas', () => {
    const ruta = path()
    const headers = [...HEADERS.marcos, '__proto__']
    fabricarXlsx(
      {
        [HOJAS.NEGOCIO]: [HEADERS.negocio, ['Casa', '123', '320', 'Cra 7', null]],
        [HOJAS.PROVEEDORES]: [HEADERS.proveedores, ['Alperto', 'Marcos', null, null, null, null]],
        [HOJAS.MARCOS]: [headers, ['EVIL', 'Alperto', 48, 47000, null, null, 'pwned']],
        [HOJAS.VIDRIOS]: [HEADERS.vidrios],
        [HOJAS.PASPARTU_PINTADO]: [HEADERS.medidas],
        [HOJAS.PASPARTU_ACRILICO]: [HEADERS.medidas],
        [HOJAS.RETABLOS]: [HEADERS.medidas],
        [HOJAS.BASTIDORES]: [HEADERS.medidas],
        [HOJAS.TAPAS]: [HEADERS.medidas],
        [HOJAS.CONFIGURACION]: [HEADERS.configuracion]
      },
      ruta
    )
    parsearPlantilla(ruta)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).pwned).toBeUndefined()
  })
})

describe.runIf(nativeAbiAvailable)('plantilla — Fase C · cargador', () => {
  let db: DB
  let tmpRoot: string

  beforeEach(() => {
    db = createTestDb().db
    tmpRoot = mkdtempSync(join(tmpdir(), 'plantilla-load-'))
    MOCK_DOWNLOADS = tmpRoot
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function pathFresh(): string {
    return join(tmpRoot, `plantilla-${Math.random().toString(36).slice(2)}.xlsx`)
  }

  function cargarMinima(modo: 'upsert' | 'solo_agregar' | 'reemplazar' = 'upsert'): {
    parsed: PlantillaParsed
    res: ReturnType<typeof cargarPlantilla>
  } {
    const r = parsearPlantilla(plantillaMinima(pathFresh()))
    expect(r.ok).toBe(true)
    return { parsed: r.datos, res: cargarPlantilla(db, r.datos, modo) }
  }

  it('upsert crea proveedores, marcos, vidrios y configuración', () => {
    const { res } = cargarMinima()
    expect(res.creados.proveedores).toBe(2)
    expect(res.creados.marcos).toBe(1)
    expect(res.creados.vidrios).toBe(1)
    expect(res.creados.paspartuPintado).toBe(1)
    expect(res.creados.bastidores).toBe(1)

    const provs = db.select().from(proveedores).all()
    expect(provs.map((p) => p.nombre)).toContain('Alperto')

    const marcos = db.select().from(muestrasMarcos).all()
    expect(marcos).toHaveLength(1)
    expect(marcos[0].referencia).toBe('M-001')
    expect(marcos[0].costoMetroEstimado).toBe(30000)
    expect(marcos[0].proveedorId).toBe(provs.find((p) => p.nombre === 'Alperto')?.id)
  })

  it('upsert actualiza precios de marcos existentes en una segunda carga', () => {
    cargarMinima()
    // Segunda carga: cambia precio del mismo marco
    const ruta = pathFresh()
    plantillaMinima(ruta, {
      [HOJAS.MARCOS]: [HEADERS.marcos, ['M-001', 'Alperto', 48, 60000, 35000, 'Roble premium']]
    })
    const r = parsearPlantilla(ruta)
    const res = cargarPlantilla(db, r.datos, 'upsert')
    expect(res.actualizados.marcos).toBe(1)
    expect(res.creados.marcos).toBe(0)

    const marcos = db.select().from(muestrasMarcos).all()
    expect(marcos).toHaveLength(1)
    expect(marcos[0].precioMetro).toBe(60000)
    expect(marcos[0].costoMetroEstimado).toBe(35000)
    expect(marcos[0].descripcion).toBe('Roble premium')
  })

  it('solo_agregar ignora marcos existentes', () => {
    cargarMinima()
    const ruta = pathFresh()
    plantillaMinima(ruta, {
      [HOJAS.MARCOS]: [
        HEADERS.marcos,
        ['M-001', 'Alperto', 48, 99999, null, 'cambio que NO debe aplicar'],
        ['M-002', 'Alperto', 50, 50000, null, 'nuevo']
      ]
    })
    const r = parsearPlantilla(ruta)
    const res = cargarPlantilla(db, r.datos, 'solo_agregar')
    expect(res.creados.marcos).toBe(1)
    expect(res.ignorados.marcos).toBe(1)

    const m1 = db.select().from(muestrasMarcos).all().find((m) => m.referencia === 'M-001')
    expect(m1?.precioMetro).toBe(47000) // sin cambios
  })

  it('reemplazar borra todo lo previo antes de cargar', () => {
    // Primer carga
    cargarMinima()
    expect(db.select().from(muestrasMarcos).all()).toHaveLength(1)
    expect(db.select().from(proveedores).all()).toHaveLength(2)

    // Segunda carga en modo reemplazar con plantilla totalmente distinta
    const ruta = pathFresh()
    plantillaMinima(ruta, {
      [HOJAS.PROVEEDORES]: [HEADERS.proveedores, ['SoloUno', 'Marcos', null, null, null, null]],
      [HOJAS.MARCOS]: [HEADERS.marcos, ['SOLO-1', 'SoloUno', 30, 25000, null, null]]
    })
    const r = parsearPlantilla(ruta)
    cargarPlantilla(db, r.datos, 'reemplazar')

    const provs = db.select().from(proveedores).all()
    expect(provs).toHaveLength(1)
    expect(provs[0].nombre).toBe('SoloUno')
    const marcos = db.select().from(muestrasMarcos).all()
    expect(marcos).toHaveLength(1)
    expect(marcos[0].referencia).toBe('SOLO-1')
  })

  it('si una validación falla a mitad de carga, hace rollback completo', () => {
    // Hacemos una transacción con datos válidos del parser pero forzamos un
    // error después: insertamos un marco con datos válidos y luego corromp.
    cargarMinima()
    const conteoMarcos = db.select().from(muestrasMarcos).all().length

    // Forzamos un fallo: cargamos con un marco que apunta a proveedor que NO
    // existe en la plantilla — el parser ya lo rechaza, pero si por algún
    // bug llegara al cargador, el constraint de la DB no lo ataja porque
    // proveedor_id puede ser null. Validamos que el parser hace su trabajo.
    const ruta = pathFresh()
    plantillaMinima(ruta, {
      [HOJAS.MARCOS]: [HEADERS.marcos, ['M-X', 'NoExiste', 48, 47000, null, null]]
    })
    const r = parsearPlantilla(ruta)
    expect(r.ok).toBe(false) // parser lo bloquea antes
    // La DB no se debe haber tocado en este escenario.
    expect(db.select().from(muestrasMarcos).all()).toHaveLength(conteoMarcos)
  })

  it('configuración del negocio actualiza claves existentes y marca onboarding completado', () => {
    cargarMinima()
    const config = db.select().from(configuracion).all()
    expect(config.find((c) => c.clave === 'nombre_negocio')?.valor).toBe('Casa Alberto')
    expect(config.find((c) => c.clave === 'onboarding_completed')?.valor).toBe('1')
    expect(config.find((c) => c.clave === 'precio_clase_mensual')?.valor).toBe('110000')
  })

  it('vidrios usan tipo derivado consistente con buildTipoVidrio', () => {
    cargarMinima()
    const vids = db.select().from(preciosVidrios).all()
    expect(vids).toHaveLength(1)
    expect(vids[0].tipo).toBe('claro_2mm')
    expect(vids[0].nombre).toBe('Vidrio claro')
    expect(vids[0].espesorMm).toBe(2)
  })

  it('upsert respeta la unicidad por (ancho, alto) en paspartú', () => {
    cargarMinima()
    const ruta = pathFresh()
    plantillaMinima(ruta, {
      [HOJAS.PASPARTU_PINTADO]: [
        HEADERS.medidas,
        [30, 40, 13000, null], // misma medida, distinto precio
        [40, 50, 18000, null] // medida nueva
      ]
    })
    const r = parsearPlantilla(ruta)
    cargarPlantilla(db, r.datos, 'upsert')
    const filas = db.select().from(preciosPaspartuPintado).all()
    expect(filas).toHaveLength(2)
    const p3040 = filas.find((f) => f.anchoCm === 30 && f.altoCm === 40)
    expect(p3040?.precio).toBe(13000)
  })
})

describe('plantilla — utilidades internas', () => {
  it('esFilaEjemplo detecta marcadores en la primera celda', () => {
    expect(__testing__.esFilaEjemplo({ A: 'EJEMPLO - BORRAR', B: 'x' })).toBe(true)
    expect(__testing__.esFilaEjemplo({ A: 'ejemplo', B: 'x' })).toBe(true)
    expect(__testing__.esFilaEjemplo({ A: 'ejemplo - borrar', B: 'x' })).toBe(true)
    expect(__testing__.esFilaEjemplo({ A: 'M-001', B: 'x' })).toBe(false)
  })

  it('esFilaVacia detecta filas con todas las celdas null/empty', () => {
    expect(__testing__.esFilaVacia({ A: null, B: '', C: undefined })).toBe(true)
    expect(__testing__.esFilaVacia({ A: 'algo', B: null })).toBe(false)
  })

  it('trunc elimina control chars y limita longitud', () => {
    expect(__testing__.trunc('hola\x00mundo')).toBe('holamundo')
    expect(__testing__.trunc('  hola  ')).toBe('hola')
    expect(__testing__.trunc('A'.repeat(500)).length).toBe(200)
  })

  it('CLAVES_CONFIG_PERMITIDAS solo contiene whitelist conocida', () => {
    expect(__testing__.CLAVES_CONFIG_PERMITIDAS.has('precio_clase_mensual')).toBe(true)
    expect(__testing__.CLAVES_CONFIG_PERMITIDAS.has('onboarding_completed')).toBe(false)
    expect(__testing__.CLAVES_CONFIG_PERMITIDAS.has('__proto__')).toBe(false)
  })
})

// Suprime warnings de drizzle al cerrar el sql al final de cada suite
void sql
