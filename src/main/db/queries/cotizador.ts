import { and, asc, eq, gte } from 'drizzle-orm'
import type { DB } from '../index'
import {
  muestrasMarcos,
  preciosBastidores,
  preciosPaspartuAcrilico,
  preciosPaspartuPintado,
  preciosRetablos,
  preciosTapas,
  preciosVidrios,
  type PedidoItemMetadata,
  type TipoItemPedido,
  type TipoPaspartu,
  type TipoVidrioLista
} from '../schema'

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

export type CotizacionItem = {
  tipoItem: TipoItemPedido
  descripcion: string
  referencia?: string
  cantidad: number
  precioUnitario: number | null
  subtotal: number
  metadata?: PedidoItemMetadata
}

export type ResultadoCotizacion = {
  items: CotizacionItem[]
  subtotal: number
  totalMateriales: number
  precioTotal: number
}

// ---------------------------------------------------------------------------
// Límites operativos (validaciones de sanidad — no cambian fórmulas)
// ---------------------------------------------------------------------------

// Medida máxima razonable por lado para un cuadro (500 cm = 5 metros).
export const MEDIDA_MAX_CM = 500
// Colilla máxima razonable. Fase 2 muestra colillas entre 20 y 60 cm.
// 200 cm deja holgura para marcos grandes y descarta errores de captura obvios.
export const COLILLA_MAX_CM = 200
// Paspartú máximo razonable por lado (según reglas de negocio, 10-15 cm es habitual).
export const PASPARTU_MAX_CM = 20

function validarMedida(valor: number, nombre: string): void {
  if (!Number.isFinite(valor)) throw new Error(`${nombre} no es un número válido`)
  if (valor <= 0) throw new Error(`${nombre} debe ser mayor a 0`)
  if (valor > MEDIDA_MAX_CM) {
    throw new Error(`${nombre} excede el máximo operativo (${MEDIDA_MAX_CM} cm)`)
  }
}

function validarColilla(colillaCm: number): void {
  if (!Number.isFinite(colillaCm)) throw new Error('La colilla no es un número válido')
  if (colillaCm < 0) throw new Error('La colilla no puede ser negativa')
  if (colillaCm > COLILLA_MAX_CM) {
    throw new Error(
      `La colilla (${colillaCm} cm) excede el máximo razonable de ${COLILLA_MAX_CM} cm. ` +
        'Verifica la muestra del marco antes de cotizar.'
    )
  }
}

function validarPaspartu(anchoPaspartuCm: number): void {
  if (!Number.isFinite(anchoPaspartuCm)) {
    throw new Error('El ancho del paspartú no es un número válido')
  }
  if (anchoPaspartuCm <= 0) {
    throw new Error('El ancho del paspartú debe ser mayor a 0')
  }
  if (anchoPaspartuCm > PASPARTU_MAX_CM) {
    throw new Error(
      `El ancho del paspartú (${anchoPaspartuCm} cm) supera el máximo recomendado ` +
        `de ${PASPARTU_MAX_CM} cm. Confirma la medida con el cliente.`
    )
  }
}

// ---------------------------------------------------------------------------
// Fórmulas puras (sin acceso a DB)
// ---------------------------------------------------------------------------

export function calcularPrecioMarco(
  anchoCm: number,
  altoCm: number,
  colillaCm: number,
  precioMetro: number
): { totalCm: number; perimetroCm: number; metros: number; precio: number } {
  validarMedida(anchoCm, 'El ancho')
  validarMedida(altoCm, 'El alto')
  validarColilla(colillaCm)
  if (!Number.isFinite(precioMetro) || precioMetro < 0) {
    throw new Error('El precio por metro debe ser un valor no negativo')
  }
  const perimetroCm = (anchoCm + altoCm) * 2
  // La colilla se suma UNA vez — es el desperdicio total de esa referencia (Fase 2, A.1)
  const totalCm = perimetroCm + colillaCm
  const metros = totalCm / 100
  const precio = Math.round(metros * precioMetro)
  return { perimetroCm, totalCm, metros, precio }
}

export function redondearArriba10(cm: number): number {
  return Math.ceil(cm / 10) * 10
}

