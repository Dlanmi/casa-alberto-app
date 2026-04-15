import { FileText, CheckCircle, Clock, Loader, Package, Inbox, XCircle } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import {
  ESTADO_PEDIDO_LABEL,
  ESTADO_PEDIDO_COLOR,
  ESTADO_FACTURA_LABEL,
  ESTADO_FACTURA_COLOR
} from '@renderer/lib/constants'
import type { EstadoPedido, EstadoFactura } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import type { StatusColor } from '@renderer/lib/constants'

const PEDIDO_ICON: Record<EstadoPedido, LucideIcon> = {
  cotizado: FileText,
  confirmado: CheckCircle,
  en_proceso: Loader,
  listo: Package,
  entregado: CheckCircle,
  sin_reclamar: Inbox,
  cancelado: XCircle
}

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <Badge color={ESTADO_PEDIDO_COLOR[estado]} icon={PEDIDO_ICON[estado]}>
      {ESTADO_PEDIDO_LABEL[estado]}
    </Badge>
  )
}

const FACTURA_ICON: Record<EstadoFactura, LucideIcon> = {
  pendiente: Clock,
  pagada: CheckCircle,
  anulada: XCircle
}

export function EstadoFacturaBadge({ estado }: { estado: EstadoFactura }) {
  return (
    <Badge color={ESTADO_FACTURA_COLOR[estado] as StatusColor} icon={FACTURA_ICON[estado]}>
      {ESTADO_FACTURA_LABEL[estado]}
    </Badge>
  )
}
