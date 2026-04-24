import type { EntregaDelDia } from '@shared/types'
import { hoyISO } from '@renderer/lib/format'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve las entregas programadas para HOY (fecha local).
 * Usado por el HelpButton en /agenda y dashboard para armar la lista
 * accionable "Entregas de hoy" con botones para llamar al cliente y
 * abrir el pedido.
 */
export function useEntregasHoy(): {
  data: EntregaDelDia[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<EntregaDelDia[]>(() => {
    const hoy = hoyISO()
    return window.api.pedidos.entregasEnRango(hoy, hoy)
  }, [])
}
