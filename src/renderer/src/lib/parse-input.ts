// Parse seguro para inputs numéricos con decimales.
// `Number('abc') || 0` esconde typos (NaN pasa silencioso como 0); pero
// `Number.parseInt` estripa decimales, rompiendo medidas como 43.32 cm que
// son comunes en enmarcación. Usamos parseFloat + normalización de coma
// decimal (en Colombia "43,32" es una captura típica).
//
// IMPORTANTE: este parser está diseñado SOLO para medidas (cm, m², etc.)
// donde el punto SÍ es separador decimal. Para montos en pesos colombianos
// usa `parseMoneyInput` — el punto allá es separador de miles y leer "86.000"
// como 86 provoca pérdida silenciosa de dinero.
export function parseNumberInput(raw: string, opts: { min?: number; max?: number } = {}): number {
  const normalizado = raw.replace(',', '.')
  const n = Number.parseFloat(normalizado)
  if (!Number.isFinite(n)) return 0
  const min = opts.min ?? 0
  const max = opts.max ?? Number.MAX_SAFE_INTEGER
  if (n < min) return min
  if (n > max) return max
  return n
}

// Parser específico para montos en pesos colombianos (COP). A diferencia de
// `parseNumberInput`, aquí el punto es SEPARADOR DE MILES (no decimal) y la
// coma es el separador decimal. Esto evita que papá escriba "86.000" y el
// sistema lo guarde como 86 — un bug silencioso que cobraba ~1000× menos.
//
// Reglas:
//   - Todos los puntos se eliminan (miles): "86.000" → "86000".
//   - La primera coma se convierte a punto decimal: "1.234,50" → 1234.5.
//   - Caracteres no numéricos (símbolo $, espacios) se ignoran vía parseFloat.
//   - Vacío, NaN o negativo devuelven 0.
//
// Clamp opcional con min/max como `parseNumberInput`.
export function parseMoneyInput(raw: string, opts: { min?: number; max?: number } = {}): number {
  // Permitimos que el usuario escriba "$", espacios y separadores — los
  // limpiamos antes de normalizar miles/decimales.
  const limpio = raw.replace(/[^\d.,-]/g, '')
  const sinMiles = limpio.replace(/\./g, '')
  const normalizado = sinMiles.replace(',', '.')
  const n = Number.parseFloat(normalizado)
  if (!Number.isFinite(n)) return 0
  const min = opts.min ?? 0
  const max = opts.max ?? Number.MAX_SAFE_INTEGER
  if (n < min) return min
  if (n > max) return max
  return n
}
