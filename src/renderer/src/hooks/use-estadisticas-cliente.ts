import { useIpc } from './use-ipc'

type EstadisticasCliente = {
  totalPedidos: number
  totalFacturado: number
  totalPagado: number
  saldoPendiente: number
  ultimoPedido: unknown
}

/**
 * Hook que devuelve las estadísticas agregadas de un cliente — en particular
 * el `saldoPendiente` total (suma de saldos de TODOS sus pedidos con factura
 * activa). Usado por el popup de pedido en /agenda para advertir cuando el
 * cliente tiene deuda acumulada en otros pedidos más allá del que se está
 * viendo.
 *
 * Si `clienteId` es null/0, el hook no dispara el IPC y retorna `data: null`
 * — permite llamarlo incondicionalmente desde el popup sin correr la query
 * cuando todavía no hay cliente asignado.
 */
export function useEstadisticasCliente(clienteId: number | null | undefined): {
  data: EstadisticasCliente | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<EstadisticasCliente>(() => {
    if (!clienteId) {
      return Promise.resolve({ ok: true, data: null as unknown as EstadisticasCliente })
    }
    return window.api.clientes.estadisticas(clienteId) as Promise<{
      ok: true
      data: EstadisticasCliente
    }>
  }, [clienteId])
}
