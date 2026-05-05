// Validador de strings para handlers IPC. Defense in depth:
//   - rechaza tipos no-string
//   - trim automático
//   - rangos de longitud
//   - opcional: rechazo de control chars (NUL, escape, etc.) que pueden
//     romper SQL/PDF/UI si llegan desde copy-paste de Word/Excel.
//
// Se usa en handlers que reciben strings que van directo a la DB sin más
// procesamiento (nombre, descripción, notas, dirección).
//
// Para teléfono usar `validarTelefono`. Para cédula usar `validarCedula`.
// Para correo usar `validarCorreo`.

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/

export type ValidarTextoOptions = {
  /** Longitud mínima DESPUÉS de trim. Default 0. */
  min?: number
  /** Longitud máxima DESPUÉS de trim. Default 1000. */
  max?: number
  /** Si false, valor vacío/whitespace es válido y devuelve ''. Default true. */
  requerido?: boolean
  /** Si true, los control chars hacen tirar error. Default true. */
  rechazarControlChars?: boolean
  /** Nombre del campo para mensajes de error. */
  campo?: string
}

/**
 * Valida y limpia un string. Devuelve el valor trimeado.
 *
 * @throws Error con mensaje legible si el valor es inválido.
 */
export function validarTexto(valor: unknown, opts: ValidarTextoOptions = {}): string {
  const campo = opts.campo ?? 'El texto'
  const min = opts.min ?? 0
  const max = opts.max ?? 1000
  const requerido = opts.requerido !== false
  const rechazarControl = opts.rechazarControlChars !== false

  if (typeof valor !== 'string') {
    if (valor == null && !requerido) return ''
    throw new Error(`${campo} debe ser texto`)
  }

  if (rechazarControl && CONTROL_CHARS_RE.test(valor)) {
    throw new Error(`${campo} contiene caracteres no permitidos`)
  }

  const trimmed = valor.trim()

  if (trimmed.length === 0) {
    if (requerido) throw new Error(`${campo} no puede estar vacío`)
    return ''
  }

  if (trimmed.length < min) {
    throw new Error(`${campo} debe tener al menos ${min} caracteres`)
  }
  if (trimmed.length > max) {
    throw new Error(`${campo} no puede tener más de ${max} caracteres`)
  }

  return trimmed
}

/** Helper: valida un texto opcional y devuelve `null` si está vacío. */
export function validarTextoOpcional(
  valor: unknown,
  opts: Omit<ValidarTextoOptions, 'requerido'> = {}
): string | null {
  const out = validarTexto(valor, { ...opts, requerido: false })
  return out.length > 0 ? out : null
}
