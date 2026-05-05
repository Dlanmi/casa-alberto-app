// Hooks para inputs de texto con normalización automática:
//   - `useTextInput`: trim al perder foco, opcional max length, opcional
//     rechazo de caracteres de control.
//   - `useCedulaInput`: limpia puntos/espacios/guiones que el dueño copia
//     desde otro lado ("001.234.567" → "001234567").
//   - `useTelefonoInput`: limpia paréntesis/guiones/+/espacios
//     ("+57 (601) 456-7890" → "576014567890").
//
// Todos siguen el mismo patrón: `value` numérico/string canónico vive en el
// padre, `raw` es el que muestra el input. El reformateo ocurre en blur.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

// Eliminamos caracteres de control (NUL, escape, etc.) que pueden colarse
// con copy-paste desde Word/Excel y causan problemas en SQL/PDF/UI.
// Mantenemos: tab (\t = \x09), line feed (\n = \x0a), carriage return
// (\r = \x0d) — útiles en notas multilínea.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

function sanitizarControlChars(s: string): string {
  return s.replace(CONTROL_CHARS_RE, '')
}

// ---------------------------------------------------------------------------
// useTextInput — texto libre con trim/max/sanitize
// ---------------------------------------------------------------------------

type TextOptions = {
  /** Recorte al final del campo (entre 1 y este número). Default sin límite. */
  maxLength?: number
  /** Si true (default), elimina control chars como NUL, escape, etc. */
  sanitizeControl?: boolean
}

export function useTextInput(
  value: string,
  onChange: (s: string) => void,
  opts: TextOptions = {}
): {
  raw: string
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleBlur: () => void
} {
  const [raw, setRaw] = useState<string>(value)
  const optsRef = useRef(opts)
  optsRef.current = opts

  // Sincroniza el raw mostrado cuando el padre setea `value` externamente
  // (reset de form, pre-carga de un draft, navegación). Si el caller cambia
  // `value` por algo distinto al raw actual, lo reflejamos. La regla anterior
  // dejaba el raw con espacios cuando el padre confirmaba el trim — ahora
  // siempre prevalece el value canónico del padre.
  useEffect(() => {
    if (value !== raw) {
      setRaw(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const sanitizar = (s: string): string => {
    let out = optsRef.current.sanitizeControl !== false ? sanitizarControlChars(s) : s
    const max = optsRef.current.maxLength
    if (max != null && out.length > max) out = out.slice(0, max)
    return out
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const next = sanitizar(e.target.value)
    setRaw(next)
    onChange(next)
  }

  // En blur trimeamos. El raw mostrado refleja el valor canónico.
  const handleBlur = (): void => {
    const trimmed = raw.trim()
    if (trimmed !== raw) {
      setRaw(trimmed)
      onChange(trimmed)
    }
  }

  return { raw, handleChange, handleBlur }
}

// ---------------------------------------------------------------------------
// useCedulaInput — cédula colombiana, solo dígitos, 6-15 chars
// ---------------------------------------------------------------------------

const RE_CEDULA_LIMPIA = /[\s./-]+/g

function limpiarCedula(s: string): string {
  return s.replace(RE_CEDULA_LIMPIA, '').replace(/[^\d]/g, '')
}

export function useCedulaInput(
  value: string,
  onChange: (s: string) => void
): {
  raw: string
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
} {
  const [raw, setRaw] = useState<string>(value)

  useEffect(() => {
    if (value !== limpiarCedula(raw)) setRaw(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setRaw(next)
    onChange(limpiarCedula(next))
  }

  // En blur mostramos la versión limpia (solo dígitos). Si pegó
  // "001.234.567", verá "001234567" — confirma cómo la app lo entendió.
  const handleBlur = (): void => {
    setRaw(limpiarCedula(raw))
  }

  return { raw, handleChange, handleBlur }
}

// ---------------------------------------------------------------------------
// useTelefonoInput — teléfono colombiano, solo dígitos, 7-15 chars
// ---------------------------------------------------------------------------

const RE_TELEFONO_LIMPIA = /[\s()+.-]+/g

function limpiarTelefono(s: string): string {
  return s.replace(RE_TELEFONO_LIMPIA, '').replace(/[^\d]/g, '')
}

export function useTelefonoInput(
  value: string,
  onChange: (s: string) => void
): {
  raw: string
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
} {
  const [raw, setRaw] = useState<string>(value)

  useEffect(() => {
    if (value !== limpiarTelefono(raw)) setRaw(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setRaw(next)
    onChange(limpiarTelefono(next))
  }

  const handleBlur = (): void => {
    setRaw(limpiarTelefono(raw))
  }

  return { raw, handleChange, handleBlur }
}

// Helpers exportados para tests y consumo directo.
export const __helpers__ = { sanitizarControlChars, limpiarCedula, limpiarTelefono }
