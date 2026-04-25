import type { Acudiente } from '@shared/types'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve el listado completo de acudientes registrados.
 * Usado por el popup de clase en /agenda: si un estudiante es menor,
 * buscamos su acudiente por `clienteId` y mostramos el teléfono con botón
 * para llamar. Traerlos en batch evita N round-trips cuando la clase tiene
 * varios menores.
 */
export function useAcudientes(): {
  data: Acudiente[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<Acudiente[]>(() => window.api.clientes.listarAcudientes(), [])
}