export function calcularPrecioVidrio(
  anchoCm: number,
  altoCm: number,
  precioM2: number
): { anchoRedondeado: number; altoRedondeado: number; areaM2: number; precio: number } {
  validarMedida(anchoCm, 'El ancho')
  validarMedida(altoCm, 'El alto')
  if (!Number.isFinite(precioM2) || precioM2 < 0) {
    throw new Error('El precio por m² debe ser un valor no negativo')
  }
  const anchoRedondeado = redondearArriba10(anchoCm)
  const altoRedondeado = redondearArriba10(altoCm)
  const areaM2 = (anchoRedondeado * altoRedondeado) / 10000
  const precio = Math.round(areaM2 * precioM2)
  return { anchoRedondeado, altoRedondeado, areaM2, precio }
}

// Fase 2 §A.5 — Acolchado tiene DOS formulaciones equivalentes:
//   (a) `ancho_cm × alto_cm × 15` (pesos por cm²)
//   (b) `ancho_m × alto_m × 150.000` (pesos por m²)
// Ambas producen el MISMO resultado exacto. Ejemplo: 50×70 cm
//   (a) 50 × 70 × 15 = 52.500
//   (b) 0.5 × 0.7 × 150.000 = 52.500
// Usamos la forma (a) porque la UI captura cm y evita errores de unidades.
// Ver test `acolchado ambas formulaciones son equivalentes` para la prueba.
export function calcularPrecioAcolchado(anchoCm: number, altoCm: number): number {
  validarMedida(anchoCm, 'El ancho')
  validarMedida(altoCm, 'El alto')
  return Math.round(anchoCm * altoCm * 15)
}

export function aplicarPaspartu(
  anchoCm: number,
  altoCm: number,
  anchoPaspartuCm: number
): { anchoExterior: number; altoExterior: number } {
  validarMedida(anchoCm, 'El ancho')
  validarMedida(altoCm, 'El alto')
  validarPaspartu(anchoPaspartuCm)
  return {
    anchoExterior: anchoCm + anchoPaspartuCm * 2,
    altoExterior: altoCm + anchoPaspartuCm * 2
  }
}

export function aplicarMaterialesAdicionales(subtotal: number, porcentaje: number): number {
  const p = Math.max(5, Math.min(10, porcentaje))
  return Math.round(subtotal * (p / 100))
}

// ---------------------------------------------------------------------------
// Lookups en tablas de precios por medida
// ---------------------------------------------------------------------------

function buscarPrecioPorMedida<T extends { anchoCm: number; altoCm: number; precio: number }>(
  filas: T[],
  anchoCm: number,
  altoCm: number
): T | null {
  // Normaliza orientación — busca filas donde ambos lados cubren las medidas solicitadas.
  const a = Math.min(anchoCm, altoCm)
  const b = Math.max(anchoCm, altoCm)
  let mejor: T | null = null
  for (const f of filas) {
    const fa = Math.min(f.anchoCm, f.altoCm)
    const fb = Math.max(f.anchoCm, f.altoCm)
    if (fa >= a && fb >= b) {
      if (!mejor || f.precio < mejor.precio) mejor = f
    }
  }
  return mejor
}

export function obtenerMuestraMarco(db: DB, id: number) {
  return db.select().from(muestrasMarcos).where(eq(muestrasMarcos.id, id)).get() ?? null
}

export function listarMuestrasMarcos(db: DB) {
  return db
    .select()
    .from(muestrasMarcos)
    .where(eq(muestrasMarcos.activo, true))
    .orderBy(muestrasMarcos.referencia)
    .all()
}

// CRUD para muestras de marcos
export type NuevaMuestraMarco = {
  referencia: string
  colillaCm: number
  precioMetro: number
  descripcion?: string | null
}

export function crearMuestraMarco(db: DB, data: NuevaMuestraMarco) {
  return db.insert(muestrasMarcos).values(data).returning().get()
}

export function actualizarMuestraMarco(db: DB, id: number, data: Partial<NuevaMuestraMarco>) {
  return db.update(muestrasMarcos).set(data).where(eq(muestrasMarcos.id, id)).returning().get()
}

export function desactivarMuestraMarco(db: DB, id: number) {
  return db
    .update(muestrasMarcos)
    .set({ activo: false })
    .where(eq(muestrasMarcos.id, id))
    .returning()
    .get()
}

// CRUD para precios de vidrio
export function actualizarPrecioVidrio(db: DB, id: number, precioM2: number) {
  return db
    .update(preciosVidrios)
    .set({ precioM2 })
    .where(eq(preciosVidrios.id, id))
    .returning()
    .get()
}

