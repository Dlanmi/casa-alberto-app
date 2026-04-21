// Sprint 2 · C5 (fix) — parse seguro para inputs numéricos con decimales.
// `Number('abc') || 0` esconde typos (NaN pasa silencioso como 0); pero
// `Number.parseInt` estripa decimales, rompiendo medidas como 43.32 cm que
// son comunes en enmarcación. Usamos parseFloat + normalización de coma
// decimal (en Colombia "43,32" es una captura típica).
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
