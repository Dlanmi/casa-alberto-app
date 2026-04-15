import * as XLSX from 'xlsx'
import { app, dialog } from 'electron'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import type { DB } from '../db'
import {
  muestrasMarcos,
  preciosVidrios,
  preciosPaspartuPintado,
  preciosPaspartuAcrilico,
  preciosRetablos,
  preciosBastidores,
  preciosTapas,
  clientes,
  inventario,
  movimientosFinancieros
} from '../db/schema'

// ---- Export helpers ----

function toSheet<T extends Record<string, unknown>>(rows: T[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows)
}

export function exportarReporteFinanciero(db: DB, mes: string): string {
  const movs = db
    .select()
    .from(movimientosFinancieros)
    .all()
    .filter((m) => m.fecha.startsWith(mes))

  const wb = XLSX.utils.book_new()
  const ws = toSheet(
    movs.map((m) => ({
      Fecha: m.fecha,
      Tipo: m.tipo,
      Categoria: m.categoria,
      Descripcion: m.descripcion ?? '',
      Monto: m.monto
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

  const filePath = join(app.getPath('downloads'), `finanzas-${mes}.xlsx`)
  XLSX.writeFile(wb, filePath)
  return filePath
}

export function exportarClientes(db: DB): string {
  const rows = db.select().from(clientes).all()
  const wb = XLSX.utils.book_new()
  const ws = toSheet(
    rows.map((c) => ({
      Nombre: c.nombre,
      Telefono: c.telefono ?? '',
      Cedula: c.cedula ?? '',
      Correo: c.correo ?? '',
      Direccion: c.direccion ?? '',
      Activo: c.activo ? 'Si' : 'No'
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  const filePath = join(app.getPath('downloads'), 'clientes.xlsx')
  XLSX.writeFile(wb, filePath)
  return filePath
}

export function exportarInventario(db: DB): string {
  const rows = db.select().from(inventario).all()
  const wb = XLSX.utils.book_new()
  const ws = toSheet(
    rows.map((i) => ({
      Nombre: i.nombre,
      Referencia: i.referencia ?? '',
      Tipo: i.tipo,
      Unidad: i.unidad,
      'Stock Actual': i.stockActual,
      'Stock Minimo': i.stockMinimo,
      Activo: i.activo ? 'Si' : 'No'
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  const filePath = join(app.getPath('downloads'), 'inventario.xlsx')
  XLSX.writeFile(wb, filePath)
  return filePath
}

export function exportarListasPrecios(db: DB): string {
  const wb = XLSX.utils.book_new()

  const marcos = db.select().from(muestrasMarcos).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(
      marcos.map((m) => ({
        Referencia: m.referencia,
        'Colilla cm': m.colillaCm,
        'Precio/m': m.precioMetro,
        Descripcion: m.descripcion ?? ''
      }))
    ),
    'Marcos'
  )

  const vidrios = db.select().from(preciosVidrios).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(vidrios.map((v) => ({ Tipo: v.tipo, 'Precio/m2': v.precioM2 }))),
    'Vidrios'
  )

  const pasP = db.select().from(preciosPaspartuPintado).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(pasP.map((p) => ({ 'Ancho cm': p.anchoCm, 'Alto cm': p.altoCm, Precio: p.precio }))),
    'Paspartu Pintado'
  )

  const pasA = db.select().from(preciosPaspartuAcrilico).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(pasA.map((p) => ({ 'Ancho cm': p.anchoCm, 'Alto cm': p.altoCm, Precio: p.precio }))),
    'Paspartu Acrilico'
  )

  const ret = db.select().from(preciosRetablos).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(ret.map((r) => ({ 'Ancho cm': r.anchoCm, 'Alto cm': r.altoCm, Precio: r.precio }))),
    'Retablos'
  )

  const bast = db.select().from(preciosBastidores).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(bast.map((b) => ({ 'Ancho cm': b.anchoCm, 'Alto cm': b.altoCm, Precio: b.precio }))),
    'Bastidores'
  )

  const tap = db.select().from(preciosTapas).all()
  XLSX.utils.book_append_sheet(
    wb,
    toSheet(tap.map((t) => ({ 'Ancho cm': t.anchoCm, 'Alto cm': t.altoCm, Precio: t.precio }))),
    'Tapas'
  )

  const filePath = join(app.getPath('downloads'), 'listas-precios.xlsx')
  XLSX.writeFile(wb, filePath)
  return filePath
}

// ---- Import: marcos from xlsx ----

export function importarMarcosDesdeExcel(db: DB): { imported: number; updated: number } {
  const result = dialog.showOpenDialogSync({
    title: 'Importar lista de marcos',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  })
  if (!result || result.length === 0) return { imported: 0, updated: 0 }

  const wb = XLSX.readFile(result[0])
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  return db.transaction((tx) => {
    let inserted = 0
    let updated = 0
    for (const row of rows) {
      const referencia = String(row['Referencia'] ?? row['referencia'] ?? '')
      const colilla = Number(row['Colilla cm'] ?? row['colillaCm'] ?? row['colilla_cm'] ?? 0)
      const precio = Number(row['Precio/m'] ?? row['precioMetro'] ?? row['precio_metro'] ?? 0)
      const desc = String(row['Descripcion'] ?? row['descripcion'] ?? '')

      if (referencia && precio > 0) {
        const existing = tx
          .select()
          .from(muestrasMarcos)
          .where(eq(muestrasMarcos.referencia, referencia))
          .get()

        tx.insert(muestrasMarcos)
          .values({
            referencia,
            colillaCm: colilla,
            precioMetro: precio,
            descripcion: desc || null
          })
          .onConflictDoUpdate({
            target: muestrasMarcos.referencia,
            set: { colillaCm: colilla, precioMetro: precio, descripcion: desc || null }
          })
          .run()

        if (existing) updated++
        else inserted++
      }
    }
    return { imported: inserted, updated }
  })
}
