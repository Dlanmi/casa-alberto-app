// Importador / Exportador unificado de plantilla Excel para Casa Alberto.
//
// La plantilla concentra TODA la información de configuración inicial:
//   1. Datos del negocio (cabecera de facturas)
//   2. Proveedores
//   3. Marcos
//   4. Vidrios
//   5. Paspartú pintado
//   6. Paspartú acrílico
//   7. Retablos
//   8. Bastidores
//   9. Tapas
//   10. Configuración general (precio clase, kit, margen mínimo, % materiales)
//
// Flujo: el dueño descarga la plantilla vacía, la llena, la sube y la app
// la procesa en una transacción atómica. Si cualquier validación falla, NADA
// se guarda en la DB (rollback completo).
//
// Defensas en capas:
//   1. Tamaño máximo del archivo (15 MB)
//   2. sanitizeRow contra prototype pollution
//   3. Validaciones de tipo y rango en cada fila
//   4. Validaciones cruzadas (marco apunta a proveedor que existe)
//   5. CHECK constraints en SQLite como último escudo
import * as XLSX from '@e965/xlsx'
import ExcelJS from 'exceljs'
import { app, dialog, shell } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { statSync } from 'fs'
import { and, eq, sql } from 'drizzle-orm'

// `@e965/xlsx` bajo ESM (vitest + electron-vite moderno) arranca con `_fs`
// undefined y `XLSX.writeFile`/`readFile` lanza "cannot save file". Inyectamos
// el módulo `fs` una vez al cargar este archivo. Idempotente: si excel-service
// ya lo inyectó, esta llamada solo lo reasigna sin efectos secundarios.
XLSX.set_fs(fs)

// `exceljs` se usa SOLO para escribir la plantilla con estilos (negrita,
// colores, padding). Para LEER seguimos con `@e965/xlsx` que es el fork
// hardened sin las CVE del xlsx legacy. Mejor de los dos mundos: escribir
// bonito + leer seguro.
import type { DB } from '../db'
import {
  configuracion,
  muestrasMarcos,
  preciosBastidores,
  preciosPaspartuAcrilico,
  preciosPaspartuPintado,
  preciosRetablos,
  preciosTapas,
  preciosVidrios,
  proveedores
} from '../db/schema'
import { setConfig, validarValorConfig } from '../db/queries/configuracion'

// ---------------------------------------------------------------------------
// Constantes y límites defensivos
// ---------------------------------------------------------------------------

const MAX_XLSX_BYTES = 15 * 1024 * 1024 // 15 MB — el dueño puede tener fotos pesadas en el Excel
const MAX_XLSX_ROWS = 10_000
const MAX_STR_LEN = 200
const MAX_COLILLA_CM = 500
const MAX_MEDIDA_CM = 500
const MAX_ESPESOR_MM = 50
const MAX_PRECIO = 1_000_000_000
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Whitelist de claves de configuración que la plantilla puede sobrescribir.
// Cualquier clave fuera de esta lista se ignora silenciosamente para evitar
// que un Excel malicioso o mal armado cambie flags internos del sistema.
const CLAVES_CONFIG_PERMITIDAS = new Set([
  'nombre_negocio',
  'rut',
  'telefono',
  'direccion',
  'correo',
  'precio_clase_mensual',
  'precio_kit_dibujo',
  'margen_minimo_alerta_pct',
  'porcentaje_materiales_default',
  'porcentaje_costo_materiales_armado_default',
  'tiempo_entrega_default',
  'dias_entrega_urgente',
  'dias_entrega_estandar',
  'dias_entrega_sin_afan'
])

// Nombres oficiales de las hojas. El parser los exige tal cual; si faltan o
// están mal escritos, la plantilla se rechaza (mejor fallar rápido que cargar
// datos parciales).
export const HOJAS = {
  README: 'README',
  NEGOCIO: 'Negocio',
  PROVEEDORES: 'Proveedores',
  MARCOS: 'Marcos',
  VIDRIOS: 'Vidrios',
  PASPARTU_PINTADO: 'Paspartu_Pintado',
  PASPARTU_ACRILICO: 'Paspartu_Acrilico',
  RETABLOS: 'Retablos',
  BASTIDORES: 'Bastidores',
  TAPAS: 'Tapas',
  CONFIGURACION: 'Configuracion'
} as const

// Marcadores en la primera celda de filas que deben ignorarse al parsear.
// Útil para que el papá vea ejemplos sin que se carguen como datos reales.
const MARCADOR_EJEMPLO = /^EJEMPLO/i

// ---------------------------------------------------------------------------
// Utilidades comunes
// ---------------------------------------------------------------------------

function sanitizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null)
  for (const [k, v] of Object.entries(raw)) {
    if (!FORBIDDEN_KEYS.has(k)) out[k] = v
  }
  return out
}

function trunc(s: unknown, max = MAX_STR_LEN): string {
  return String(s ?? '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // elimina control chars
    .trim()
    .slice(0, max)
}

/**
 * Convierte un valor de celda Excel a número. Acepta: número directo, string
 * con separador de miles ("47.000" o "47,000"), o vacío. Rechaza texto puro.
 */
function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).replace(/[\s$]/g, '').replace(/[.,](?=\d{3}(\D|$))/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function esFilaVacia(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || v === '')
}

function esFilaEjemplo(row: Record<string, unknown>): boolean {
  const primer = Object.values(row)[0]
  if (typeof primer === 'string' && MARCADOR_EJEMPLO.test(primer)) return true
  // Filas donde alguna celda dice "EJEMPLO"
  return Object.values(row).some(
    (v) => typeof v === 'string' && /^EJEMPLO\s*-?\s*BORRAR/i.test(v.trim())
  )
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosNegocio = {
  nombre: string
  rut: string
  telefono: string
  direccion: string
  correo: string | null
}

export type ProveedorRow = {
  nombre: string
  productos: string | null
  diasPedido: string | null
  formaPago: string | null
  telefono: string | null
  notas: string | null
}

export type MarcoRow = {
  referencia: string
  proveedor: string | null
  colillaCm: number
  precioMetro: number
  costoMetroEstimado: number | null
  descripcion: string | null
}

export type VidrioRow = {
  nombre: string
  espesorMm: number
  precioM2: number
  costoM2Estimado: number | null
}

export type MedidaPrecioRow = {
  anchoCm: number
  altoCm: number
  precio: number
  costoEstimado: number | null
}

export type ConfiguracionRow = {
  clave: string
  valor: string
}

export type PlantillaParsed = {
  negocio: DatosNegocio | null
  proveedores: ProveedorRow[]
  marcos: MarcoRow[]
  vidrios: VidrioRow[]
  paspartuPintado: MedidaPrecioRow[]
  paspartuAcrilico: MedidaPrecioRow[]
  retablos: MedidaPrecioRow[]
  bastidores: MedidaPrecioRow[]
  tapas: MedidaPrecioRow[]
  configuracion: ConfiguracionRow[]
}

export type ErrorPlantilla = {
  hoja: string
  fila: number // 1-based como en Excel (incluye encabezado en fila 1)
  campo?: string
  mensaje: string
}

export type ResultadoParseo = {
  ok: boolean
  datos: PlantillaParsed
  errores: ErrorPlantilla[]
  resumen: ResumenParseo
}

export type ResumenParseo = {
  negocio: number
  proveedores: number
  marcos: number
  vidrios: number
  paspartuPintado: number
  paspartuAcrilico: number
  retablos: number
  bastidores: number
  tapas: number
  configuracion: number
}

export type ModoCarga = 'upsert' | 'solo_agregar' | 'reemplazar'

export type ResultadoCarga = {
  modo: ModoCarga
  creados: ResumenParseo
  actualizados: ResumenParseo
  ignorados: ResumenParseo
}

// Helper para `@e965/xlsx`: setea anchos de columna en el formato esperado.
// Usado por `exportarComoPlantilla` que sigue usando xlsx para mantener
// código simple de exportación (sin estilos avanzados).
function setColWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map((w) => ({ wch: w }))
}

