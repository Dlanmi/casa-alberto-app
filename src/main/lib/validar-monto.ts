// Defense in depth para handlers IPC numéricos. El renderer pasa números
// que en TypeScript están tipados, pero en runtime un renderer comprometido,
// un payload corrupto o un cast accidental puede meter `Infinity`, `NaN`,
// `-0`, strings, null o undefined. Sin guard, esos valores entran a la DB
// y corrompen totales/cálculos sin que nadie se entere.
//
// Aplicar en cada handler que reciba un campo numérico de plata o cantidad.
// Para porcentajes/IDs/fechas usar validadores específicos (no este).
export function validarMonto(
  n: unknown,
  opts: { min?: number; max?: number; campo?: string } = {}
): number {
  const campo = opts.campo ?? 'Monto'
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`${campo} no es un número finito válido`)
  }
  const min = opts.min ?? 0
  if (n < min) {
    throw new Error(`${campo} no puede ser menor a ${min}`)
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new Error(`${campo} excede el máximo permitido (${opts.max})`)
  }
  return n
}
