// Defense in depth para handlers IPC que reciben IDs de fila (clientes,
// pedidos, facturas, clases, etc.). El renderer pasa números tipados en
// TypeScript, pero un IPC bypass o un payload corrupto puede meter un
// `3.14`, `NaN`, `Infinity`, string o `null`.
//
// Sin guard, JS castea silenciosamente: `db.where(eq(table.id, 3.14))`
// busca la fila `3` y retorna datos de otra entidad sin error visible.
// Este helper rechaza cualquier valor que no sea un entero positivo.
export function validarId(value: unknown, campo: string = 'id'): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${campo} debe ser un entero válido`)
  }
  if (value <= 0) {
    throw new Error(`${campo} debe ser mayor a 0`)
  }
  return value
}