export function listarPreciosVidrio(db: DB) {
  return db.select().from(preciosVidrios).where(eq(preciosVidrios.activo, true)).all()
}

export function obtenerPrecioVidrio(db: DB, tipo: TipoVidrioLista) {
  return (
    db
      .select()
      .from(preciosVidrios)
      .where(and(eq(preciosVidrios.tipo, tipo), eq(preciosVidrios.activo, true)))
      .orderBy(asc(preciosVidrios.id))
      .get() ?? null
  )
}

export function obtenerPrecioPaspartu(
  db: DB,
  tipo: TipoPaspartu,
  anchoExterior: number,
  altoExterior: number
) {
  const tabla = tipo === 'pintado' ? preciosPaspartuPintado : preciosPaspartuAcrilico
  const filas = db.select().from(tabla).where(eq(tabla.activo, true)).all()
  return buscarPrecioPorMedida(filas, anchoExterior, altoExterior)
}

export function obtenerPrecioRetablo(db: DB, anchoCm: number, altoCm: number) {
  const filas = db.select().from(preciosRetablos).where(eq(preciosRetablos.activo, true)).all()
  return buscarPrecioPorMedida(filas, anchoCm, altoCm)
}

export function obtenerPrecioBastidor(db: DB, anchoCm: number, altoCm: number) {
  const filas = db.select().from(preciosBastidores).where(eq(preciosBastidores.activo, true)).all()
  return buscarPrecioPorMedida(filas, anchoCm, altoCm)
}

export function obtenerPrecioTapa(db: DB, anchoCm: number, altoCm: number) {
  const filas = db.select().from(preciosTapas).where(eq(preciosTapas.activo, true)).all()
  return buscarPrecioPorMedida(filas, anchoCm, altoCm)
}

// ---------------------------------------------------------------------------
// Cotizaciones completas por tipo de trabajo
// ---------------------------------------------------------------------------

export type InputEnmarcacionEstandar = {
  anchoCm: number
  altoCm: number
  muestraMarcoId: number
  tipoVidrio: TipoVidrioLista | 'ninguno'
  porcentajeMateriales?: number
}

export function cotizarEnmarcacionEstandar(
  db: DB,
  input: InputEnmarcacionEstandar
): ResultadoCotizacion {
  const items: CotizacionItem[] = []

  const marco = obtenerMuestraMarco(db, input.muestraMarcoId)
  if (!marco) throw new Error(`Muestra de marco ${input.muestraMarcoId} no encontrada`)

  const calcMarco = calcularPrecioMarco(
    input.anchoCm,
    input.altoCm,
    marco.colillaCm,
    marco.precioMetro
  )
  items.push({
    tipoItem: 'marco',
    descripcion: `Marco ${marco.referencia}`,
    referencia: marco.referencia,
    cantidad: 1,
    precioUnitario: marco.precioMetro,
    subtotal: calcMarco.precio,
    metadata: {
      perimetroCm: calcMarco.perimetroCm,
      colillaCm: marco.colillaCm,
      metros: calcMarco.metros
    }
  })

  if (input.tipoVidrio !== 'ninguno') {
    const pv = obtenerPrecioVidrio(db, input.tipoVidrio)
    if (!pv) throw new Error(`Precio de vidrio '${input.tipoVidrio}' no configurado`)
    const calcVidrio = calcularPrecioVidrio(input.anchoCm, input.altoCm, pv.precioM2)
    items.push({
      tipoItem: 'vidrio',
      descripcion: `Vidrio ${input.tipoVidrio}`,
      cantidad: 1,
      precioUnitario: pv.precioM2,
      subtotal: calcVidrio.precio,
      metadata: {
        anchoRedondeado: calcVidrio.anchoRedondeado,
        altoRedondeado: calcVidrio.altoRedondeado,
        areaM2: calcVidrio.areaM2
      }
    })
  }

  return finalizarCotizacion(items, input.porcentajeMateriales ?? 10)
}

export type InputEnmarcacionPaspartu = {
  anchoCm: number
  altoCm: number
  anchoPaspartuCm: number
  tipoPaspartu: TipoPaspartu
  muestraMarcoId: number
  tipoVidrio: TipoVidrioLista | 'ninguno'
  porcentajeMateriales?: number
}

