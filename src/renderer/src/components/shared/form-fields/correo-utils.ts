// Helper de validación de correos. En módulo separado del componente para
// que pueda importarse desde código no-React (ej. tests, validación
// imperativa fuera de un form).
//
// Regex razonablemente estricta: usuario @ dominio . tld de 2+ chars.
// No abarca TODOS los RFC 5322 edge cases (que aceptan strings raros) —
// está afinada para captar errores típicos del dueño sin rechazar correos
// reales válidos.
const RE_CORREO = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function esCorreoValido(s: string): boolean {
  return RE_CORREO.test(s.trim())
}