// ---------------------------------------------------------------------------
// FASE A: Generador de plantilla
// ---------------------------------------------------------------------------

// Paleta de colores y estilos consistentes para que todas las hojas se vean
// con la misma identidad visual (cabecera azul oscuro, ejemplos en gris,
// zebra-stripes en filas vacías).
const STYLE = {
  headerBg: 'FF2C3E50', // azul oscuro corporativo
  headerText: 'FFFFFFFF',
  titleBg: 'FFB45309', // naranja accent (igual al de la app)
  titleText: 'FFFFFFFF',
  exampleBg: 'FFFFF7E6', // crema suave para resaltar ejemplos
  exampleText: 'FF8B6F47',
  zebraBg: 'FFFAFAFA',
  borderColor: 'FFD4D4D4',
  hintBg: 'FFE7F5FF',
  hintText: 'FF1E40AF'
} as const

// Aplica estilo de encabezado (fila 1 de cada hoja).
function styleHeader(cell: ExcelJS.Cell): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.headerBg } }
  cell.font = { bold: true, color: { argb: STYLE.headerText }, size: 11, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: STYLE.borderColor } },
    bottom: { style: 'medium', color: { argb: STYLE.headerBg } },
    left: { style: 'thin', color: { argb: STYLE.borderColor } },
    right: { style: 'thin', color: { argb: STYLE.borderColor } }
  }
}

// Aplica estilo a filas marcadas como ejemplo (gris cursiva, fondo crema).
function styleExample(cell: ExcelJS.Cell): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.exampleBg } }
  cell.font = { italic: true, color: { argb: STYLE.exampleText }, size: 10 }
  cell.border = {
    top: { style: 'hair', color: { argb: STYLE.borderColor } },
    bottom: { style: 'hair', color: { argb: STYLE.borderColor } },
    left: { style: 'hair', color: { argb: STYLE.borderColor } },
    right: { style: 'hair', color: { argb: STYLE.borderColor } }
  }
}

// Aplica estilo a filas de zebra (alternadas) para mejor legibilidad.
function styleZebra(cell: ExcelJS.Cell, isAlternate: boolean): void {
  if (isAlternate) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.zebraBg } }
  }
  cell.border = {
    top: { style: 'hair', color: { argb: STYLE.borderColor } },
    bottom: { style: 'hair', color: { argb: STYLE.borderColor } },
    left: { style: 'hair', color: { argb: STYLE.borderColor } },
    right: { style: 'hair', color: { argb: STYLE.borderColor } }
  }
  cell.font = { size: 10, name: 'Calibri' }
}

// Construye una hoja de datos con encabezados estilizados, filas de ejemplo
// resaltadas y filas vacías con zebra. Comments opcionales en cada columna
// para que el dueño vea hint al pasar el mouse. El header va en fila 1
// porque el parser de @e965/xlsx asume que ahí está, así no rompemos la
// compatibilidad. El "título" de cada hoja vive en el nombre de la pestaña
// (que también es el nombre oficial usado por el parser).
function addDataSheet(
  wb: ExcelJS.Workbook,
  nombre: string,
  config: {
    headers: string[]
    headerHints?: (string | undefined)[]
    colWidths: number[]
    examples: (string | number | null)[][]
    emptyRows: number
    /** Color de tabPin (acento visual de la pestaña). */
    tabColor?: string
  }
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: config.tabColor ? { tabColor: { argb: config.tabColor } } : undefined
  })

  // Fila 1: encabezados con estilo
  const headerRow = ws.addRow(config.headers)
  headerRow.height = 28
  headerRow.eachCell((cell, colNumber) => {
    styleHeader(cell)
    if (config.headerHints && config.headerHints[colNumber - 1]) {
      cell.note = {
        texts: [{ text: config.headerHints[colNumber - 1] || '' }],
        margins: { insetmode: 'auto' }
      }
    }
  })

  // Anchos de columna
  config.colWidths.forEach((w, i) => {
    const col = ws.getColumn(i + 1)
    col.width = w
  })

  // Filas de ejemplo
  for (const ex of config.examples) {
    const row = ws.addRow(ex)
    row.height = 20
    row.eachCell((cell) => styleExample(cell))
  }

  // Filas vacías con zebra
  for (let i = 0; i < config.emptyRows; i++) {
    const row = ws.addRow(config.headers.map(() => null))
    row.height = 20
    for (let c = 1; c <= config.headers.length; c++) {
      const cell = row.getCell(c)
      styleZebra(cell, i % 2 === 1)
    }
  }

  // Auto-filtro sobre los encabezados para que el dueño pueda ordenar/filtrar
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: config.headers.length }
  }

  // Page setup para impresión
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, paperSize: 9 }
  ws.pageSetup.margins = {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3
  }

  return ws
}

