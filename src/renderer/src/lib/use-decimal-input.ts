// Hook para inputs numéricos con decimales (medidas en cm). Necesitan
// guardar el texto crudo: si se controla el `<input>` con el número
// parseado, el estado "43." cae a 43 y el punto desaparece antes de que
// el dueño alcance a tipear el decimal. Solución: estado local string,
// el padre solo ve el número parseado, y un efecto sincroniza cuando
// el padre resetea el valor.
//
// Reformateo en blur: cuando el dueño sale del campo, mostramos el número
// canónico. Si tipeó "43,32" ve "43.32" — confirmación. Si tipeó "abc"
// ve "" — error visible sin necesidad de mensaje.
//
// Para montos en pesos colombianos usar `useMoneyInput` — el `.` allá
// es separador de miles, no decimal.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { parseNumberInput } from './parse-input'

type Options = { min?: number; max?: number }

export function useDecimalInput(
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

  // Resync cuando el padre setea el valor externamente (reset, navegación,
  // pre-carga de draft). Si la raw actual ya parsea al mismo número,
  // respetamos lo que el papá está tipeando (incluye estados intermedios
  // como "43." o "43," donde el número ya es 43 pero la cadena aún no).
  useEffect(() => {
    const parsed = parseNumberInput(raw, optsRef.current)
    if (parsed !== value) {
      setRaw(value > 0 ? String(value) : '')
    }
    // `raw` se lee con el valor más fresco a propósito; no queremos re-correr
    // cuando cambia `raw` (eso lo maneja handleChange localmente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setRaw(next)
    onChange(parseNumberInput(next, optsRef.current))
  }

  // Al salir del foco mostramos el número canónico. Si el dueño tipeó algo
  // no numérico, ve el campo vacío y se da cuenta del error inmediato.
  const handleBlur = (): void => {
    if (value > 0) setRaw(String(value))
    else setRaw('')
  }

  return { raw, handleChange, handleBlur }
}
