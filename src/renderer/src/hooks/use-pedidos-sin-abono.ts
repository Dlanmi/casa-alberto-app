import type { PedidoSinAbonoConSaldo } from '@shared/types'
import { useIpc } from './use-ipc'

/**
 * Hook que devuelve los deudores (pedidos con saldo pendiente) con todos
 * los datos que el HelpButton necesita para mostrar la lista accionable:
 * nombre + teléfono del cliente, saldo calculado y días de espera.
 * Ordenados por días sin abono descendente.
 *
 * @param limit máximo de items a traer (default 5 — lo que cabe cómodo
 *              en el popover).
 */
export function usePedidosSinAbono(limit = 5): {
  data: PedidoSinAbonoConSaldo[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<PedidoSinAbonoConSaldo[]>(() => window.api.pedidos.sinAbonoConSaldo(limit), [limit])
}
