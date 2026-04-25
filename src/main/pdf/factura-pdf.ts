import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'
import { join, resolve, sep } from 'path'
import { createWriteStream, existsSync, mkdirSync, lstatSync, realpathSync } from 'fs'
import type { DB } from '../db'
import { configuracion } from '../db/schema'
import { eq } from 'drizzle-orm'
import { PDF_FORMATOS, type PdfFormato } from '../../shared/types'

// Formato de consecutivo esperado: prefijo de 1-3 mayúsculas + guión + 1-8 dígitos.
// Defensa en profundidad ante un consecutivo corrupto que pudiera escapar del
// directorio de PDFs vía `../../`.
const NUMERO_REGEX = /^[A-Z]{1,3}-\d{1,8}$/

// Caracteres de control (0x00-0x08, 0x0b-0x0c, 0x0e-0x1f, 0x7f) pueden
// corromper el render del PDF o inyectar operadores al stream. Se permiten
// \t (0x09), \n (0x0a) y \r (0x0d) porque pdfkit los maneja correctamente.
function sanitizePdfText(s: string | null | undefined): string {
  if (!s) return ''
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

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
  // Defensa en profundidad contra path traversal: aunque `data.numero` viene
  // de `generarConsecutivo()` (controlado), validamos el formato antes de
  // construir el path del archivo.
  if (!NUMERO_REGEX.test(data.numero)) {
    throw new Error('Número de factura con formato inválido')
  }

  // El tipo `PdfFormato` solo existe en TypeScript — en runtime, un renderer
  // comprometido o una llamada IPC malformada podría enviar `formato:
  // "../../evil"` que termina interpolado en el path del archivo. Aceptamos
  // únicamente los valores conocidos del whitelist exportado.
  if (data.formato !== undefined && !PDF_FORMATOS.includes(data.formato)) {
    throw new Error('Formato de PDF inválido')
  }

  // Sanear strings de dominio que terminan en el PDF. Protege contra:
  //  - Caracteres de control pegados accidentalmente (\x00 rompe el stream)
  //  - Contenido copiado de fuentes externas con metadata invisible
  const safeData: FacturaData = {
    ...data,
    clienteNombre: sanitizePdfText(data.clienteNombre),
    clienteCedula: sanitizePdfText(data.clienteCedula),
    clienteTelefono: sanitizePdfText(data.clienteTelefono),
    clienteDireccion: sanitizePdfText(data.clienteDireccion),
    notas: sanitizePdfText(data.notas),
    items: data.items.map((it) => ({ ...it, descripcion: sanitizePdfText(it.descripcion) }))
  }

  const pdfDir = join(app.getPath('userData'), 'pdfs')
  if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true })
  const formato: PdfFormato = safeData.formato ?? 'carta'
  const filePath = join(pdfDir, `factura-${safeData.numero}-${formato}.pdf`)

  const negocio: Negocio = {
    nombre: sanitizePdfText(getConfig(db, 'nombre_negocio')),
    rut: sanitizePdfText(getConfig(db, 'rut')),
    tel: sanitizePdfText(getConfig(db, 'telefono')),
    dir: sanitizePdfText(getConfig(db, 'direccion'))
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
    renderFormatoTermico(doc, safeData, negocio)
  } else {
    renderFormatoPagina(doc, safeData, negocio)
  }

  doc.end()
  return filePath
}

export function abrirPDF(filePath: string): void {
  const pdfDir = join(app.getPath('userData'), 'pdfs')
  const realPath = validarPathSeguro(filePath, pdfDir, 'PDF')
  shell.openPath(realPath)
}

/**
 * Valida que `rawPath` apunta a un archivo regular dentro de `allowedDirRaw`,
 * bloqueando path traversal Y symlinks. Retorna la ruta canonicalizada.
 *
 * Por qué rechazamos symlinks: resolve() normaliza '..' pero NO sigue
 * symlinks, mientras que shell.openPath SÍ los sigue. Un attacker que
 * controle el renderer podría crear un symlink dentro del directorio de
 * PDFs apuntando a /etc/passwd y abrirlo a través del Finder/Explorer.
 *
 * Al usuario siempre se le muestra el mismo mensaje ("Ruta de X inválida")
 * para no filtrar detalles técnicos. El motivo real queda en console.warn
 * para debugging.
 *
 * Copia idéntica de este helper existe en src/main/db/backup.ts. Si
 * modificás uno, actualizá el otro — los tests cubren ambos paths.
 */
function validarPathSeguro(rawPath: string, allowedDirRaw: string, recurso: string): string {
  const mensajeUsuario = `Ruta de ${recurso} inválida`
  const allowedDir = resolve(allowedDirRaw)
  const resolvedTextual = resolve(rawPath)

  // Guard 1 (textual): resolve() normaliza '..' pero no sigue symlinks.
  if (!resolvedTextual.startsWith(allowedDir + sep)) {
    console.warn(`[security] ${recurso} fuera de directorio permitido:`, resolvedTextual)
    throw new Error(mensajeUsuario)
  }

  // Guard 2: existencia + tipo en una sola syscall. lstat NO sigue symlinks
  // (a diferencia de stat), así que detecta el link mismo.
  let linkStat
  try {
    linkStat = lstatSync(resolvedTextual)
  } catch {
    throw new Error(`Archivo ${recurso} no encontrado`)
  }
  if (linkStat.isSymbolicLink()) {
    console.warn(`[security] ${recurso} es un symlink, rechazado:`, resolvedTextual)
    throw new Error(mensajeUsuario)
  }
  if (!linkStat.isFile()) {
    console.warn(`[security] ${recurso} no es archivo regular:`, resolvedTextual)
    throw new Error(mensajeUsuario)
  }

  // Guard 3: canonicalizar ambos lados con realpathSync. Necesario en macOS
  // porque `/var` es symlink a `/private/var` — sin canonicalizar ambos
  // lados, archivos válidos se rechazarían en macOS. Si `allowedDir` no
  // existe aún, caemos a la comparación textual del guard 1 ya validada.
  try {
    const realAllowed = realpathSync(allowedDir)
    const realPath = realpathSync(resolvedTextual)
    if (!realPath.startsWith(realAllowed + sep)) {
      console.warn(`[security] ${recurso} apunta fuera tras resolver symlinks:`, realPath)
      throw new Error(mensajeUsuario)
    }
    return realPath
  } catch (err) {
    if (err instanceof Error && err.message === mensajeUsuario) throw err
    // allowedDir no existe aún — el guard 1 ya validó textualmente y el
    // guard 2 confirmó que no hay symlink. Seguro usar la ruta resuelta.
    return resolvedTextual
  }
}

// Exportado solo para tests — defensa en profundidad contra control chars en strings de dominio.
export { sanitizePdfText, NUMERO_REGEX }