export function cotizarEnmarcacionPaspartu(
  db: DB,
  input: InputEnmarcacionPaspartu
): ResultadoCotizacion {
  const items: CotizacionItem[] = []
  const { anchoExterior, altoExterior } = aplicarPaspartu(
    input.anchoCm,
    input.altoCm,
    input.anchoPaspartuCm
  )

  const pp = obtenerPrecioPaspartu(db, input.tipoPaspartu, anchoExterior, altoExterior)
  if (!pp)
    throw new Error(
      `Sin precio de paspartú ${input.tipoPaspartu} para ${anchoExterior}x${altoExterior}cm`
    )
  items.push({
    tipoItem: input.tipoPaspartu === 'pintado' ? 'paspartu_pintado' : 'paspartu_acrilico',
    descripcion: `Paspartú ${input.tipoPaspartu} ${anchoExterior}x${altoExterior}cm`,
    cantidad: 1,
    precioUnitario: pp.precio,
    subtotal: pp.precio,
    metadata: {
      anchoExteriorCm: anchoExterior,
      altoExteriorCm: altoExterior
    }
  })

  const marco = obtenerMuestraMarco(db, input.muestraMarcoId)
  if (!marco) throw new Error(`Muestra de marco ${input.muestraMarcoId} no encontrada`)
  const calcMarco = calcularPrecioMarco(
    anchoExterior,
    altoExterior,
    marco.colillaCm,
    marco.precioMetro
  )
  items.push({
    tipoItem: 'marco',
    descripcion: `Marco ${marco.referencia}`,
    referencia: marco.referencia,
    cantidad: 1,
    precioUnitario: marco.precioMetro,
    subtotal: calcMarco.precio,
    metadata: {
      perimetroCm: calcMarco.perimetroCm,
      colillaCm: marco.colillaCm,
      metros: calcMarco.metros
    }
  })

  if (input.tipoVidrio !== 'ninguno') {
    const pv = obtenerPrecioVidrio(db, input.tipoVidrio)
    if (!pv) throw new Error(`Precio de vidrio '${input.tipoVidrio}' no configurado`)
    const calcVidrio = calcularPrecioVidrio(anchoExterior, altoExterior, pv.precioM2)
    items.push({
      tipoItem: 'vidrio',
      descripcion: `Vidrio ${input.tipoVidrio}`,
      cantidad: 1,
      precioUnitario: pv.precioM2,
      subtotal: calcVidrio.precio,
      metadata: {
        anchoRedondeado: calcVidrio.anchoRedondeado,
        altoRedondeado: calcVidrio.altoRedondeado,
        areaM2: calcVidrio.areaM2
      }
    })
  }

  return finalizarCotizacion(items, input.porcentajeMateriales ?? 10)
}

export type InputAcolchado = {
  anchoCm: number
  altoCm: number
  muestraMarcoId?: number | null
  porcentajeMateriales?: number
}

export function cotizarAcolchado(db: DB, input: InputAcolchado): ResultadoCotizacion {
  const precio = calcularPrecioAcolchado(input.anchoCm, input.altoCm)
  const items: CotizacionItem[] = [
    {
      tipoItem: 'acolchado',
      descripcion: `Acolchado ${input.anchoCm}x${input.altoCm}cm`,
      cantidad: 1,
      precioUnitario: null,
      subtotal: precio
    }
  ]

  // Fase 2 §A.5 — combinaciones posibles: acolchado + marco opcional.
  // Cuando hay marco, agregamos el ítem calculado con la fórmula oficial
  // para que el acolchado combinado use la MISMA lógica del backend
  // (sin duplicar cálculos en el renderer).
  if (input.muestraMarcoId) {
    const marco = obtenerMuestraMarco(db, input.muestraMarcoId)
    if (!marco) throw new Error(`Muestra de marco ${input.muestraMarcoId} no encontrada`)
    const calcMarco = calcularPrecioMarco(
      input.anchoCm,
      input.altoCm,
      marco.colillaCm,
      marco.precioMetro
    )
    items.push({
      tipoItem: 'marco',
      descripcion: `Marco ${marco.referencia}`,
      referencia: marco.referencia,
      cantidad: 1,
      precioUnitario: marco.precioMetro,
      subtotal: calcMarco.precio,
      metadata: {
        perimetroCm: calcMarco.perimetroCm,
        colillaCm: marco.colillaCm,
        metros: calcMarco.metros
      }
    })
  }

  return finalizarCotizacion(items, input.porcentajeMateriales ?? 10)
}