// Construye la hoja README con formato rico (título grande, secciones,
// listas numeradas, fondo azul claro para tips).
function addReadmeSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet(HOJAS.README, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  })
  ws.getColumn(1).width = 110

  // Título grande
  ws.addRow(['📋 PLANTILLA CASA ALBERTO'])
  ws.mergeCells('A1:A1')
  const t = ws.getCell('A1')
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.titleBg } }
  t.font = { bold: true, size: 18, color: { argb: STYLE.titleText }, name: 'Calibri' }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 40

  ws.addRow([''])
  ws.addRow(['Esta plantilla sirve para cargar TODOS los datos del negocio en la app de una sola vez.'])
  styleSubtitle(ws.getCell('A3'))
  ws.addRow([''])

  // Sección "Cómo llenarla"
  addSectionHeader(ws, '📝 CÓMO LLENARLA')
  addBullet(ws, '1. Ve a cada hoja (las pestañas de abajo de la pantalla).')
  addBullet(ws, '2. Cada hoja tiene FILAS DE EJEMPLO marcadas con "EJEMPLO - BORRAR" en fondo crema.')
  addBullet(ws, '   Esas filas NO se cargan en la app — son solo para que veas el formato.')
  addBullet(ws, '   Bórralas o déjalas, da igual.')
  addBullet(ws, '3. Debajo de los ejemplos hay filas vacías. Allí escribe los datos reales.')
  addBullet(ws, '4. Si una hoja no aplica para tu negocio, déjala vacía. La app no rompe.')
  addBullet(ws, '5. Las columnas marcadas como "(opcional)" pueden quedar vacías.')
  ws.addRow([''])

  addSectionHeader(ws, '⚠️ REGLAS IMPORTANTES')
  addBullet(ws, '• NO cambies los nombres de las hojas (Negocio, Proveedores, Marcos, etc.).')
  addBullet(ws, '• NO cambies los encabezados de las columnas (la fila azul de cada hoja).')
  addBullet(ws, '• Los precios van SIN signo $ y SIN puntos. Ejemplo: 47000 (no $47.000)')
  addBullet(ws, '• Las medidas en centímetros sin texto. Ejemplo: 30 (no "30 cm")')
  addBullet(ws, '• Si la app encuentra un error, te muestra exactamente la hoja y fila — no se carga nada hasta que esté todo correcto.')
  ws.addRow([''])

  addSectionHeader(ws, '📚 ORDEN RECOMENDADO')
  addBullet(ws, '1. Negocio (datos para la factura)')
  addBullet(ws, '2. Proveedores (necesario antes de los marcos)')
  addBullet(ws, '3. Marcos (la lista más larga — suele tener 10-30 muestras)')
  addBullet(ws, '4. Vidrios')
  addBullet(ws, '5. Paspartú pintado y acrílico')
  addBullet(ws, '6. Retablos, bastidores, tapas')
  addBullet(ws, '7. Configuración (precios de clase, kit, margen mínimo)')
  ws.addRow([''])

  addSectionHeader(ws, '💡 TIPS')
  addTip(
    ws,
    'Si al subir la plantilla aparecen errores, no te preocupes — la app te dice exactamente qué fila tiene problema. Corrígelo y vuelve a subir.'
  )
  addTip(
    ws,
    'Puedes usar la opción "Actualizar y agregar" todas las veces que quieras. Si subes nuevamente cambiando precios, los actualiza sin duplicar.'
  )
  addTip(
    ws,
    'En los precios y costos opcionales: si no los sabes, déjalos vacíos. La app funciona igual; solo no calculará el margen estimado en los pedidos.'
  )
  ws.addRow([''])
  ws.addRow(['Si tienes dudas, llama a Daniel.'])
  styleSubtitle(ws.getCell(`A${ws.rowCount}`))
}

function styleSubtitle(cell: ExcelJS.Cell): void {
  cell.font = { size: 11, color: { argb: 'FF555555' }, italic: true, name: 'Calibri' }
}

function addSectionHeader(ws: ExcelJS.Worksheet, text: string): void {
  const row = ws.addRow([text])
  row.height = 24
  const cell = ws.getCell(`A${ws.rowCount}`)
  cell.font = { bold: true, size: 13, color: { argb: STYLE.headerBg }, name: 'Calibri' }
  cell.alignment = { vertical: 'middle' }
  cell.border = {
    bottom: { style: 'medium', color: { argb: STYLE.titleBg } }
  }
}

function addBullet(ws: ExcelJS.Worksheet, text: string): void {
  const row = ws.addRow([text])
  row.height = 18
  const cell = ws.getCell(`A${ws.rowCount}`)
  cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF333333' } }
  cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
}

function addTip(ws: ExcelJS.Worksheet, text: string): void {
  const row = ws.addRow([text])
  row.height = 30
  const cell = ws.getCell(`A${ws.rowCount}`)
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE.hintBg } }
  cell.font = { size: 11, color: { argb: STYLE.hintText }, italic: true, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
  cell.border = {
    left: { style: 'thick', color: { argb: STYLE.hintText } }
  }
}

/**
 * Genera la plantilla Excel con estilos completos: títulos grandes con
 * fondo accent, encabezados con fondo oscuro y negrillas, filas de ejemplo
 * resaltadas en crema, zebra-stripes para legibilidad, frozen panes para
 * que el header siempre se vea, comentarios con hints en cada columna y
 * auto-filter en los encabezados.
 *
 * Devuelve la ruta del archivo creado en Downloads.
 */
