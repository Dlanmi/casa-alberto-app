// Hook para inputs de MONTOS en pesos colombianos (COP). Resuelve un bug
// silencioso: los inputs que usaban `useDecimalInput` con `parseNumberInput`
// interpretaban el `.` como separador decimal, pero en Colombia el `.` es
// separador de miles ("86.000" = ochenta y seis mil). El resultado era que
// papá escribía "86.000", la UI lo mostraba sin quejarse, pero el estado
// guardaba `86` — y cobraba ~1000× menos sin aviso.
//
// Dos salvaguardas:
//   1. Parser dedicado `parseMoneyInput` que strippea puntos como miles.
//   2. Al perder el foco, reformatea el `raw` con `formatCOP` para que papá
//      VEA el monto tal como la app lo entendió. Si tipeó "86" y ve "$86"
//      (en vez de "$86.000"), el desajuste es evidente.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { parseMoneyInput } from './parse-input'
import { formatCOP } from './format'

type Options = { min?: number; max?: number }

export function useMoneyInput(
  value: number,
  onChange: (n: number) => void,
  opts: Options = {}
): {
  raw: string
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
} {
  const [raw, setRaw] = useState<string>(value > 0 ? formatCOP(value) : '')
  const optsRef = useRef(opts)
  optsRef.current = opts

  // Resync cuando el padre setea el valor externamente (reset del formulario,
  // navegación entre pasos, pre-carga desde DB). Si lo que papá está tipeando
  // ya parsea al mismo número, respetamos el raw (estados intermedios tipo
  // "86." o "1.234," donde ya hay un número válido aunque la cadena sea parcial).
  useEffect(() => {
    const parsed = parseMoneyInput(raw, optsRef.current)
    if (parsed !== value) {
      setRaw(value > 0 ? formatCOP(value) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setRaw(next)
    onChange(parseMoneyInput(next, optsRef.current))
  }

  // Al salir del foco reformateamos el raw con `formatCOP` — esto hace visible
  // cualquier malentendido (si papá tipeó "86" y quería miles, ve "$86" y se
  // da cuenta; si tipeó "86.000" y la app lo entendió bien, ve "$86.000").
  const handleBlur = (): void => {
    if (value > 0) setRaw(formatCOP(value))
    else setRaw('')
  }

  return { raw, handleChange, handleBlur }
}