export type InputLookupMedida = {
  anchoCm: number
  altoCm: number
  porcentajeMateriales?: number
}

export function cotizarRetablo(db: DB, input: InputLookupMedida): ResultadoCotizacion {
  validarMedida(input.anchoCm, 'El ancho')
  validarMedida(input.altoCm, 'El alto')
  const p = obtenerPrecioRetablo(db, input.anchoCm, input.altoCm)
  if (!p) throw new Error(`Sin precio de retablo para ${input.anchoCm}x${input.altoCm}cm`)
  return finalizarCotizacion(
    [
      {
        tipoItem: 'retablo',
        descripcion: `Retablo ${input.anchoCm}x${input.altoCm}cm`,
        cantidad: 1,
        precioUnitario: p.precio,
        subtotal: p.precio
      }
    ],
    input.porcentajeMateriales ?? 10
  )
}

export function cotizarBastidor(db: DB, input: InputLookupMedida): ResultadoCotizacion {
  validarMedida(input.anchoCm, 'El ancho')
  validarMedida(input.altoCm, 'El alto')
  const p = obtenerPrecioBastidor(db, input.anchoCm, input.altoCm)
  if (!p) throw new Error(`Sin precio de bastidor para ${input.anchoCm}x${input.altoCm}cm`)
  return finalizarCotizacion(
    [
      {
        tipoItem: 'bastidor',
        descripcion: `Bastidor ${input.anchoCm}x${input.altoCm}cm`,
        cantidad: 1,
        precioUnitario: p.precio,
        subtotal: p.precio
      }
    ],
    input.porcentajeMateriales ?? 10
  )
}

// Fase 2 §A.8 — Vidrios y espejos a domicilio.
// Mismo cálculo que calcularPrecioVidrio (redondeo a múltiplos de 10)
// + costo de instalación opcional. NO suma materiales adicionales: los
// contratos de vidrio/espejo no los llevan según Fase 2.
export type InputVidrioEspejo = {
  anchoCm: number
  altoCm: number
  tipoVidrio: TipoVidrioLista
  precioInstalacion?: number
  descripcion?: string | null
}

export function cotizarVidrioEspejo(db: DB, input: InputVidrioEspejo): ResultadoCotizacion {
  const pv = obtenerPrecioVidrio(db, input.tipoVidrio)
  if (!pv) throw new Error(`Precio de vidrio '${input.tipoVidrio}' no configurado`)
  const calc = calcularPrecioVidrio(input.anchoCm, input.altoCm, pv.precioM2)

  const items: CotizacionItem[] = [
    {
      tipoItem: 'vidrio',
      descripcion:
        input.descripcion || `Vidrio ${input.tipoVidrio} ${input.anchoCm}x${input.altoCm}cm`,
      cantidad: 1,
      precioUnitario: pv.precioM2,
      subtotal: calc.precio,
      metadata: {
        anchoRedondeado: calc.anchoRedondeado,
        altoRedondeado: calc.altoRedondeado,
        areaM2: calc.areaM2
      }
    }
  ]

  const instalacion = Math.max(0, Math.round(input.precioInstalacion ?? 0))
  if (instalacion > 0) {
    items.push({
      tipoItem: 'instalacion',
      descripcion: 'Instalación a domicilio',
      cantidad: 1,
      precioUnitario: instalacion,
      subtotal: instalacion
    })
  }

  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0)
  return {
    items,
    subtotal,
    totalMateriales: 0,
    precioTotal: subtotal
  }
}

export function cotizarTapa(db: DB, input: InputLookupMedida): ResultadoCotizacion {
  validarMedida(input.anchoCm, 'El ancho')
  validarMedida(input.altoCm, 'El alto')
  const p = obtenerPrecioTapa(db, input.anchoCm, input.altoCm)
  if (!p) throw new Error(`Sin precio de tapa para ${input.anchoCm}x${input.altoCm}cm`)
  return finalizarCotizacion(
    [
      {
        tipoItem: 'tapa',
        descripcion: `Tapa ${input.anchoCm}x${input.altoCm}cm`,
        cantidad: 1,
        precioUnitario: p.precio,
        subtotal: p.precio
      }
    ],
    input.porcentajeMateriales ?? 10
  )
}

// ---------------------------------------------------------------------------
// CRUD para listas de precios por medida (5 tablas)
// ---------------------------------------------------------------------------