export async function generarPlantilla(): Promise<string> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Casa Alberto App'
  wb.lastModifiedBy = 'Casa Alberto App'
  wb.created = new Date()
  wb.modified = new Date()

  // ---- README ----
  addReadmeSheet(wb)

  // ---- 1. Negocio ----
  addDataSheet(wb, HOJAS.NEGOCIO, {
    tabColor: 'FF2C3E50',
    headers: ['Nombre', 'NIT', 'Telefono', 'Direccion', 'Correo'],
    headerHints: [
      'Nombre que aparece en la factura (Casa Alberto)',
      'NIT o cédula con la que facturas',
      'Teléfono del local',
      'Dirección del local',
      'Correo electrónico (opcional)'
    ],
    colWidths: [28, 22, 22, 35, 28],
    examples: [['EJEMPLO - BORRAR', '1.234.567.890', '+57 320 000 0000', 'Cra 00 # 00 - 00', 'opcional']],
    emptyRows: 2
  })

  // ---- 2. Proveedores ----
  addDataSheet(wb, HOJAS.PROVEEDORES, {
    tabColor: 'FF2C3E50',
    headers: ['Nombre', 'Productos', 'Dias_pedido', 'Forma_pago', 'Telefono', 'Notas'],
    headerHints: [
      'Nombre del proveedor (ej: Alperto, Edimol, Homecenter)',
      'Qué le compras (Marcos, Vidrios, MDF, etc.)',
      'Días en que pides (lunes,miercoles)',
      'Forma de pago (Contra entrega, Contado, etc.)',
      'Teléfono de contacto',
      'Notas opcionales'
    ],
    colWidths: [20, 28, 20, 20, 18, 30],
    examples: [
      [
        'EJEMPLO - BORRAR',
        'Marcos a medida',
        'lunes,miercoles',
        'Contra entrega',
        '3101234567',
        'Proveedor principal'
      ],
      ['Alperto', 'Marcos a medida', 'lunes,miercoles', 'Contra entrega', '', ''],
      ['Edimol', 'Marcos a medida', 'lunes,miercoles', 'Contra entrega', '', ''],
      ['Homecenter', 'MDF y carton', 'cuando se agota', 'Contado', '', '']
    ],
    emptyRows: 6
  })

  // ---- 3. Marcos ----
  addDataSheet(wb, HOJAS.MARCOS, {
    tabColor: 'FFB45309',
    headers: ['Referencia', 'Proveedor', 'Colilla_cm', 'Precio_metro', 'Costo_metro', 'Descripcion'],
    headerHints: [
      'Código único del marco (ej: K473, M-100)',
      'Nombre del proveedor (debe estar en hoja Proveedores)',
      'Desperdicio total de la muestra en cm (ej: 48)',
      'Precio que cobras al cliente por metro lineal',
      'Lo que le pagas al proveedor por metro (opcional)',
      'Descripción visual (Roble oscuro, etc.)'
    ],
    colWidths: [18, 18, 14, 18, 18, 35],
    examples: [
      ['EJEMPLO - BORRAR', 'Alperto', 48, 47000, 30000, 'Marco roble oscuro'],
      ['EJEMPLO - BORRAR', 'Edimol', 32, 28000, null, 'Marco negro mate (sin costo es OK)']
    ],
    emptyRows: 30
  })

  // ---- 4. Vidrios ----
  addDataSheet(wb, HOJAS.VIDRIOS, {
    tabColor: 'FFB45309',
    headers: ['Nombre', 'Espesor_mm', 'Precio_m2', 'Costo_m2'],
    headerHints: [
      'Nombre del vidrio (Vidrio claro, Antirreflectivo, Espejo, etc.)',
      'Espesor en milímetros (2, 3, 4, 6)',
      'Precio por metro cuadrado al cliente',
      'Costo por metro cuadrado para ti (opcional)'
    ],
    colWidths: [28, 14, 18, 18],
    examples: [
      ['EJEMPLO - BORRAR', 2, 100000, 60000],
      ['Vidrio claro', 2, 100000, null],
      ['Vidrio claro', 3, 110000, null],
      ['Antirreflectivo', 2, 115000, null]
    ],
    emptyRows: 6
  })

  // ---- 5-9. Tablas medida×precio (mismo formato) ----
  const headersMedida = ['Ancho_cm', 'Alto_cm', 'Precio', 'Costo']
  const hintsMedida = [
    'Ancho en centímetros (sin texto, solo número)',
    'Alto en centímetros',
    'Precio que cobras al cliente',
    'Costo opcional para calcular margen'
  ]
  const widthsMedida = [14, 14, 18, 18]

  addDataSheet(wb, HOJAS.PASPARTU_PINTADO, {
    tabColor: 'FF059669',
    headers: headersMedida,
    headerHints: hintsMedida,
    colWidths: widthsMedida,
    examples: [
      ['EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR'],
      [30, 40, 12000, 7000],
      [40, 50, 18000, 10500],
      [50, 70, 25000, 15000],
      [70, 100, 38000, 24000]
    ],
    emptyRows: 6
  })

  addDataSheet(wb, HOJAS.PASPARTU_ACRILICO, {
    tabColor: 'FF059669',
    headers: headersMedida,
    headerHints: hintsMedida,
    colWidths: widthsMedida,
    examples: [
      ['EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR'],
      [30, 40, 17000, 10000],
      [40, 50, 25000, 15000],
      [50, 70, 35000, 22000],
      [70, 100, 52000, 33000]
    ],
    emptyRows: 6
  })

  addDataSheet(wb, HOJAS.RETABLOS, {
    tabColor: 'FF7C3AED',
    headers: headersMedida,
    headerHints: hintsMedida,
    colWidths: widthsMedida,
    examples: [
      ['EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR'],
      [20, 30, 18000, null],
      [30, 40, 28000, null],
      [40, 60, 45000, null],
      [60, 80, 75000, null]
    ],
    emptyRows: 6
  })

  addDataSheet(wb, HOJAS.BASTIDORES, {
    tabColor: 'FF7C3AED',
    headers: headersMedida,
    headerHints: hintsMedida,
    colWidths: widthsMedida,
    examples: [
      ['EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR'],
      [30, 40, 22000, null],
      [40, 60, 38000, null],
      [60, 80, 58000, null],
      [80, 100, 85000, null]
    ],
    emptyRows: 6
  })

  addDataSheet(wb, HOJAS.TAPAS, {
    tabColor: 'FF7C3AED',
    headers: headersMedida,
    headerHints: hintsMedida,
    colWidths: widthsMedida,
    examples: [
      ['EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR', 'EJEMPLO - BORRAR'],
      [30, 40, 12000, null],
      [40, 60, 20000, null],
      [60, 80, 32000, null]
    ],
    emptyRows: 6
  })

  // ---- 10. Configuración ----
  addDataSheet(wb, HOJAS.CONFIGURACION, {
    tabColor: 'FF6B7280',
    headers: ['Clave', 'Valor', 'Descripcion'],
    headerHints: [
      'Clave técnica (NO inventar — solo las predefinidas)',
      'Valor numérico o texto',
      'Descripción para tu referencia'
    ],
    colWidths: [38, 15, 65],
    examples: [
      ['EJEMPLO - BORRAR', '0', 'Borra esta fila'],
      ['precio_clase_mensual', '110000', 'Cuanto cobras al mes una clase de dibujo'],
      ['precio_kit_dibujo', '15000', 'Precio del kit que vendes a los estudiantes'],
      ['margen_minimo_alerta_pct', '20', 'Por debajo de que % de margen estimado debe alertarte la app'],
      ['porcentaje_materiales_default', '10', 'Porcentaje materiales adicionales (5-10)']
    ],
    emptyRows: 3
  })

  // Guardado
  const fecha = new Date().toISOString().slice(0, 10)
  const filePath = join(app.getPath('downloads'), `Plantilla-CasaAlberto-${fecha}.xlsx`)
  await wb.xlsx.writeFile(filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// FASE B: Parser unificado
// ---------------------------------------------------------------------------

/**
 * Lee el xlsx y devuelve la estructura parseada + lista de errores. NO toca
 * la DB. Si hay errores, `ok: false` y la UI puede mostrar el detalle al usuario.
 */
export function parsearPlantilla(filePath: string): ResultadoParseo {
  const stats = statSync(filePath)
  if (stats.size > MAX_XLSX_BYTES) {
    return {
      ok: false,
      datos: emptyParsed(),
      errores: [
        {
          hoja: '*',
          fila: 0,
          mensaje: `El archivo supera 15 MB (pesa ${Math.round(stats.size / 1024 / 1024)} MB). Divídelo o comprime.`
        }
      ],
      resumen: emptyResumen()
    }
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.readFile(filePath)
  } catch (err) {
    return {
      ok: false,
      datos: emptyParsed(),
      errores: [
        {
          hoja: '*',
          fila: 0,
          mensaje: `No se pudo leer el archivo Excel: ${err instanceof Error ? err.message : 'formato inválido'}`
        }
      ],
      resumen: emptyResumen()
    }
  }

  const errores: ErrorPlantilla[] = []
  const datos: PlantillaParsed = emptyParsed()

  const hojasFaltantes = Object.values(HOJAS).filter(
    (h) => h !== HOJAS.README && !wb.Sheets[h]
  )
  if (hojasFaltantes.length > 0) {
    errores.push({
      hoja: '*',
      fila: 0,
      mensaje: `La plantilla no contiene las hojas: ${hojasFaltantes.join(', ')}. Usa la plantilla oficial de la app.`
    })
    return { ok: false, datos, errores, resumen: emptyResumen() }
  }

  parseNegocio(wb, datos, errores)
  parseProveedores(wb, datos, errores)
  parseMarcos(wb, datos, errores)
  parseVidrios(wb, datos, errores)
  parseMedidas(wb, HOJAS.PASPARTU_PINTADO, datos.paspartuPintado, errores)
  parseMedidas(wb, HOJAS.PASPARTU_ACRILICO, datos.paspartuAcrilico, errores)
  parseMedidas(wb, HOJAS.RETABLOS, datos.retablos, errores)
  parseMedidas(wb, HOJAS.BASTIDORES, datos.bastidores, errores)
  parseMedidas(wb, HOJAS.TAPAS, datos.tapas, errores)
  parseConfiguracion(wb, datos, errores)

  // Validación cruzada: cada marco debe apuntar a un proveedor declarado en la
  // hoja Proveedores. El backend resolverá el ID por nombre al cargar.
  const provNames = new Set(datos.proveedores.map((p) => p.nombre.toLowerCase()))
  for (let i = 0; i < datos.marcos.length; i++) {
    const m = datos.marcos[i]
    if (m.proveedor && !provNames.has(m.proveedor.toLowerCase())) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2, // +2: encabezado + 1-based
        campo: 'Proveedor',
        mensaje: `Proveedor "${m.proveedor}" no está en la hoja Proveedores. Agrégalo o deja la celda vacía.`
      })
    }
  }

  return {
    ok: errores.length === 0,
    datos,
    errores,
    resumen: contarResumen(datos)
  }
}

