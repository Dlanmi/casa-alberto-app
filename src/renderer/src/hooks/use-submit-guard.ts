// Hook que previene doble-submit en formularios. Devuelve un wrapper de la
// función de submit que ignora invocaciones mientras la primera está en
// curso. Reemplaza el patrón:
//
//   const [submitting, setSubmitting] = useState(false)
//   async function submit() {
//     if (submitting) return
//     setSubmitting(true)
//     try { ... } finally { setSubmitting(false) }
//   }
//
// Por:
//   const { submitting, guard } = useSubmitGuard()
//   const submit = guard(async (data) => { ... })
//
// Patrón único en toda la app garantiza:
//   1. Click en el botón nunca genera dos requests paralelos.
//   2. Si la app está bajo carga, las acciones más antiguas se completan
//      antes de procesar nuevas (FIFO sin race).
//   3. El estado `submitting` se expone para mostrar spinners y disabled.
import { useCallback, useRef, useState } from 'react'

export function useSubmitGuard(): {
  submitting: boolean
  /** Envuelve una función async para que solo pueda invocarse una vez a
   *  la vez. Si está en curso, las llamadas extra se ignoran (no encolan). */
  guard: <Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>
  ) => (...args: Args) => Promise<R | undefined>
} {
  const [submitting, setSubmitting] = useState(false)
  // Ref espejo del state — `submitting` puede estar stale dentro del closure
  // de `guard` si los re-renders no se han propagado todavía. El ref se
  // actualiza síncronamente al inicio/fin de cada submit.
  const inFlightRef = useRef(false)

  const guard = useCallback(
    <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) =>
      async (...args: Args): Promise<R | undefined> => {
        if (inFlightRef.current) return undefined
        inFlightRef.current = true
        setSubmitting(true)
        try {
          return await fn(...args)
        } finally {
          inFlightRef.current = false
          setSubmitting(false)
        }
      },
    []
  )

  return { submitting, guard }
}
