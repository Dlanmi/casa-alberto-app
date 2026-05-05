// Test end-to-end del flujo completo: generar plantilla → llenar como
// tu papá → re-escribir → parsear → cargar en DB → verificar resultado.
// Asegura que el ciclo "descarga ↔ sube" no introduce inconsistencias.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as XLSX from '@e965/xlsx'
import {
  generarPlantilla,
  parsearPlantilla,
  cargarPlantilla,
  HOJAS
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

let MOCK_DOWNLOADS = ''
vi.mock('electron', () => ({
  app: { getPath: () => MOCK_DOWNLOADS },
  dialog: { showOpenDialogSync: vi.fn(() => undefined) },
  shell: { showItemInFolder: vi.fn() }
}))

describe.runIf(nativeAbiAvailable)('plantilla — flujo END-TO-END', () => {
  let db: DB
  let tmpRoot: string

  beforeEach(() => {
    db = createTestDb().db
    tmpRoot = mkdtempSync(join(tmpdir(), 'plantilla-e2e-'))
    MOCK_DOWNLOADS = tmpRoot
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('descarga vacía + sube vacía: parser OK, DB vacía (solo configuración por negocio)', async () => {
    // Plantilla recién generada SIN llenar nada (filas EJEMPLO no se cargan)
    const path = await generarPlantilla()
    const res = parsearPlantilla(path)
    expect(res.ok).toBe(true)
    expect(res.errores).toEqual([])

    // Solo los datos pre-llenados de la plantilla deben cargarse:
    //   - Proveedores: Alperto, Edimol, Homecenter
    //   - Vidrios: claro 2mm, claro 3mm, antirreflectivo 2mm
    //   - Configuración: precio_clase_mensual, precio_kit_dibujo, etc.
    expect(res.datos.proveedores.map((p) => p.nombre)).toEqual(
      expect.arrayContaining(['Alperto', 'Edimol', 'Homecenter'])
    )
    expect(res.datos.vidrios.length).toBe(3)
    expect(res.datos.marcos.length).toBe(0) // Marcos están todos como EJEMPLO
    expect(res.datos.configuracion.length).toBeGreaterThanOrEqual(3)

    // Cargar a DB
    const carga = cargarPlantilla(db, res.datos, 'upsert')
    expect(carga.creados.proveedores).toBe(3)
    expect(carga.creados.vidrios).toBe(3)
    expect(carga.creados.marcos).toBe(0)
  })

  it('descarga + llena con datos reales + sube: carga correcta y consistente', async () => {
    // 1. Generar plantilla
    const pathOriginal = await generarPlantilla()

    // 2. Simular lo que haría tu papá: leer la plantilla y agregar datos reales
    const wb = XLSX.readFile(pathOriginal)

    // Agregar datos del negocio
    const wsNeg = wb.Sheets[HOJAS.NEGOCIO]
    XLSX.utils.sheet_add_aoa(
      wsNeg,
      [
        // sobreescribimos la fila ejemplo (fila 2) con datos reales
        ['Casa Alberto', '900.123.456-7', '+57 320 555 1234', 'Cra 7 # 145-23, Bogotá', 'casa@alberto.com']
      ],
      { origin: 'A2' }
    )

    // Agregar 3 marcos reales
    const wsMarcos = wb.Sheets[HOJAS.MARCOS]
    XLSX.utils.sheet_add_aoa(
      wsMarcos,
      [
        ['K473', 'Alperto', 48, 47000, 30000, 'Roble oscuro premium'],
        ['M-100', 'Alperto', 32, 28000, 18000, 'Negro mate'],
        ['BL-001', 'Edimol', 36, 32000, 21000, 'Blanco liso']
      ],
      { origin: 'A4' } // después de las 2 filas EJEMPLO
    )

    // 3. Reescribir el archivo modificado
    const pathLleno = join(tmpRoot, 'plantilla-llena.xlsx')
    XLSX.writeFile(wb, pathLleno)

    // 4. Parsear
    const res = parsearPlantilla(pathLleno)
    expect(res.ok).toBe(true)
    expect(res.errores).toEqual([])
    expect(res.datos.negocio?.nombre).toBe('Casa Alberto')
    expect(res.datos.negocio?.rut).toBe('900.123.456-7')
    expect(res.datos.marcos).toHaveLength(3)
    expect(res.datos.marcos.map((m) => m.referencia)).toEqual(['K473', 'M-100', 'BL-001'])

    // 5. Cargar a DB
    const carga = cargarPlantilla(db, res.datos, 'upsert')
    expect(carga.creados.proveedores).toBe(3)
    expect(carga.creados.marcos).toBe(3)
    expect(carga.creados.vidrios).toBe(3) // los pre-cargados de la plantilla

    // 6. Verificar que los datos están bien guardados
    const provs = db.select().from(proveedores).all()
    const alperto = provs.find((p) => p.nombre === 'Alperto')
    expect(alperto).toBeDefined()

    const marcos = db.select().from(muestrasMarcos).all()
    expect(marcos).toHaveLength(3)
    const k473 = marcos.find((m) => m.referencia === 'K473')
    expect(k473?.colillaCm).toBe(48)
    expect(k473?.precioMetro).toBe(47000)
    expect(k473?.costoMetroEstimado).toBe(30000)
    expect(k473?.proveedorId).toBe(alperto?.id)

    const vidrios = db.select().from(preciosVidrios).all()
    expect(vidrios.map((v) => v.tipo).sort()).toEqual([
      'antirreflectivo_2mm',
      'claro_2mm',
      'claro_3mm'
    ])

    const cfg = db.select().from(configuracion).all()
    expect(cfg.find((c) => c.clave === 'nombre_negocio')?.valor).toBe('Casa Alberto')
    expect(cfg.find((c) => c.clave === 'rut')?.valor).toBe('900.123.456-7')
    expect(cfg.find((c) => c.clave === 'onboarding_completed')?.valor).toBe('1')
  })

  it('descarga + llena con datos malos + sube: parser detecta TODOS los errores en una pasada', async () => {
    const pathOriginal = await generarPlantilla()
    const wb = XLSX.readFile(pathOriginal)

    // Llenamos con varios errores intencionales
    XLSX.utils.sheet_add_aoa(
      wb.Sheets[HOJAS.MARCOS],
      [
        ['REF-001', 'Alperto', 48, 47000, null, 'OK'],
        ['REF-001', 'Alperto', 50, 50000, null, 'duplicada'], // duplicada
        ['REF-002', 'Inexistente', 32, 28000, null, null], // proveedor no existe
        ['REF-003', 'Alperto', -5, 28000, null, null], // colilla negativa
        ['REF-004', 'Alperto', 48, 0, null, null] // precio cero
      ],
      { origin: 'A4' }
    )
    XLSX.utils.sheet_add_aoa(
      wb.Sheets[HOJAS.PASPARTU_PINTADO],
      [
        [30, 40, 12000, null],
        [30, 40, 13000, null] // duplicada
      ],
      { origin: 'A4' }
    )

    const pathMalo = join(tmpRoot, 'plantilla-mala.xlsx')
    XLSX.writeFile(wb, pathMalo)

    const res = parsearPlantilla(pathMalo)
    expect(res.ok).toBe(false)
    expect(res.errores.length).toBeGreaterThanOrEqual(5)

    // Verifica que TODOS los errores se reportan (no solo el primero)
    const mensajesMarcos = res.errores
      .filter((e) => e.hoja === HOJAS.MARCOS)
      .map((e) => e.mensaje)
    expect(mensajesMarcos.some((m) => m.toLowerCase().includes('duplicada'))).toBe(true)
    expect(
      res.errores.some(
        (e) => e.hoja === HOJAS.MARCOS && e.campo === 'Proveedor'
      )
    ).toBe(true)
    expect(
      res.errores.some((e) => e.hoja === HOJAS.MARCOS && e.campo === 'Colilla_cm')
    ).toBe(true)
    expect(
      res.errores.some((e) => e.hoja === HOJAS.MARCOS && e.campo === 'Precio_metro')
    ).toBe(true)
    expect(
      res.errores.some(
        (e) => e.hoja === HOJAS.PASPARTU_PINTADO && e.mensaje.toLowerCase().includes('duplicada')
      )
    ).toBe(true)

    // La DB no se debe haber tocado: si hay errores, NO se carga nada.
    expect(db.select().from(muestrasMarcos).all()).toHaveLength(0)
  })

  it('cargar 2 veces el mismo Excel: idempotente con upsert (no duplica)', async () => {
    const pathOriginal = await generarPlantilla()
    const wb = XLSX.readFile(pathOriginal)
    XLSX.utils.sheet_add_aoa(
      wb.Sheets[HOJAS.MARCOS],
      [['M-IDEMP', 'Alperto', 48, 47000, null, 'idempotencia']],
      { origin: 'A4' }
    )
    const path = join(tmpRoot, 'idemp.xlsx')
    XLSX.writeFile(wb, path)

    // Primera carga
    const res1 = parsearPlantilla(path)
    cargarPlantilla(db, res1.datos, 'upsert')
    const marcos1 = db.select().from(muestrasMarcos).all()
    const provs1 = db.select().from(proveedores).all()

    // Segunda carga (mismo archivo)
    const res2 = parsearPlantilla(path)
    const carga2 = cargarPlantilla(db, res2.datos, 'upsert')

    // Marcos NO deben duplicarse
    const marcos2 = db.select().from(muestrasMarcos).all()
    expect(marcos2).toHaveLength(marcos1.length)
    expect(carga2.creados.marcos).toBe(0)
    expect(carga2.actualizados.marcos).toBe(1)

    // Proveedores NO deben duplicarse
    const provs2 = db.select().from(proveedores).all()
    expect(provs2).toHaveLength(provs1.length)
  })

  it('actualizar precio: re-importar con nuevo precio aplica el cambio', async () => {
    // Carga inicial con precio 47000
    const path1 = await generarPlantilla()
    const wb1 = XLSX.readFile(path1)
    XLSX.utils.sheet_add_aoa(
      wb1.Sheets[HOJAS.MARCOS],
      [['M-PRICE', 'Alperto', 48, 47000, 30000, 'precio v1']],
      { origin: 'A4' }
    )
    const ruta1 = join(tmpRoot, 'v1.xlsx')
    XLSX.writeFile(wb1, ruta1)
    const res1 = parsearPlantilla(ruta1)
    cargarPlantilla(db, res1.datos, 'upsert')

    expect(
      db
        .select()
        .from(muestrasMarcos)
        .all()
        .find((m) => m.referencia === 'M-PRICE')?.precioMetro
    ).toBe(47000)

    // Re-import con precio actualizado a 55000
    const path2 = await generarPlantilla()
    const wb2 = XLSX.readFile(path2)
    XLSX.utils.sheet_add_aoa(
      wb2.Sheets[HOJAS.MARCOS],
      [['M-PRICE', 'Alperto', 48, 55000, 35000, 'precio v2 — subió 17%']],
      { origin: 'A4' }
    )
    const ruta2 = join(tmpRoot, 'v2.xlsx')
    XLSX.writeFile(wb2, ruta2)
    const res2 = parsearPlantilla(ruta2)
    const carga = cargarPlantilla(db, res2.datos, 'upsert')

    expect(carga.actualizados.marcos).toBeGreaterThanOrEqual(1)
    const actualizado = db
      .select()
      .from(muestrasMarcos)
      .all()
      .find((m) => m.referencia === 'M-PRICE')
    expect(actualizado?.precioMetro).toBe(55000)
    expect(actualizado?.costoMetroEstimado).toBe(35000)
    expect(actualizado?.descripcion).toBe('precio v2 — subió 17%')
  })

  it('paspartú con datos reales se cargan correctamente y son recuperables', async () => {
    const pathOriginal = await generarPlantilla()
    const wb = XLSX.readFile(pathOriginal)

    XLSX.utils.sheet_add_aoa(
      wb.Sheets[HOJAS.PASPARTU_PINTADO],
      [
        [30, 40, 12000, 7000],
        [40, 50, 18000, 10500],
        [50, 70, 25000, 15000]
      ],
      { origin: 'A4' }
    )

    const path = join(tmpRoot, 'paspartu.xlsx')
    XLSX.writeFile(wb, path)
    const res = parsearPlantilla(path)
    cargarPlantilla(db, res.datos, 'upsert')

    const filas = db.select().from(preciosPaspartuPintado).all()
    expect(filas).toHaveLength(3)
    const p3040 = filas.find((f) => f.anchoCm === 30 && f.altoCm === 40)
    expect(p3040?.precio).toBe(12000)
    expect(p3040?.costoEstimado).toBe(7000)
  })
})
