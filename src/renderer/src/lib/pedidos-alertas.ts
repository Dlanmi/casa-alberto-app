import type { Cliente, Pedido } from '@shared/types'

export type PedidoAlertaRow =
  | {
      pedidos?: Partial<Pedido> | null
      pedido?: Partial<Pedido> | null
      clientes?: Partial<Cliente> | null
      cliente?: Partial<Cliente> | null
    }
  | null
  | undefined

export type PedidoAlertaNormalizada = {
  pedido: Partial<Pedido>
  cliente: Partial<Cliente> | null
}

export function getAlertaPedido(alerta: PedidoAlertaRow): Partial<Pedido> | null {
  return alerta?.pedidos ?? alerta?.pedido ?? null
}

export function getAlertaCliente(alerta: PedidoAlertaRow): Partial<Cliente> | null {
  return alerta?.clientes ?? alerta?.cliente ?? null
}

export function extractPedidoIds(alertas: PedidoAlertaRow[] | null | undefined): Set<number> {
  const ids = new Set<number>()

  for (const alerta of alertas ?? []) {
    const pedidoId = getAlertaPedido(alerta)?.id
    if (typeof pedidoId === 'number') {
      ids.add(pedidoId)
    }
  }

  return ids
}

export function normalizePedidoAlertas(
  alertas: PedidoAlertaRow[] | null | undefined
): PedidoAlertaNormalizada[] {
  return (alertas ?? []).flatMap((alerta) => {
    const pedido = getAlertaPedido(alerta)
    if (!pedido) return []

    return [
      {
        pedido,
        cliente: getAlertaCliente(alerta)
      }
    ]
  })
}
