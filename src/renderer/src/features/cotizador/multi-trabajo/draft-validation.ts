// Validador runtime para el draft de multi-trabajo persistido en
// localStorage. La política es "todo o nada": si CUALQUIER campo no pasa,
// devolvemos `null` y el caller borra el draft. Preferimos perder un draft
// corrupto a dejar la ruta congelada — un draft malformado puede llegar por:
// (1) tampering local; (2) cambio de schema entre versiones; (3) escritura
// parcial al cerrar la app justo durante el JSON.stringify.
//
// Si algún día el shape de WizardData / ResultadoCotizacion crece y este
// validador queda desactualizado, el efecto es descartar drafts viejos —
// nunca dejar pasar uno corrupto. El test de round-trip detecta eso.
import type {
  Cliente,
  ResultadoCotizacion,
  TipoEntrega,
  TipoTrabajoConcreto
} from '@shared/types'
import {
  TIPOS_TRABAJO_CONCRETO,
  TIPOS_ENTREGA,
  METODOS_PAGO
} from '@shared/types'
import { validarWizardData } from '../wizard/wizard-data-validation'
import type {
  AbonoEnSesion,
  DescuentoEnSesion,
  EstadoMultiTrabajo,
  TrabajoEnSesion
} from './types'

// -- Predicados primitivos --------------------------------------------------

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function esNumeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function esString(v: unknown): v is string {
  return typeof v === 'string'
}

function esTipoTrabajoConcreto(v: unknown): v is TipoTrabajoConcreto {
  return esString(v) && (TIPOS_TRABAJO_CONCRETO as readonly string[]).includes(v)
}

function esTipoEntrega(v: unknown): v is TipoEntrega {
  return esString(v) && (TIPOS_ENTREGA as readonly string[]).includes(v)
}

function esMetodoPago(v: unknown): boolean {
  return esString(v) && (METODOS_PAGO as readonly string[]).includes(v)
}

// -- Validadores de shape compuesto ----------------------------------------

function validarCliente(v: unknown): Cliente | null | undefined {
  if (v === null) return null
  if (!esObjeto(v)) return undefined
  // Campos mínimos que el render y el submit consumen.
  if (!esNumeroFinito(v.id) || v.id <= 0) return undefined
  if (!esString(v.nombre)) return undefined
  // Resto de campos los aceptamos por spread (Cliente puede crecer); si
  // falta alguno opcional la UI lo maneja.
  return v as unknown as Cliente
}

function validarCotizacion(v: unknown): ResultadoCotizacion | undefined {
  if (!esObjeto(v)) return undefined
  if (!Array.isArray(v.items)) return undefined
  // Los campos que CUALQUIER consumer derefa al renderizar o submitear.
  const finitosObligatorios: Array<keyof ResultadoCotizacion> = [
    'subtotal',
    'totalMateriales',
    'brutoCotizado',
    'precioLista',
    'precioTotal'
  ]
  for (const k of finitosObligatorios) {
    if (!esNumeroFinito(v[k as string])) return undefined
  }
  // Nullable finite.
  const nullableFinitos: Array<keyof ResultadoCotizacion> = [
    'costoEstimadoTotal',
    'margenEstimado',
    'margenEstimadoPct'
  ]
  for (const k of nullableFinitos) {
    const val = v[k as string]
    if (val !== null && !esNumeroFinito(val)) return undefined
  }
  if (!esString(v.estadoRentabilidad)) return undefined
  return v as unknown as ResultadoCotizacion
}

function validarTrabajo(v: unknown): TrabajoEnSesion | undefined {
  if (!esObjeto(v)) return undefined
  if (!esString(v.idLocal) || v.idLocal.length === 0) return undefined
  if (!esTipoTrabajoConcreto(v.tipoTrabajo)) return undefined
  const data = validarWizardData(v.data)
  if (!data) return undefined
  const cotizacion = validarCotizacion(v.cotizacion)
  if (!cotizacion) return undefined
  return {
    idLocal: v.idLocal,
    tipoTrabajo: v.tipoTrabajo,
    data,
    cotizacion
  }
}

function validarDescuento(v: unknown): DescuentoEnSesion | null | undefined {
  if (v === null) return null
  if (!esObjeto(v)) return undefined
  if (!esNumeroFinito(v.monto) || v.monto < 0) return undefined
  if (!esString(v.motivo)) return undefined
  return { monto: v.monto, motivo: v.motivo }
}

function validarAbono(v: unknown): AbonoEnSesion | null | undefined {
  if (v === null) return null
  if (!esObjeto(v)) return undefined
  if (!esNumeroFinito(v.monto) || v.monto < 0) return undefined
  if (!esMetodoPago(v.metodoPago)) return undefined
  if (!esString(v.fecha)) return undefined
  return {
    monto: v.monto,
    metodoPago: v.metodoPago as AbonoEnSesion['metodoPago'],
    fecha: v.fecha
  }
}

// -- Entry point -----------------------------------------------------------

/**
 * Valida un draft parseado de localStorage y devuelve un `EstadoMultiTrabajo`
 * seguro para inyectar en `useState`, o `null` si CUALQUIER campo está
 * malformado. Política: descartar el draft completo en vez de saneamiento
 * parcial — un draft inconsistente confunde más al usuario que perderlo.
 */
export function validarEstadoMultiTrabajo(parsed: unknown): EstadoMultiTrabajo | null {
  if (!esObjeto(parsed)) return null

  // trabajos: array obligatorio (puede estar vacío).
  if (!Array.isArray(parsed.trabajos)) return null
  const trabajos: TrabajoEnSesion[] = []
  for (const raw of parsed.trabajos) {
    const t = validarTrabajo(raw)
    if (!t) return null
    trabajos.push(t)
  }

  // cliente: null u objeto Cliente válido.
  const cliente = validarCliente(parsed.cliente)
  if (cliente === undefined) return null

  // descuento / abono: null u objeto válido.
  const descuento = validarDescuento(parsed.descuento)
  if (descuento === undefined) return null
  const abono = validarAbono(parsed.abono)
  if (abono === undefined) return null

  // tipoEntrega: enum.
  if (!esTipoEntrega(parsed.tipoEntrega)) return null

  // notas: string (puede estar vacía).
  if (!esString(parsed.notas)) return null

  // Fechas: string (no hacemos parseo profundo aquí — el componente espera
  // YYYY-MM-DD y los inputs lo manejan; un string mal formado se mostrará
  // como vacío en el input type="date").
  if (!esString(parsed.fechaIngreso)) return null
  if (parsed.fechaEntrega !== null && !esString(parsed.fechaEntrega)) return null

  return {
    cliente,
    trabajos,
    descuento,
    abono,
    tipoEntrega: parsed.tipoEntrega,
    notas: parsed.notas,
    fechaIngreso: parsed.fechaIngreso,
    fechaEntrega: parsed.fechaEntrega as string | null
  }
}
