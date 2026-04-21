import { FileText, CheckCircle, Clock, Loader, Package, Inbox, XCircle } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import {
  ESTADO_PEDIDO_LABEL,
  ESTADO_PEDIDO_COLOR,
  ESTADO_FACTURA_LABEL,
  ESTADO_FACTURA_COLOR
} from '@renderer/lib/constants'
import { EMOJI_ESTADO_PEDIDO, EMOJI_ESTADO_FACTURA } from '@renderer/lib/emojis'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { cn } from '@renderer/lib/cn'
import type { EstadoPedido, EstadoFactura } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import type { StatusColor } from '@renderer/lib/constants'

// Mapeo de colores semánticos → clases Tailwind para el dot compacto.
const DOT_BG: Record<StatusColor, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-inactive'
}

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
  const { enabled } = useEmojis()
  return (
    <Badge color={ESTADO_PEDIDO_COLOR[estado]} icon={enabled ? undefined : PEDIDO_ICON[estado]}>
      {enabled && <span aria-hidden="true">{EMOJI_ESTADO_PEDIDO[estado]}</span>}
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
  const { enabled } = useEmojis()
  return (
    <Badge
      color={ESTADO_FACTURA_COLOR[estado] as StatusColor}
      icon={enabled ? undefined : FACTURA_ICON[estado]}
    >
      {enabled && <span aria-hidden="true">{EMOJI_ESTADO_FACTURA[estado]}</span>}
      {ESTADO_FACTURA_LABEL[estado]}
    </Badge>
  )
}

/**
 * Variante compacta: punto de color + texto discreto. Pensado para tablas
 * densas donde el badge completo (pill con padding + ícono + texto) rompe
 * la densidad visual. El `title` nativo da tooltip accesible.
 */
export function EstadoPedidoDot({ estado }: { estado: EstadoPedido }): React.JSX.Element {
  const label = ESTADO_PEDIDO_LABEL[estado]
  const color = ESTADO_PEDIDO_COLOR[estado]
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', DOT_BG[color])} />
      <span className="text-sm text-text-muted">{label}</span>
    </span>
  )
}

export function EstadoFacturaDot({ estado }: { estado: EstadoFactura }): React.JSX.Element {
  const label = ESTADO_FACTURA_LABEL[estado]
  const color = ESTADO_FACTURA_COLOR[estado] as StatusColor
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', DOT_BG[color])} />
      <span className="text-sm text-text-muted">{label}</span>
    </span>
  )
}
