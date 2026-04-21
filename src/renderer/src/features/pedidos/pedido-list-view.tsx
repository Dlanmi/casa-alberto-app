import { ClipboardList } from 'lucide-react'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { EstadoPedidoDot } from '@renderer/components/shared/estado-badge'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { InitialsAvatar } from '@renderer/components/shared/initials-avatar'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { cn } from '@renderer/lib/cn'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import type { Pedido } from '@shared/types'

type PedidoListViewProps = {
  pedidos: Pedido[]
  onRowClick: (pedido: Pedido) => void
  clienteMap?: Map<number, string>
  // Map pedidoId → {total, pagado} para poblar la columna "Pago" con la
  // proporción real. Si falta (undefined), usamos precioTotal y pagado=0.
  saldosInfoMap?: Map<number, { total: number; pagado: number }>
  highlightedId?: number | null
}

export function PedidoListView({
  pedidos,
  onRowClick,
  clienteMap,
  saldosInfoMap,
  highlightedId = null
}: PedidoListViewProps): React.JSX.Element {
  if (pedidos.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Aún no hay pedidos"
        description="Crea una cotización y confírmala para verlos aquí."
      />
    )
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Número</Th>
          <Th>Cliente</Th>
          <Th>Tipo</Th>
          <Th>Descripción</Th>
          <Th>Medidas</Th>
          <Th>Entrega</Th>
          <Th className="text-right">Total</Th>
          <Th>Pago</Th>
          <Th>Estado</Th>
        </Tr>
      </Thead>
      <Tbody>
        {pedidos.map((p) => {
          const TipoIcon = TIPO_TRABAJO_ICON[p.tipoTrabajo]
          const clienteNombre = clienteMap?.get(p.clienteId) ?? 'Sin cliente'
          return (
            <Tr
              key={p.id}
              className={cn(
                'cursor-pointer',
                highlightedId === p.id && 'ring-2 ring-accent bg-accent/10 animate-pulse'
              )}
              onClick={() => onRowClick(p)}
            >
              <Td className="font-medium tabular-nums">{p.numero}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <InitialsAvatar nombre={clienteNombre} id={p.clienteId} size="sm" />
                  <span className="truncate text-text">{clienteNombre}</span>
                </div>
              </Td>
              <Td className="text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <TipoIcon size={14} className="text-accent-strong" />
                  {TIPO_TRABAJO_LABEL[p.tipoTrabajo]}
                </span>
              </Td>
              <Td className="max-w-50 truncate text-text-muted">{p.descripcion ?? '—'}</Td>
              <Td className="tabular-nums text-text-muted">
                {p.anchoCm && p.altoCm ? `${p.anchoCm}×${p.altoCm}` : '—'}
              </Td>
              <Td>{p.fechaEntrega ? <FechaDisplay fecha={p.fechaEntrega} relative /> : '—'}</Td>
              <Td className="text-right">
                <PrecioDisplay value={p.precioTotal} size="sm" />
              </Td>
              <Td className="min-w-30">
                <PagoBar
                  total={saldosInfoMap?.get(p.id)?.total ?? p.precioTotal}
                  pagado={saldosInfoMap?.get(p.id)?.pagado ?? 0}
                />
              </Td>
              <Td>
                <EstadoPedidoDot estado={p.estado} />
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}
