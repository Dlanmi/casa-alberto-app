import type { MatrizUrgencia } from '@shared/types'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve la matriz 2×2 de urgencia (BR-001, Fase 2 §B.1.2).
 *
 * Centraliza el cálculo en el backend para garantizar consistencia entre
 * dashboard, vista de pedidos y cualquier otro punto que necesite los
 * cuatro cuadrantes (urgente×conPago). Ver `obtenerMatrizUrgencia`.
 *
 * @param diasUrgencia umbral de días para considerar un pedido "urgente"
 *                    (por defecto 2, según Fase 2).
 */
export function useMatrizUrgencia(diasUrgencia = 2): {
  data: MatrizUrgencia | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<MatrizUrgencia>(
    () => window.api.pedidos.matrizUrgencia(diasUrgencia),
    [diasUrgencia]
  )
}