// Paspartú pintado
export function listarPreciosPaspartuPintado(db: DB) {
  return db
    .select()
    .from(preciosPaspartuPintado)
    .where(eq(preciosPaspartuPintado.activo, true))
    .orderBy(preciosPaspartuPintado.anchoCm)
    .all()
}
export function crearPrecioPaspartuPintado(
  db: DB,
  data: { anchoCm: number; altoCm: number; precio: number; descripcion?: string | null }
) {
  return db.insert(preciosPaspartuPintado).values(data).returning().get()
}
export function eliminarPrecioPaspartuPintado(db: DB, id: number) {
  return db
    .update(preciosPaspartuPintado)
    .set({ activo: false })
    .where(eq(preciosPaspartuPintado.id, id))
    .returning()
    .get()
}

// Paspartú acrílico
export function listarPreciosPaspartuAcrilico(db: DB) {
  return db
    .select()
    .from(preciosPaspartuAcrilico)
    .where(eq(preciosPaspartuAcrilico.activo, true))
    .orderBy(preciosPaspartuAcrilico.anchoCm)
    .all()
}
export function crearPrecioPaspartuAcrilico(
  db: DB,
  data: { anchoCm: number; altoCm: number; precio: number; descripcion?: string | null }
) {
  return db.insert(preciosPaspartuAcrilico).values(data).returning().get()
}
export function eliminarPrecioPaspartuAcrilico(db: DB, id: number) {
  return db
    .update(preciosPaspartuAcrilico)
    .set({ activo: false })
    .where(eq(preciosPaspartuAcrilico.id, id))
    .returning()
    .get()
}

// Retablos
export function listarPreciosRetablos(db: DB) {
  return db
    .select()
    .from(preciosRetablos)
    .where(eq(preciosRetablos.activo, true))
    .orderBy(preciosRetablos.anchoCm)
    .all()
}
export function crearPrecioRetablo(
  db: DB,
  data: { anchoCm: number; altoCm: number; precio: number }
) {
  return db.insert(preciosRetablos).values(data).returning().get()
}
export function eliminarPrecioRetablo(db: DB, id: number) {
  return db
    .update(preciosRetablos)
    .set({ activo: false })
    .where(eq(preciosRetablos.id, id))
    .returning()
    .get()
}

// Bastidores
export function listarPreciosBastidores(db: DB) {
  return db
    .select()
    .from(preciosBastidores)
    .where(eq(preciosBastidores.activo, true))
    .orderBy(preciosBastidores.anchoCm)
    .all()
}
export function crearPrecioBastidor(
  db: DB,
  data: { anchoCm: number; altoCm: number; precio: number }
) {
  return db.insert(preciosBastidores).values(data).returning().get()
}
export function eliminarPrecioBastidor(db: DB, id: number) {
  return db
    .update(preciosBastidores)
    .set({ activo: false })
    .where(eq(preciosBastidores.id, id))
    .returning()
    .get()
}

// Tapas
export function listarPreciosTapas(db: DB) {
  return db
    .select()
    .from(preciosTapas)
    .where(eq(preciosTapas.activo, true))
    .orderBy(preciosTapas.anchoCm)
    .all()
}
export function crearPrecioTapa(db: DB, data: { anchoCm: number; altoCm: number; precio: number }) {
  return db.insert(preciosTapas).values(data).returning().get()
}
export function eliminarPrecioTapa(db: DB, id: number) {
  return db
    .update(preciosTapas)
    .set({ activo: false })
    .where(eq(preciosTapas.id, id))
    .returning()
    .get()
}

// ---------------------------------------------------------------------------
// Util interno
// ---------------------------------------------------------------------------

function finalizarCotizacion(
  items: CotizacionItem[],
  porcentajeMateriales: number
): ResultadoCotizacion {
  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0)
  const totalMateriales = aplicarMaterialesAdicionales(subtotal, porcentajeMateriales)
  if (totalMateriales > 0) {
    items.push({
      tipoItem: 'materiales_adicionales',
      descripcion: `Materiales adicionales (${porcentajeMateriales}%)`,
      cantidad: 1,
      precioUnitario: null,
      subtotal: totalMateriales
    })
  }
  return {
    items,
    subtotal,
    totalMateriales,
    precioTotal: subtotal + totalMateriales
  }
}

// Suppress unused import warning — gte may be used later for exact lookups
void gte