function emptyParsed(): PlantillaParsed {
  return {
    negocio: null,
    proveedores: [],
    marcos: [],
    vidrios: [],
    paspartuPintado: [],
    paspartuAcrilico: [],
    retablos: [],
    bastidores: [],
    tapas: [],
    configuracion: []
  }
}

function emptyResumen(): ResumenParseo {
  return {
    negocio: 0,
    proveedores: 0,
    marcos: 0,
    vidrios: 0,
    paspartuPintado: 0,
    paspartuAcrilico: 0,
    retablos: 0,
    bastidores: 0,
    tapas: 0,
    configuracion: 0
  }
}

function contarResumen(datos: PlantillaParsed): ResumenParseo {
  return {
    negocio: datos.negocio ? 1 : 0,
    proveedores: datos.proveedores.length,
    marcos: datos.marcos.length,
    vidrios: datos.vidrios.length,
    paspartuPintado: datos.paspartuPintado.length,
    paspartuAcrilico: datos.paspartuAcrilico.length,
    retablos: datos.retablos.length,
    bastidores: datos.bastidores.length,
    tapas: datos.tapas.length,
    configuracion: datos.configuracion.length
  }
}

function leerHoja(wb: XLSX.WorkBook, nombre: string): Record<string, unknown>[] {
  const ws = wb.Sheets[nombre]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
  if (rows.length > MAX_XLSX_ROWS) {
    throw new Error(`La hoja ${nombre} tiene ${rows.length} filas (máximo ${MAX_XLSX_ROWS}).`)
  }
  return rows.map(sanitizeRow)
}

function parseNegocio(
  wb: XLSX.WorkBook,
  datos: PlantillaParsed,
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, HOJAS.NEGOCIO)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const nombre = trunc(row['Nombre'])
    if (!nombre) {
      errores.push({
        hoja: HOJAS.NEGOCIO,
        fila: i + 2,
        campo: 'Nombre',
        mensaje: 'El nombre del negocio es obligatorio'
      })
      continue
    }
    const negocio: DatosNegocio = {
      nombre,
      rut: trunc(row['NIT'] ?? row['Nit'] ?? row['Rut']),
      telefono: trunc(row['Telefono']),
      direccion: trunc(row['Direccion']),
      correo: trunc(row['Correo']) || null
    }
    if (datos.negocio) {
      errores.push({
        hoja: HOJAS.NEGOCIO,
        fila: i + 2,
        mensaje: 'Solo puede haber una fila con datos del negocio. Borra las demás.'
      })
      continue
    }
    datos.negocio = negocio
  }
}

function parseProveedores(
  wb: XLSX.WorkBook,
  datos: PlantillaParsed,
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, HOJAS.PROVEEDORES)
  const vistos = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const nombre = trunc(row['Nombre'])
    if (!nombre) {
      errores.push({
        hoja: HOJAS.PROVEEDORES,
        fila: i + 2,
        campo: 'Nombre',
        mensaje: 'El nombre del proveedor es obligatorio'
      })
      continue
    }
    const key = nombre.toLowerCase()
    if (vistos.has(key)) {
      errores.push({
        hoja: HOJAS.PROVEEDORES,
        fila: i + 2,
        campo: 'Nombre',
        mensaje: `Proveedor "${nombre}" duplicado en la plantilla`
      })
      continue
    }
    vistos.add(key)
    datos.proveedores.push({
      nombre,
      productos: trunc(row['Productos']) || null,
      diasPedido: trunc(row['Dias_pedido'] ?? row['DiasPedido']) || null,
      formaPago: trunc(row['Forma_pago'] ?? row['FormaPago']) || null,
      telefono: trunc(row['Telefono']) || null,
      notas: trunc(row['Notas']) || null
    })
  }
}

function parseMarcos(
  wb: XLSX.WorkBook,
  datos: PlantillaParsed,
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, HOJAS.MARCOS)
  const vistos = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const referencia = trunc(row['Referencia'])
    if (!referencia) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2,
        campo: 'Referencia',
        mensaje: 'La referencia del marco es obligatoria'
      })
      continue
    }
    const key = referencia.toLowerCase()
    if (vistos.has(key)) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2,
        campo: 'Referencia',
        mensaje: `Referencia "${referencia}" duplicada en la plantilla`
      })
      continue
    }
    vistos.add(key)

    const colilla = parseNum(row['Colilla_cm'] ?? row['ColillaCm'] ?? row['Colilla'])
    const precio = parseNum(row['Precio_metro'] ?? row['PrecioMetro'] ?? row['Precio'])
    const costo = parseNum(row['Costo_metro'] ?? row['CostoMetro'] ?? row['Costo'])

    if (colilla === null || colilla <= 0 || colilla > MAX_COLILLA_CM) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2,
        campo: 'Colilla_cm',
        mensaje: `Colilla inválida (debe ser entre 0 y ${MAX_COLILLA_CM} cm)`
      })
      continue
    }
    if (precio === null || precio <= 0 || precio > MAX_PRECIO) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2,
        campo: 'Precio_metro',
        mensaje: 'Precio por metro inválido (debe ser mayor a 0)'
      })
      continue
    }
    if (costo !== null && (costo < 0 || costo > MAX_PRECIO)) {
      errores.push({
        hoja: HOJAS.MARCOS,
        fila: i + 2,
        campo: 'Costo_metro',
        mensaje: 'Costo inválido (no puede ser negativo)'
      })
      continue
    }

    datos.marcos.push({
      referencia,
      proveedor: trunc(row['Proveedor']) || null,
      colillaCm: colilla,
      precioMetro: precio,
      costoMetroEstimado: costo,
      descripcion: trunc(row['Descripcion']) || null
    })
  }
}

function parseVidrios(
  wb: XLSX.WorkBook,
  datos: PlantillaParsed,
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, HOJAS.VIDRIOS)
  const vistos = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const nombre = trunc(row['Nombre'])
    if (!nombre) {
      errores.push({
        hoja: HOJAS.VIDRIOS,
        fila: i + 2,
        campo: 'Nombre',
        mensaje: 'El nombre del vidrio es obligatorio'
      })
      continue
    }
    const espesor = parseNum(row['Espesor_mm'] ?? row['Espesor'])
    if (espesor === null || espesor <= 0 || espesor > MAX_ESPESOR_MM) {
      errores.push({
        hoja: HOJAS.VIDRIOS,
        fila: i + 2,
        campo: 'Espesor_mm',
        mensaje: `Espesor inválido (debe ser entre 0 y ${MAX_ESPESOR_MM} mm)`
      })
      continue
    }
    const precio = parseNum(row['Precio_m2'] ?? row['PrecioM2'] ?? row['Precio'])
    if (precio === null || precio <= 0 || precio > MAX_PRECIO) {
      errores.push({
        hoja: HOJAS.VIDRIOS,
        fila: i + 2,
        campo: 'Precio_m2',
        mensaje: 'Precio por m² inválido (debe ser mayor a 0)'
      })
      continue
    }
    const costo = parseNum(row['Costo_m2'] ?? row['CostoM2'] ?? row['Costo'])
    if (costo !== null && (costo < 0 || costo > MAX_PRECIO)) {
      errores.push({
        hoja: HOJAS.VIDRIOS,
        fila: i + 2,
        campo: 'Costo_m2',
        mensaje: 'Costo inválido (no puede ser negativo)'
      })
      continue
    }
    const key = `${nombre.toLowerCase()}|${espesor}`
    if (vistos.has(key)) {
      errores.push({
        hoja: HOJAS.VIDRIOS,
        fila: i + 2,
        mensaje: `Vidrio "${nombre} ${espesor}mm" duplicado en la plantilla`
      })
      continue
    }
    vistos.add(key)

    datos.vidrios.push({
      nombre,
      espesorMm: espesor,
      precioM2: precio,
      costoM2Estimado: costo
    })
  }
}

