// Validadores de relaciones entre múltiples valores.
//
// Usados cuando una validación depende de DOS o más campos (ej. fecha
// entrega ≥ fecha ingreso, hora inicio < hora fin).
import { validarFechaISO } from './validar-fecha'

/**
 * Valida que `hasta` sea ≥ `desde`. Si alguno está vacío, NO falla — el
 * caller debe validar requeridos por su lado. Útil para rangos donde
 * uno o ambos extremos son opcionales.
 *
 * @throws Error si las fechas existen y `hasta < desde`.
 */
export function validarRangoFechas(
  desde: unknown,
  hasta: unknown,
  opts: { campoDesde?: string; campoHasta?: string } = {}
): void {
  const campoDesde = opts.campoDesde ?? 'fecha desde'
  const campoHasta = opts.campoHasta ?? 'fecha hasta'

  // Si alguno no es string, asumimos que el caller ya validó o que
  // simplemente no aplica. No hacemos throw — solo verificamos relación.
  if (typeof desde !== 'string' || typeof hasta !== 'string') return
  if (desde === '' || hasta === '') return

  // Validar formato individual antes de comparar.
  validarFechaISO(desde, 'YYYY-MM-DD', campoDesde)
  validarFechaISO(hasta, 'YYYY-MM-DD', campoHasta)

  if (hasta < desde) {
    throw new Error(
      `La ${campoHasta} no puede ser anterior a la ${campoDesde}`
    )
  }
}

/**
 * Valida un porcentaje (0-100 por default). Útil para retención, descuento
 * porcentual, margen, etc.
 *
 * @throws Error si fuera de rango o no es número finito.
 */
export function validarPorcentaje(
  valor: unknown,
  opts: { min?: number; max?: number; campo?: string } = {}
): number {
  const campo = opts.campo ?? 'El porcentaje'
  const min = opts.min ?? 0
  const max = opts.max ?? 100
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new Error(`${campo} no es un número válido`)
  }
  if (valor < min) {
    throw new Error(`${campo} no puede ser menor a ${min}%`)
  }
  if (valor > max) {
    throw new Error(`${campo} no puede ser mayor a ${max}%`)
  }
  return valor
}

/**
 * Valida que `inicio < fin` para un horario en formato "HH:MM" o "HH:MM:SS".
 *
 * @throws Error si el formato es inválido o si fin <= inicio.
 */
export function validarHorarioOrdenado(
  inicio: unknown,
  fin: unknown,
  opts: { campoInicio?: string; campoFin?: string } = {}
): void {
  const campoInicio = opts.campoInicio ?? 'hora de inicio'
  const campoFin = opts.campoFin ?? 'hora de fin'

  if (typeof inicio !== 'string' || typeof fin !== 'string') {
    throw new Error(`Las horas deben ser texto`)
  }
  const reHora = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
  if (!reHora.test(inicio)) {
    throw new Error(`La ${campoInicio} no tiene formato válido (HH:MM)`)
  }
  if (!reHora.test(fin)) {
    throw new Error(`La ${campoFin} no tiene formato válido (HH:MM)`)
  }
  // Comparación lexicográfica funciona porque ambas tienen el mismo formato.
  if (fin <= inicio) {
    throw new Error(`La ${campoFin} debe ser posterior a la ${campoInicio}`)
  }
}
