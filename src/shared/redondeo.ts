// Fase 2 · UX — el total final del cotizador se redondea hacia arriba al
// múltiplo de $1.000 más cercano. Decisión del papá: prefiere cobrar $86.000
// y no $85.564 aunque los items sumen lo segundo; más fácil de contar en
// efectivo y se lee más profesional en factura. La diferencia (hasta $999)
// se absorbe en silencio — no se muestra una línea "Ajuste" porque el papá
// no quiere explicar al cliente por qué hay un delta.
export const REDONDEO_PRECIO_FINAL_COP = 1000

export function redondearPrecioFinal(bruto: number): number {
  if (!Number.isFinite(bruto) || bruto <= 0) return 0
  return Math.ceil(bruto / REDONDEO_PRECIO_FINAL_COP) * REDONDEO_PRECIO_FINAL_COP
}
