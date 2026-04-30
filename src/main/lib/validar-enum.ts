// Defense in depth para handlers IPC que reciben valores de enum como
// `estado`, `tipo`, `metodoPago`. TypeScript protege en compile-time,
// pero un IPC bypass o un payload corrupto puede colar un string fuera
// del enum: la query lo pasa a SQLite y el CHECK constraint dispara un
// error críptico de Drizzle ("constraint failed: ..."), que no es
// procesable por el renderer ni legible para el usuario.
//
// Validar antes del query produce un error legible con el campo y los
// valores aceptados.
export function validarEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  campo: string = 'valor'
): T {
  if (typeof value !== 'string') {
    throw new Error(`${campo} debe ser un string`)
  }
  if (!allowed.includes(value as T)) {
    throw new Error(`${campo} debe ser uno de: ${allowed.join(', ')}`)
  }
  return value as T
}