function parseMedidas(
  wb: XLSX.WorkBook,
  hoja: string,
  destino: MedidaPrecioRow[],
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, hoja)
  const vistos = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const ancho = parseNum(row['Ancho_cm'] ?? row['AnchoCm'] ?? row['Ancho'])
    const alto = parseNum(row['Alto_cm'] ?? row['AltoCm'] ?? row['Alto'])
    const precio = parseNum(row['Precio'] ?? row['Precio_cliente'])
    const costo = parseNum(row['Costo'] ?? row['Costo_estimado'])
    if (ancho === null || ancho <= 0 || ancho > MAX_MEDIDA_CM) {
      errores.push({
        hoja,
        fila: i + 2,
        campo: 'Ancho_cm',
        mensaje: 'Ancho inválido'
      })
      continue
    }
    if (alto === null || alto <= 0 || alto > MAX_MEDIDA_CM) {
      errores.push({
        hoja,
        fila: i + 2,
        campo: 'Alto_cm',
        mensaje: 'Alto inválido'
      })
      continue
    }
    if (precio === null || precio <= 0 || precio > MAX_PRECIO) {
      errores.push({
        hoja,
        fila: i + 2,
        campo: 'Precio',
        mensaje: 'Precio inválido'
      })
      continue
    }
    if (costo !== null && (costo < 0 || costo > MAX_PRECIO)) {
      errores.push({
        hoja,
        fila: i + 2,
        campo: 'Costo',
        mensaje: 'Costo inválido (no puede ser negativo)'
      })
      continue
    }
    const key = `${ancho}|${alto}`
    if (vistos.has(key)) {
      errores.push({
        hoja,
        fila: i + 2,
        mensaje: `Medida ${ancho}x${alto} duplicada en la plantilla`
      })
      continue
    }
    vistos.add(key)
    destino.push({ anchoCm: ancho, altoCm: alto, precio, costoEstimado: costo })
  }
}

function parseConfiguracion(
  wb: XLSX.WorkBook,
  datos: PlantillaParsed,
  errores: ErrorPlantilla[]
): void {
  const rows = leerHoja(wb, HOJAS.CONFIGURACION)
  const vistos = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (esFilaVacia(row) || esFilaEjemplo(row)) continue
    const clave = trunc(row['Clave'])
    if (!clave) continue
    if (!CLAVES_CONFIG_PERMITIDAS.has(clave)) {
      errores.push({
        hoja: HOJAS.CONFIGURACION,
        fila: i + 2,
        campo: 'Clave',
        mensaje: `Clave "${clave}" no es válida. Solo se permiten claves predefinidas (no las inventes).`
      })
      continue
    }
    if (vistos.has(clave)) {
      errores.push({
        hoja: HOJAS.CONFIGURACION,
        fila: i + 2,
        mensaje: `Clave "${clave}" duplicada en la plantilla`
      })
      continue
    }
    vistos.add(clave)
    const valor = trunc(row['Valor'])
    if (!valor) {
      errores.push({
        hoja: HOJAS.CONFIGURACION,
        fila: i + 2,
        campo: 'Valor',
        mensaje: `La configuración "${clave}" no tiene valor`
      })
      continue
    }
    // Validación de dominio compartida con `setConfig` vía SPEC_NUMERICAS
    // (ver db/queries/configuracion.ts). Antes esta validación estaba
    // duplicada inline acá con rangos hard-coded — el informe de
    // seguridad sobre 7f37f5b mostró que esa duplicación dejaba 4 claves
    // de días sin validar. Ahora cualquier clave nueva agregada a la spec
    // queda automáticamente validada en ambos paths (Excel + IPC).
    //
    // Claves no-numéricas (nombre_negocio, rut, telefono, etc.) pasan
    // `validarValorConfig` sin chequeo de rango — la sanitización de
    // longitud ya la hace `trunc(MAX_STR_LEN=200)` arriba.
    const validacion = validarValorConfig(clave, valor)
    if (!validacion.ok) {
      errores.push({
        hoja: HOJAS.CONFIGURACION,
        fila: i + 2,
        campo: 'Valor',
        mensaje: validacion.error
      })
      continue
    }
    datos.configuracion.push({ clave, valor })
  }
}

// ---------------------------------------------------------------------------
// FASE C: Cargador transaccional
// ---------------------------------------------------------------------------

function buildTipoVidrio(nombre: string, espesorMm: number): string {
  const base = nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^vidrio[\s_-]+/i, '')
    .replace(/\s*\d+(\.\d+)?\s*mm.*$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const espesor = String(espesorMm).replace(/\.0$/, '')
  return `${base}_${espesor}mm`
}

/**
 * Inserta los datos parseados en una transacción atómica. Si cualquier paso
 * falla, rollback completo y la DB queda intacta.
 */
