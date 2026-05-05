// Hook para inputs de cantidades ENTERAS (cantidad de items, stock, etc.).
//
// Diferencia con useDecimalInput:
//   - Solo acepta dígitos. Si el dueño tipea ".", "," o letras, los
//     ignoramos al parsear.
//   - Reformatea en blur al entero más cercano del rango permitido.
//
// No usar para montos en pesos (el dueño puede querer escribir decimales
// en algunos casos) — para eso está `useMoneyInput`. No usar para medidas
// en cm — para eso está `useDecimalInput`.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

type Options = { min?: number; max?: number }

function parseInteger(raw: string, opts: Options = {}): number {
  // `parseInt` se detiene en el primer carácter no-numérico, así que
  // "1.5" → 1, "1,5" → 1, "abc" → NaN. Solo limpiamos espacios al inicio
  // para que "  42  " parsee bien sin contaminar el truncado de decimales.
  const limpio = raw.trim()
  const n = Number.parseInt(limpio, 10)
  if (!Number.isFinite(n)) return opts.min ?? 0
  const min = opts.min ?? 0
  const max = opts.max ?? Number.MAX_SAFE_INTEGER
  if (n < min) return min
  if (n > max) return max
  return n
}

export function useIntegerInput(
  value: number,
  onChange: (n: number) => void,
  opts: Options = {}
): {
  raw: string
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
} {
  const [raw, setRaw] = useState<string>(value > 0 ? String(value) : '')
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const parsed = parseInteger(raw, optsRef.current)
    if (parsed !== value) {
      setRaw(value > 0 ? String(value) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setRaw(next)
    onChange(parseInteger(next, optsRef.current))
  }

  const handleBlur = (): void => {
    if (value > 0) setRaw(String(value))
    else setRaw('')
  }

  return { raw, handleChange, handleBlur }
}
