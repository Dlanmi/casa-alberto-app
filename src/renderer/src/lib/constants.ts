import {
  LayoutDashboard,
  Calculator,
  ClipboardList,
  Receipt,
  Users,
  Palette,
  TrendingUp,
  Truck,
  FileSignature,
  Package,
  Settings
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EstadoPedido, TipoTrabajo, EstadoFactura, MetodoPago } from '@shared/types'

// ---- Routes ----

export const ROUTES = {
  dashboard: '/',
  cotizador: '/cotizador',
  pedidos: '/pedidos',
  facturas: '/facturas',
  clientes: '/clientes',
  clases: '/clases',
  finanzas: '/finanzas',
  proveedores: '/proveedores',
  contratos: '/contratos',
  inventario: '/inventario',
  configuracion: '/configuracion',
  onboarding: '/onboarding'
} as const

// ---- Sidebar Items ----

export interface SidebarItem {
  label: string
  icon: LucideIcon
  path: string
  shortcut?: string
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.dashboard, shortcut: 'Alt+1' },
  { label: 'Cotizador', icon: Calculator, path: ROUTES.cotizador, shortcut: 'Alt+2' },
  { label: 'Pedidos', icon: ClipboardList, path: ROUTES.pedidos, shortcut: 'Alt+3' },
  { label: 'Facturas', icon: Receipt, path: ROUTES.facturas, shortcut: 'Alt+4' },
  { label: 'Clientes', icon: Users, path: ROUTES.clientes, shortcut: 'Alt+5' },
  { label: 'Clases', icon: Palette, path: ROUTES.clases, shortcut: 'Alt+6' },
  { label: 'Finanzas', icon: TrendingUp, path: ROUTES.finanzas, shortcut: 'Alt+7' },
  { label: 'Proveedores', icon: Truck, path: ROUTES.proveedores, shortcut: 'Alt+8' },
  { label: 'Contratos', icon: FileSignature, path: ROUTES.contratos, shortcut: 'Alt+9' },
  { label: 'Inventario', icon: Package, path: ROUTES.inventario },
  { label: 'Configuración', icon: Settings, path: ROUTES.configuracion }
]

// ---- Label Maps ----

export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  cotizado: 'Cotizado',
  confirmado: 'Confirmado',
  en_proceso: 'En proceso',
  listo: 'Listo',
  entregado: 'Entregado',
  sin_reclamar: 'Sin reclamar',
  cancelado: 'Cancelado'
}

export const TIPO_TRABAJO_LABEL: Record<TipoTrabajo, string> = {
  enmarcacion_estandar: 'Enmarcación estándar',
  enmarcacion_paspartu: 'Con paspartú',
  acolchado: 'Acolchado',
  retablo: 'Retablo',
  bastidor: 'Bastidor',
  tapa: 'Tapa',
  restauracion: 'Restauración',
  vidrio_espejo: 'Vidrio / Espejo'
}

export const ESTADO_FACTURA_LABEL: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  anulada: 'Anulada'
}

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque'
}

// ---- Status → Color mapping ----

export type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const ESTADO_PEDIDO_COLOR: Record<EstadoPedido, StatusColor> = {
  cotizado: 'neutral',
  confirmado: 'info',
  en_proceso: 'info',
  listo: 'success',
  entregado: 'success',
  sin_reclamar: 'warning',
  cancelado: 'error'
}

export const ESTADO_FACTURA_COLOR: Record<EstadoFactura, StatusColor> = {
  pendiente: 'warning',
  pagada: 'success',
  anulada: 'error'
}
