import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import type { DB } from '../db'
import { configuracion } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { PdfFormato } from '../../shared/types'

type FacturaData = {
  numero: string
  fecha: string
  clienteNombre: string
  clienteCedula?: string | null
  clienteTelefono?: string | null
  clienteDireccion?: string | null
  items: { descripcion: string; cantidad: number; precioUnitario: number; subtotal: number }[]
  subtotal: number
  totalMateriales: number
  total: number
  pagos: { fecha: string; monto: number; metodo: string }[]
  saldo: number
  notas?: string | null
  formato?: PdfFormato
}

function getConfig(db: DB, clave: string): string {
  const row = db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
  return row?.valor ?? ''
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n)
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(iso + 'T12:00:00'))
}

// ---------------------------------------------------------------------------
// SPEC-008 — 3 formatos de impresión
// ---------------------------------------------------------------------------

type Negocio = {
  nombre: string
  rut: string
  tel: string
  dir: string
}

/**
 * Factura tamaño carta/A4 — layout tradicional con header centrado,
 * tabla de items, totales alineados a la derecha, pagos y notas.
 */
function renderFormatoPagina(doc: PDFKit.PDFDocument, data: FacturaData, negocio: Negocio): void {
  // Header — business info
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(negocio.nombre || 'CasaAlberto', { align: 'center' })
  doc.fontSize(9).font('Helvetica')
  if (negocio.rut) doc.text(`NIT: ${negocio.rut}`, { align: 'center' })
  if (negocio.dir) doc.text(negocio.dir, { align: 'center' })
  if (negocio.tel) doc.text(`Tel: ${negocio.tel}`, { align: 'center' })

  doc.moveDown(0.5)
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke('#e7e5e4')
  doc.moveDown(0.5)

  // Factura number + date
  doc.fontSize(14).font('Helvetica-Bold').text(`FACTURA ${data.numero}`)
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Fecha: ${formatFecha(data.fecha)}`)
  doc.moveDown(0.5)

  // Client info
  doc.fontSize(10).font('Helvetica-Bold').text('Cliente:')
  doc.font('Helvetica')
  doc.text(data.clienteNombre)
  if (data.clienteCedula) doc.text(`CC/NIT: ${data.clienteCedula}`)
  if (data.clienteTelefono) doc.text(`Tel: ${data.clienteTelefono}`)
  if (data.clienteDireccion) doc.text(`Dir: ${data.clienteDireccion}`)
  doc.moveDown()

  // Items table header — las columnas se adaptan al ancho de la página.
  const tableTop = doc.y
  const pageRight = doc.page.width - 50
  const col = {
    desc: 50,
    cant: pageRight - 220,
    unit: pageRight - 160,
    sub: pageRight - 80
  }
  doc.fontSize(8).font('Helvetica-Bold')
  doc.text('DESCRIPCION', col.desc, tableTop)
  doc.text('CANT', col.cant, tableTop)
  doc.text('V. UNIT', col.unit, tableTop)
  doc.text('SUBTOTAL', col.sub, tableTop)
  doc
    .moveTo(50, tableTop + 14)
    .lineTo(pageRight, tableTop + 14)
    .stroke('#e7e5e4')

  // Items
  let y = tableTop + 20
  doc.fontSize(9).font('Helvetica')
  for (const item of data.items) {
    doc.text(item.descripcion, col.desc, y, { width: col.cant - col.desc - 10 })
    doc.text(String(item.cantidad), col.cant, y)
    doc.text(item.precioUnitario ? formatCOP(item.precioUnitario) : '', col.unit, y)
    doc.text(formatCOP(item.subtotal), col.sub, y)
    y += 16
  }

  doc.moveTo(50, y).lineTo(pageRight, y).stroke('#e7e5e4')
  y += 8

  // Totals
  doc.font('Helvetica')
  doc.text('Subtotal:', col.unit, y)
  doc.text(formatCOP(data.subtotal), col.sub, y)
  y += 14
  if (data.totalMateriales > 0) {
    doc.text('Materiales:', col.unit, y)
    doc.text(formatCOP(data.totalMateriales), col.sub, y)
    y += 14
  }
  doc.font('Helvetica-Bold').fontSize(11)
  doc.text('TOTAL:', col.unit, y)
  doc.text(formatCOP(data.total), col.sub, y)
  y += 20

  // Payments
  if (data.pagos.length > 0) {
    doc.fontSize(10).font('Helvetica-Bold').text('Pagos recibidos:', 50, y)
    y += 16
    doc.fontSize(9).font('Helvetica')
    for (const p of data.pagos) {
      doc.text(`${formatFecha(p.fecha)} — ${p.metodo} — ${formatCOP(p.monto)}`, 50, y)
      y += 14
    }
    y += 4
    doc.font('Helvetica-Bold')
    doc.text(`Saldo pendiente: ${formatCOP(data.saldo)}`, 50, y)
    y += 20
  }

  // Notes
  if (data.notas) {
    doc.fontSize(9).font('Helvetica')
    doc.text(`Notas: ${data.notas}`, 50, y, { width: pageRight - 50 })
    y += 30
  }

  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('#a8a29e')
  const footerY = doc.page.height - 80
  doc.text('ORIGINAL', 50, footerY, { align: 'center', width: pageRight - 50 })
  doc.text('Documento generado por CasaAlberto App', 50, footerY + 12, {
    align: 'center',
    width: pageRight - 50
  })
}

/**
 * Factura formato tirilla térmica 80 mm — ancho reducido, layout vertical
 * compacto, ideal para impresoras POS. No usa tabla tradicional.
 */
function renderFormatoTermico(doc: PDFKit.PDFDocument, data: FacturaData, negocio: Negocio): void {
  // Ancho útil de 80mm menos márgenes laterales (~10 mm). En puntos PDF,
  // 80 mm ≈ 226,77 pt; con margen 10 pt por lado quedan ~206 pt útiles.
  const pageWidth = doc.page.width
  const margin = 10
  const usable = pageWidth - margin * 2

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(negocio.nombre || 'CasaAlberto', margin, 10, {
      align: 'center',
      width: usable
    })
  doc.fontSize(7).font('Helvetica')
  if (negocio.rut) doc.text(`NIT: ${negocio.rut}`, { align: 'center', width: usable })
  if (negocio.dir) doc.text(negocio.dir, { align: 'center', width: usable })
  if (negocio.tel) doc.text(`Tel: ${negocio.tel}`, { align: 'center', width: usable })

  doc.moveDown(0.3)
  doc.fontSize(8).text('-'.repeat(42), { align: 'center', width: usable })
  doc.moveDown(0.2)

  // Factura info
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`FACTURA ${data.numero}`, { align: 'center', width: usable })
  doc
    .fontSize(7)
    .font('Helvetica')
    .text(formatFecha(data.fecha), { align: 'center', width: usable })
  doc.moveDown(0.3)

  // Cliente
  doc.fontSize(7).font('Helvetica-Bold').text('Cliente:', margin)
  doc.font('Helvetica')
  doc.text(data.clienteNombre, { width: usable })
  if (data.clienteCedula) doc.text(`CC: ${data.clienteCedula}`, { width: usable })
  if (data.clienteTelefono) doc.text(`Tel: ${data.clienteTelefono}`, { width: usable })

  doc.moveDown(0.2)
  doc.fontSize(8).text('-'.repeat(42), { align: 'center', width: usable })
  doc.moveDown(0.1)

  // Items — formato vertical: descripcion arriba, cant × unit y subtotal abajo
  doc.fontSize(7).font('Helvetica')
  for (const item of data.items) {
    doc.font('Helvetica-Bold').text(item.descripcion, margin, doc.y, { width: usable })
    doc.font('Helvetica')
    const left = item.precioUnitario
      ? `${item.cantidad} × ${formatCOP(item.precioUnitario)}`
      : `${item.cantidad}`
    doc.text(left, margin, doc.y, { width: usable, continued: true })
    doc.text(formatCOP(item.subtotal), margin, doc.y, { width: usable, align: 'right' })
    doc.moveDown(0.1)
  }

  doc.fontSize(8).text('-'.repeat(42), { align: 'center', width: usable })

  // Totales
  doc.fontSize(7).font('Helvetica')
  doc.text('Subtotal:', margin, doc.y, { width: usable, continued: true })
  doc.text(formatCOP(data.subtotal), margin, doc.y, { width: usable, align: 'right' })
  if (data.totalMateriales > 0) {
    doc.text('Materiales:', margin, doc.y, { width: usable, continued: true })
    doc.text(formatCOP(data.totalMateriales), margin, doc.y, { width: usable, align: 'right' })
  }
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('TOTAL:', margin, doc.y, { width: usable, continued: true })
  doc.text(formatCOP(data.total), margin, doc.y, { width: usable, align: 'right' })

  // Pagos
  if (data.pagos.length > 0) {
    doc.moveDown(0.3)
    doc.fontSize(8).text('-'.repeat(42), { align: 'center', width: usable })
    doc.fontSize(7).font('Helvetica-Bold').text('Pagos:', margin)
    doc.font('Helvetica')
    for (const p of data.pagos) {
      doc.text(`${formatFecha(p.fecha)} ${p.metodo}`, margin, doc.y, {
        width: usable,
        continued: true
      })
      doc.text(formatCOP(p.monto), margin, doc.y, { width: usable, align: 'right' })
    }
    doc.font('Helvetica-Bold')
    doc.text('Saldo:', margin, doc.y, { width: usable, continued: true })
    doc.text(formatCOP(data.saldo), margin, doc.y, { width: usable, align: 'right' })
  }

  if (data.notas) {
    doc.moveDown(0.3)
    doc.fontSize(6).font('Helvetica').text(`Notas: ${data.notas}`, margin, doc.y, { width: usable })
  }

  doc.moveDown(0.5)
  doc.fontSize(6).fillColor('#a8a29e').text('— Gracias por su compra —', margin, doc.y, {
    align: 'center',
    width: usable
  })
}

// ---------------------------------------------------------------------------
// Factory — elige el formato y genera el PDF
// ---------------------------------------------------------------------------

export function generarFacturaPDF(db: DB, data: FacturaData): string {
  const pdfDir = join(app.getPath('userData'), 'pdfs')
  if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true })
  const formato: PdfFormato = data.formato ?? 'carta'
  const filePath = join(pdfDir, `factura-${data.numero}-${formato}.pdf`)

  const negocio: Negocio = {
    nombre: getConfig(db, 'nombre_negocio'),
    rut: getConfig(db, 'rut'),
    tel: getConfig(db, 'telefono'),
    dir: getConfig(db, 'direccion')
  }

  // SPEC-008 — tres formatos:
  //   - 'carta': LETTER (tradicional latinoamericano, ~216×279 mm)
  //   - 'a4':    A4 (estándar ISO, ~210×297 mm)
  //   - 'termico80': tirilla 80 mm con alto flexible (POS)
  let doc: PDFKit.PDFDocument
  if (formato === 'termico80') {
    // 80 mm ≈ 226.77 pt; alto generoso (largo de papel térmico variable).
    doc = new PDFDocument({ size: [226.77, 800], margin: 10 })
  } else if (formato === 'a4') {
    doc = new PDFDocument({ size: 'A4', margin: 50 })
  } else {
    doc = new PDFDocument({ size: 'LETTER', margin: 50 })
  }

  const stream = createWriteStream(filePath)
  doc.pipe(stream)

  if (formato === 'termico80') {
    renderFormatoTermico(doc, data, negocio)
  } else {
    renderFormatoPagina(doc, data, negocio)
  }

  doc.end()
  return filePath
}

export function abrirPDF(filePath: string): void {
  shell.openPath(filePath)
}
