// Validadores de identificadores de contacto (cédula, teléfono, correo).
// Centralizan reglas que antes vivían duplicadas en cada query/handler.
//
// IMPORTANTE: estas funciones NORMALIZAN el valor además de validarlo —
// devuelven el valor canónico listo para ir a la DB. El caller debe usar
// el retorno, no el input original.

const RE_CEDULA_LIMPIA = /[\s./-]+/g
const RE_TELEFONO_LIMPIA = /[\s()+.-]+/g
// Regex de correo afinada para captar errores típicos sin rechazar correos
// válidos. No abarca todos los RFC 5322 edge cases.
const RE_CORREO = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * Limpia y valida un teléfono. Acepta formatos con paréntesis, guiones,
 * `+`, espacios. Devuelve solo dígitos. Rango: 7-15 dígitos.
 *
 * @throws Error si el teléfono no es válido (vacío, no string, fuera de rango).
 */
export function validarTelefono(
  valor: unknown,
  opts: { campo?: string; requerido?: boolean } = {}
): string {
  const campo = opts.campo ?? 'El teléfono'
  const requerido = opts.requerido !== false

  if (typeof valor !== 'string') {
    if (valor == null && !requerido) return ''
    throw new Error(`${campo} debe ser texto`)
  }
  const limpio = valor.replace(RE_TELEFONO_LIMPIA, '')
  if (limpio.length === 0) {
    if (requerido) throw new Error(`${campo} es obligatorio`)
    return ''
  }
  if (!/^\d+$/.test(limpio)) {
    throw new Error(`${campo} solo puede contener números`)
  }
  if (limpio.length < 7) {
    throw new Error(`${campo} debe tener al menos 7 dígitos`)
  }
  if (limpio.length > 15) {
    throw new Error(`${campo} no puede tener más de 15 dígitos`)
  }
  return limpio
}

/** Versión opcional de validarTelefono — devuelve null si vacío. */
export function validarTelefonoOpcional(
  valor: unknown,
  opts: { campo?: string } = {}
): string | null {
  const out = validarTelefono(valor, { ...opts, requerido: false })
  return out.length > 0 ? out : null
}

/**
 * Limpia y valida una cédula. Acepta puntos, guiones, espacios — devuelve
 * solo dígitos. Rango: 6-15 dígitos.
 *
 * @throws Error si la cédula no es válida.
 */
export function validarCedula(
  valor: unknown,
  opts: { campo?: string; requerido?: boolean } = {}
): string {
  const campo = opts.campo ?? 'La cédula'
  const requerido = opts.requerido !== false

  if (typeof valor !== 'string') {
    if (valor == null && !requerido) return ''
    throw new Error(`${campo} debe ser texto`)
  }
  const limpia = valor.replace(RE_CEDULA_LIMPIA, '')
  if (limpia.length === 0) {
    if (requerido) throw new Error(`${campo} es obligatoria`)
    return ''
  }
  if (!/^\d+$/.test(limpia)) {
    throw new Error(`${campo} solo puede contener números`)
  }
  if (limpia.length < 6) {
    throw new Error(`${campo} debe tener al menos 6 dígitos`)
  }
  if (limpia.length > 15) {
    throw new Error(`${campo} no puede tener más de 15 dígitos`)
  }
  return limpia
}

/** Versión opcional — null si vacía. */
export function validarCedulaOpcional(
  valor: unknown,
  opts: { campo?: string } = {}
): string | null {
  const out = validarCedula(valor, { ...opts, requerido: false })
  return out.length > 0 ? out : null
}

/**
 * Valida un correo electrónico. Devuelve el correo trimeado.
 *
 * @throws Error si el formato es inválido.
 */
export function validarCorreo(
  valor: unknown,
  opts: { campo?: string; requerido?: boolean } = {}
): string {
  const campo = opts.campo ?? 'El correo'
  const requerido = opts.requerido !== false

  if (typeof valor !== 'string') {
    if (valor == null && !requerido) return ''
    throw new Error(`${campo} debe ser texto`)
  }
  const trimmed = valor.trim()
  if (trimmed.length === 0) {
    if (requerido) throw new Error(`${campo} es obligatorio`)
    return ''
  }
  if (trimmed.length > 120) {
    throw new Error(`${campo} es demasiado largo`)
  }
  if (!RE_CORREO.test(trimmed)) {
    throw new Error(`${campo} no tiene formato válido (debe ser usuario@dominio.com)`)
  }
  return trimmed
}

export function validarCorreoOpcional(
  valor: unknown,
  opts: { campo?: string } = {}
): string | null {
  const out = validarCorreo(valor, { ...opts, requerido: false })
  return out.length > 0 ? out : null
}
