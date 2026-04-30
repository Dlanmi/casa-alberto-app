// Defense in depth para queries que reciben fechas como string desde el
// renderer y las comparan o las pasan a SQLite. El comparador `<`/`>`
// sobre strings es una comparación lexicográfica: `"2026-13-50"` pasa por
// "anterior a 2026-04-25" porque `"3" < "4"` por carácter, lo cual es
// falso semánticamente.
//
// Aceptamos dos formatos:
//   - 'YYYY-MM-DD' para fechas calendario (entrega, pago, etc.)
//   - 'YYYY-MM' para identificar un mes (mensualidad de clase, reportes)
//
// Validamos forma sintáctica + roundtrip por `new Date(...)` para
// rechazar fechas imposibles (mes 13, día 32, etc.).
export type FechaFormato = 'YYYY-MM-DD' | 'YYYY-MM'

const REGEX_FECHA: Record<FechaFormato, RegExp> = {
  'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
  'YYYY-MM': /^\d{4}-\d{2}$/
}

export function validarFechaISO(
  raw: unknown,
  formato: FechaFormato = 'YYYY-MM-DD',
  campo: string = 'fecha'
): string {
  if (typeof raw !== 'string') {
    throw new Error(`${campo} debe ser un string ${formato}`)
  }
  if (!REGEX_FECHA[formato].test(raw)) {
    throw new Error(`${campo} debe tener formato ${formato}`)
  }

  // Validar que la fecha existe realmente. Para 'YYYY-MM-DD' usamos
  // Date.UTC para evitar drift por timezone local del runner. Para
  // 'YYYY-MM', construimos el primer día del mes.
  if (formato === 'YYYY-MM-DD') {
    const [y, m, d] = raw.split('-').map((n) => Number.parseInt(n, 10))
    const date = new Date(Date.UTC(y, m - 1, d))
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      throw new Error(`${campo} no es una fecha válida (${raw})`)
    }
  } else {
    const [y, m] = raw.split('-').map((n) => Number.parseInt(n, 10))
    if (m < 1 || m > 12) {
      throw new Error(`${campo} no es un mes válido (${raw})`)
    }
    if (y < 2000 || y > 2100) {
      throw new Error(`${campo} año fuera de rango razonable (${raw})`)
    }
  }

  return raw
}