export function cargarPlantilla(
  db: DB,
  parsed: PlantillaParsed,
  modo: ModoCarga = 'upsert'
): ResultadoCarga {
  return db.transaction((tx) => {
    const creados = emptyResumen()
    const actualizados = emptyResumen()
    const ignorados = emptyResumen()

    if (modo === 'reemplazar') {
      // Borra TODAS las listas + proveedores + config (excepto consecutivos y onboarding)
      tx.run(sql`DELETE FROM muestras_marcos`)
      tx.run(sql`DELETE FROM precios_vidrios`)
      tx.run(sql`DELETE FROM precios_paspartu_pintado`)
      tx.run(sql`DELETE FROM precios_paspartu_acrilico`)
      tx.run(sql`DELETE FROM precios_retablos`)
      tx.run(sql`DELETE FROM precios_bastidores`)
      tx.run(sql`DELETE FROM precios_tapas`)
      tx.run(sql`DELETE FROM proveedores`)
    }

    // 1. Configuración (siempre upsert por clave)
    //
    // IMPORTANTE — el bug del informe sobre 7f37f5b mostró que escribir
    // directamente con tx.insert/update bypasseaba `setConfig` y su
    // validación de dominio. Resultado: un Excel malformado podía persistir
    // dias_entrega_urgente=-2, generando fechas en el pasado y rompiendo el
    // form. Ahora TODO write pasa por `setConfig(tx, ...)` que valida contra
    // SPEC_NUMERICAS. Si una clave numérica tiene valor inválido, setConfig
    // lanza, la transacción se aborta y nada se persiste.
    //
    // El error se propaga al caller del IPC y la UI lo muestra; preferimos
    // perder un import completo a aceptar parcialmente data corrupta.
    const setConfigEnTx = (clave: string, valor: string): void => {
      try {
        setConfig(tx as unknown as DB, clave, valor)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Configuración inválida en "${clave}": ${msg}`)
      }
    }

    if (parsed.negocio) {
      const negocio = parsed.negocio
      setConfigEnTx('nombre_negocio', negocio.nombre)
      setConfigEnTx('rut', negocio.rut)
      setConfigEnTx('telefono', negocio.telefono)
      setConfigEnTx('direccion', negocio.direccion)
      if (negocio.correo) setConfigEnTx('correo', negocio.correo)
      // Marca onboarding como completado al cargar negocio desde plantilla
      setConfigEnTx('onboarding_completed', '1')
      creados.negocio = 1
    }

    for (const c of parsed.configuracion) {
      const existing = tx
        .select()
        .from(configuracion)
        .where(eq(configuracion.clave, c.clave))
        .get()
      if (existing) {
        if (modo === 'solo_agregar') {
          ignorados.configuracion += 1
          continue
        }
        setConfigEnTx(c.clave, c.valor)
        actualizados.configuracion += 1
      } else {
        setConfigEnTx(c.clave, c.valor)
        creados.configuracion += 1
      }
    }

    // 2. Proveedores (upsert por nombre)
    const provIdsByName = new Map<string, number>()
    for (const p of parsed.proveedores) {
      const existing = tx
        .select()
        .from(proveedores)
        .where(eq(proveedores.nombre, p.nombre))
        .get()
      if (existing) {
        if (modo === 'solo_agregar') {
          ignorados.proveedores += 1
          provIdsByName.set(p.nombre.toLowerCase(), existing.id)
          continue
        }
        tx.update(proveedores)
          .set({
            producto: p.productos,
            tipo: 'marco',
            telefono: p.telefono,
            diasPedido: p.diasPedido,
            formaPago: p.formaPago,
            formaEntrega: 'En el local',
            notas: p.notas,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(proveedores.id, existing.id))
          .run()
        provIdsByName.set(p.nombre.toLowerCase(), existing.id)
        actualizados.proveedores += 1
      } else {
        const inserted = tx
          .insert(proveedores)
          .values({
            nombre: p.nombre,
            producto: p.productos,
            tipo: 'marco',
            telefono: p.telefono,
            diasPedido: p.diasPedido,
            formaPago: p.formaPago,
            formaEntrega: 'En el local',
            notas: p.notas
          })
          .returning()
          .get()
        provIdsByName.set(p.nombre.toLowerCase(), inserted.id)
        creados.proveedores += 1
      }
    }

    // 3. Marcos (upsert por referencia, vinculan a proveedor por nombre)
    for (const m of parsed.marcos) {
      const proveedorId = m.proveedor
        ? (provIdsByName.get(m.proveedor.toLowerCase()) ?? null)
        : null
      const existing = tx
        .select()
        .from(muestrasMarcos)
        .where(eq(muestrasMarcos.referencia, m.referencia))
        .get()
      if (existing) {
        if (modo === 'solo_agregar') {
          ignorados.marcos += 1
          continue
        }
        tx.update(muestrasMarcos)
          .set({
            colillaCm: m.colillaCm,
            precioMetro: m.precioMetro,
            costoMetroEstimado: m.costoMetroEstimado,
            descripcion: m.descripcion,
            proveedorId,
            activo: true,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(muestrasMarcos.id, existing.id))
          .run()
        actualizados.marcos += 1
      } else {
        tx.insert(muestrasMarcos)
          .values({
            referencia: m.referencia,
            colillaCm: m.colillaCm,
            precioMetro: m.precioMetro,
            costoMetroEstimado: m.costoMetroEstimado,
            descripcion: m.descripcion,
            proveedorId
          })
          .run()
        creados.marcos += 1
      }
    }

    // 4. Vidrios (upsert por tipo derivado de nombre+espesor)
    for (const v of parsed.vidrios) {
      const tipo = buildTipoVidrio(v.nombre, v.espesorMm)
      const existing = tx
        .select()
        .from(preciosVidrios)
        .where(eq(preciosVidrios.tipo, tipo))
        .get()
      if (existing) {
        if (modo === 'solo_agregar') {
          ignorados.vidrios += 1
          continue
        }
        tx.update(preciosVidrios)
          .set({
            nombre: v.nombre,
            espesorMm: v.espesorMm,
            precioM2: v.precioM2,
            costoM2Estimado: v.costoM2Estimado,
            activo: true,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(preciosVidrios.id, existing.id))
          .run()
        actualizados.vidrios += 1
      } else {
        tx.insert(preciosVidrios)
          .values({
            tipo,
            nombre: v.nombre,
            espesorMm: v.espesorMm,
            precioM2: v.precioM2,
            costoM2Estimado: v.costoM2Estimado
          })
          .run()
        creados.vidrios += 1
      }
    }

    // 5-9. Tablas medida×precio
    cargarMedidas(
      tx,
      preciosPaspartuPintado,
      parsed.paspartuPintado,
      modo,
      creados,
      actualizados,
      ignorados,
      'paspartuPintado'
    )
    cargarMedidas(
      tx,
      preciosPaspartuAcrilico,
      parsed.paspartuAcrilico,
      modo,
      creados,
      actualizados,
      ignorados,
      'paspartuAcrilico'
    )
    cargarMedidas(
      tx,
      preciosRetablos,
      parsed.retablos,
      modo,
      creados,
      actualizados,
      ignorados,
      'retablos'
    )
    cargarMedidas(
      tx,
      preciosBastidores,
      parsed.bastidores,
      modo,
      creados,
      actualizados,
      ignorados,
      'bastidores'
    )
    cargarMedidas(
      tx,
      preciosTapas,
      parsed.tapas,
      modo,
      creados,
      actualizados,
      ignorados,
      'tapas'
    )

    return { modo, creados, actualizados, ignorados }
  })
}

type MedidaTabla =
  | typeof preciosPaspartuPintado
  | typeof preciosPaspartuAcrilico
  | typeof preciosRetablos
  | typeof preciosBastidores
  | typeof preciosTapas

type ResumenKey =
  | 'paspartuPintado'
  | 'paspartuAcrilico'
  | 'retablos'
  | 'bastidores'
  | 'tapas'

function cargarMedidas(
  tx: { insert: DB['insert']; update: DB['update']; select: DB['select'] },
  tabla: MedidaTabla,
  filas: MedidaPrecioRow[],
  modo: ModoCarga,
  creados: ResumenParseo,
  actualizados: ResumenParseo,
  ignorados: ResumenParseo,
  resumenKey: ResumenKey
): void {
  for (const f of filas) {
    const existing = tx
      .select()
      .from(tabla)
      .where(and(eq(tabla.anchoCm, f.anchoCm), eq(tabla.altoCm, f.altoCm)))
      .get()
    if (existing) {
      if (modo === 'solo_agregar') {
        ignorados[resumenKey] += 1
        continue
      }
      tx.update(tabla)
        .set({
          precio: f.precio,
          costoEstimado: f.costoEstimado,
          activo: true,
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(tabla.id, existing.id))
        .run()
      actualizados[resumenKey] += 1
    } else {
      tx.insert(tabla)
        .values({
          anchoCm: f.anchoCm,
          altoCm: f.altoCm,
          precio: f.precio,
          costoEstimado: f.costoEstimado
        })
        .run()
      creados[resumenKey] += 1
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers exportados para tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Exportador: vuelca la DB actual al formato de plantilla
// ---------------------------------------------------------------------------

/**
 * Genera un xlsx con TODAS las listas de precios + proveedores + datos del
 * negocio + configuración en el MISMO formato que la plantilla. Útil como:
 *   1. Backup manual de la configuración del negocio
 *   2. Punto de partida para "ajustar precios" — el dueño abre el archivo,
 *      cambia los números y lo vuelve a subir (upsert) sin reescribir todo
 *
 * No incluye filas EJEMPLO porque viene con datos reales.
 */
export function exportarComoPlantilla(db: DB): string {
  const wb = XLSX.utils.book_new()

  // README — versión corta para indicar que es export, no template
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['📋 EXPORT CASA ALBERTO — ' + new Date().toLocaleDateString('es-CO')],
      [''],
      ['Este archivo contiene toda la configuración actual del negocio.'],
      ['Puedes editarlo y volverlo a subir desde la app para actualizar precios.']
    ]),
    HOJAS.README
  )

  // 1. Negocio (1 fila desde configuración)
  const cfg = db.select().from(configuracion).all()
  const get = (k: string): string => cfg.find((c) => c.clave === k)?.valor ?? ''
  const wsNeg = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'NIT', 'Telefono', 'Direccion', 'Correo'],
    [get('nombre_negocio'), get('rut'), get('telefono'), get('direccion'), get('correo') || null]
  ])
  setColWidths(wsNeg, [25, 20, 20, 30, 25])
  XLSX.utils.book_append_sheet(wb, wsNeg, HOJAS.NEGOCIO)

  // 2. Proveedores
  const provs = db.select().from(proveedores).all()
  const wsProv = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Productos', 'Dias_pedido', 'Forma_pago', 'Telefono', 'Notas'],
    ...provs.map((p) => [
      p.nombre,
      p.producto ?? null,
      p.diasPedido ?? null,
      p.formaPago ?? null,
      p.telefono ?? null,
      p.notas ?? null
    ])
  ])
  setColWidths(wsProv, [18, 25, 18, 18, 15, 25])
  XLSX.utils.book_append_sheet(wb, wsProv, HOJAS.PROVEEDORES)

  // 3. Marcos (con nombre del proveedor resuelto)
  const marcosRows = db
    .select()
    .from(muestrasMarcos)
    .where(eq(muestrasMarcos.activo, true))
    .all()
  const provIdToName = new Map(provs.map((p) => [p.id, p.nombre]))
  const wsMarcos = XLSX.utils.aoa_to_sheet([
    ['Referencia', 'Proveedor', 'Colilla_cm', 'Precio_metro', 'Costo_metro', 'Descripcion'],
    ...marcosRows.map((m) => [
      m.referencia,
      m.proveedorId ? (provIdToName.get(m.proveedorId) ?? null) : null,
      m.colillaCm,
      m.precioMetro,
      m.costoMetroEstimado,
      m.descripcion ?? null
    ])
  ])
  setColWidths(wsMarcos, [15, 15, 12, 15, 15, 30])
  XLSX.utils.book_append_sheet(wb, wsMarcos, HOJAS.MARCOS)

  // 4. Vidrios
  const vids = db.select().from(preciosVidrios).where(eq(preciosVidrios.activo, true)).all()
  const wsVid = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Espesor_mm', 'Precio_m2', 'Costo_m2'],
    ...vids.map((v) => [v.nombre, v.espesorMm, v.precioM2, v.costoM2Estimado])
  ])
  setColWidths(wsVid, [25, 12, 15, 15])
  XLSX.utils.book_append_sheet(wb, wsVid, HOJAS.VIDRIOS)

  // 5-9. Tablas medida×precio
  const exportarMedidas = (
    tabla:
      | typeof preciosPaspartuPintado
      | typeof preciosPaspartuAcrilico
      | typeof preciosRetablos
      | typeof preciosBastidores
      | typeof preciosTapas,
    nombre: string
  ): void => {
    const filas = db.select().from(tabla).where(eq(tabla.activo, true)).all()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Ancho_cm', 'Alto_cm', 'Precio', 'Costo'],
      ...filas.map((f) => [f.anchoCm, f.altoCm, f.precio, f.costoEstimado])
    ])
    setColWidths(ws, [12, 12, 15, 15])
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  exportarMedidas(preciosPaspartuPintado, HOJAS.PASPARTU_PINTADO)
  exportarMedidas(preciosPaspartuAcrilico, HOJAS.PASPARTU_ACRILICO)
  exportarMedidas(preciosRetablos, HOJAS.RETABLOS)
  exportarMedidas(preciosBastidores, HOJAS.BASTIDORES)
  exportarMedidas(preciosTapas, HOJAS.TAPAS)

  // 10. Configuración (solo claves de la whitelist, no valores internos)
  const wsCfg = XLSX.utils.aoa_to_sheet([
    ['Clave', 'Valor', 'Descripcion'],
    ...cfg
      .filter((c) => CLAVES_CONFIG_PERMITIDAS.has(c.clave))
      .map((c) => [c.clave, c.valor, c.descripcion ?? null])
  ])
  setColWidths(wsCfg, [35, 12, 60])
  XLSX.utils.book_append_sheet(wb, wsCfg, HOJAS.CONFIGURACION)

  const fecha = new Date().toISOString().slice(0, 10)
  const filePath = join(app.getPath('downloads'), `Export-CasaAlberto-${fecha}.xlsx`)
  XLSX.writeFile(wb, filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// Helpers de UX: abrir/guardar archivos vía dialogo nativo
// ---------------------------------------------------------------------------

/**
 * Abre el dialogo para seleccionar la plantilla llenada y la parsea. Si el
 * usuario cancela, devuelve null. Permite que la UI tenga un solo IPC para
 * "subir plantilla" en vez de manejar dialogs y rutas.
 */
export function abrirYParsearPlantilla(): ResultadoParseo | null {
  const result = dialog.showOpenDialogSync({
    title: 'Subir plantilla de Casa Alberto',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  })
  if (!result || result.length === 0) return null
  return parsearPlantilla(result[0])
}

/**
 * Genera la plantilla y abre el archivo en el explorador del sistema (Finder
 * en macOS, Explorer en Windows) para que el dueño la encuentre fácil.
 */
export async function generarYAbrirPlantilla(): Promise<string> {
  const filePath = await generarPlantilla()
  shell.showItemInFolder(filePath)
  return filePath
}

/**
 * Exporta la configuración actual + listas de precios al formato de plantilla
 * y abre el archivo en el explorador. Útil como backup manual o para editar
 * masivamente precios en Excel.
 */
export function exportarYAbrirComoPlantilla(db: DB): string {
  const filePath = exportarComoPlantilla(db)
  shell.showItemInFolder(filePath)
  return filePath
}

export const __testing__ = {
  parseNum,
  trunc,
  esFilaVacia,
  esFilaEjemplo,
  buildTipoVidrio,
  CLAVES_CONFIG_PERMITIDAS
}
