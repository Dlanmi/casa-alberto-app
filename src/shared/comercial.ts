// Lógica compartida del ajuste comercial: descuento, precio final, margen.
//
// Vive en @shared/ porque tanto el renderer (paneles, wizard) como el main
// (validación al crear pedido, persistencia) deben evaluar la rentabilidad
// con la MISMA fórmula. Antes existían dos copias divergentes (una en
// step-resumen.tsx, otra en pedidos.ts) que podían dar estados distintos
// para los mismos datos. Ahora todos importan desde aquí.
import { redondearPrecioFinal, REDONDEO_PRECIO_FINAL_COP } from './redondeo'

export type EstadoRentabilidad = 'saludable' | 'baja' | 'critica' | 'incompleta'

export type EvaluacionComercial = {
  /** Precio sugerido (precio_lista en pedidos), redondeado al múltiplo de $1.000. */
  precioSugerido: number
  /** Descuento efectivo aplicado. Puede diferir del solicitado si auto-redondeo está activo. */
  descuentoMonto: number
  /** Descuento solicitado por el usuario (antes de auto-redondeo). */
  descuentoSolicitado: number
  /** Precio final = precio sugerido − descuento. Siempre múltiplo de $1.000 cuando se ejecuta auto-redondeo. */
  precioFinal: number
  /** Costo estimado total (suma de todos los items). null si algún item no tiene costo. */
  costoEstimado: number | null
  /** Margen final = precio final − costo. null si costo es null. */
  margenEstimado: number | null
  /** Margen como porcentaje del precio final. null si costo es null o precio final es 0. */
  margenEstimadoPct: number | null
  /**
   * Estado interpretable:
   *  - 'incompleta': falta costo en al menos un item; el margen no es confiable.
   *  - 'critica': margen <= 0 (estás perdiendo plata o regalando).
   *  - 'baja': margen positivo pero por debajo del umbral mínimo configurado.
   *  - 'saludable': margen >= umbral mínimo configurado.
   */
  estadoRentabilidad: EstadoRentabilidad
}

export type EvaluarComercialInput = {
  precioSugerido: number
  descuentoMonto: number
  costoEstimado: number | null
  margenMinimoAlertaPct: number
  /**
   * D2 — auto-redondear precio final al múltiplo de $1.000. Si activo,
   * el descuento efectivo se ajusta hacia arriba para que precioFinal
   * caiga en un millar. Default: true (decisión del dueño).
   */
  autoRedondear?: boolean
}

/**
 * Calcula la evaluación comercial del pedido aplicando descuento y derivando
 * margen + estado. Función pura: mismos inputs → mismos outputs.
 *
 * @example
 * calcularEvaluacionComercial({
 *   precioSugerido: 138_000,
 *   descuentoMonto: 5_500,
 *   costoEstimado: 80_000,
 *   margenMinimoAlertaPct: 20,
 *   autoRedondear: true
 * })
 * // { precioFinal: 132_000, descuentoMonto: 6_000, descuentoSolicitado: 5_500,
 * //   margenEstimado: 52_000, margenEstimadoPct: 39.39, estadoRentabilidad: 'saludable' }
 */
export function calcularEvaluacionComercial(input: EvaluarComercialInput): EvaluacionComercial {
  const precioSugerido = Math.max(0, Math.round(input.precioSugerido))
  const descuentoSolicitado = Math.max(0, Math.round(input.descuentoMonto))
  const descuentoBase = Math.min(descuentoSolicitado, precioSugerido)
  const autoRedondear = input.autoRedondear !== false

  let descuentoMonto = descuentoBase
  let precioFinal = precioSugerido - descuentoBase

  if (autoRedondear && precioFinal > 0) {
    // Redondea precioFinal al múltiplo de $1.000 más cercano (priorizando
    // hacia abajo para favorecer al cliente: si el precio queda en $132.499,
    // bajamos a $132.000, no subimos a $133.000). Si descuento solicitado es 0,
    // no hay nada que redondear.
    if (descuentoBase > 0) {
      const redondeado = Math.floor(precioFinal / REDONDEO_PRECIO_FINAL_COP) * REDONDEO_PRECIO_FINAL_COP
      // Si el redondeo bajaría a 0 (descuento muy cercano al precio), preferimos
      // dejar precioFinal en el múltiplo mínimo y reducir el descuento.
      precioFinal = redondeado > 0 ? redondeado : precioFinal
      descuentoMonto = precioSugerido - precioFinal
    }
  }

  // Permite descuento del 100% (regalo): precioFinal = 0 con descuentoBase
  // exactamente igual a precioSugerido. Ese caso pasa intacto sin redondear.

  const costoEstimado = input.costoEstimado
  let margenEstimado: number | null = null
  let margenEstimadoPct: number | null = null
  let estadoRentabilidad: EstadoRentabilidad

  if (costoEstimado === null) {
    estadoRentabilidad = 'incompleta'
  } else {
    margenEstimado = precioFinal - costoEstimado
    margenEstimadoPct =
      precioFinal > 0 ? Math.round((margenEstimado / precioFinal) * 10000) / 100 : 0
    if (margenEstimado <= 0) {
      estadoRentabilidad = 'critica'
    } else if (margenEstimadoPct < input.margenMinimoAlertaPct) {
      estadoRentabilidad = 'baja'
    } else {
      estadoRentabilidad = 'saludable'
    }
  }

  return {
    precioSugerido,
    descuentoSolicitado,
    descuentoMonto,
    precioFinal,
    costoEstimado,
    margenEstimado,
    margenEstimadoPct,
    estadoRentabilidad
  }
}

/**
 * Genera sugerencias de "Dejar total cerrado en $X" para el botón de cierre
 * comercial. Devuelve hasta 3 valores múltiplos limpios menores al precio
 * sugerido, ordenados de mayor a menor (el más cercano primero).
 */
export function sugerenciasDejarEnTotal(precioSugerido: number, max = 3): number[] {
  if (!Number.isFinite(precioSugerido) || precioSugerido <= 0) return []
  const candidatos = new Set<number>()
  for (const escalon of [1000, 5000, 10000]) {
    const valor = Math.floor(precioSugerido / escalon) * escalon
    if (valor > 0 && valor < precioSugerido) candidatos.add(valor)
  }
  return Array.from(candidatos)
    .sort((a, b) => b - a)
    .slice(0, max)
}

void redondearPrecioFinal
