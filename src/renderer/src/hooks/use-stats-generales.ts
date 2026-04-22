import type { StatsGenerales } from '@shared/types'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve los conteos agregados por módulo. Usado por el
 * HelpButton para detectar empty-states (ej. "0 clientes → muestra tip de
 * crear el primero"). Una sola query SQL para evitar N round-trips al
 * abrir el popover.
 */
export function useStatsGenerales(): {
  data: StatsGenerales | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<StatsGenerales>(() => window.api.app.statsGenerales(), [])
}
