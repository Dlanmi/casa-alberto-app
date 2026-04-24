import type { EntregaDelDia } from '@shared/types'
import { finSemana, inicioSemana, toFechaISO } from '@renderer/lib/format'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve las entregas de la semana actual (lunes a domingo).
 * Usado por el HelpButton en /agenda para el tip de "resumen semanal"
 * y en el dashboard para contexto general.
 *
 * El rango se calcula con la fecha local al instante de la consulta.
 */
export function useEntregasSemana(): {
  data: EntregaDelDia[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<EntregaDelDia[]>(() => {
    const hoy = new Date()
    const desde = toFechaISO(inicioSemana(hoy))
    const hasta = toFechaISO(finSemana(hoy))
    return window.api.pedidos.entregasEnRango(desde, hasta)
  }, [])
}
