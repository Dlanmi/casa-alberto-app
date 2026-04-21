import {
  LayoutDashboard,
  CalendarDays,
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
  agenda: '/agenda',
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

export type SidebarGroup = 'dia_a_dia' | 'personas' | 'negocio' | 'ajustes'

export const SIDEBAR_GROUP_LABEL: Record<SidebarGroup, string> = {
  dia_a_dia: 'Día a día',
  personas: 'Personas',
  negocio: 'Negocio',
  ajustes: 'Ajustes'
}

export interface SidebarItem {
  label: string
  icon: LucideIcon
  path: string
  shortcut?: string
  group: SidebarGroup
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.dashboard, shortcut: 'Alt+1', group: 'dia_a_dia' },
  { label: 'Agenda', icon: CalendarDays, path: ROUTES.agenda, shortcut: 'Alt+2', group: 'dia_a_dia' },
  { label: 'Cotizador', icon: Calculator, path: ROUTES.cotizador, shortcut: 'Alt+3', group: 'dia_a_dia' },
  { label: 'Pedidos', icon: ClipboardList, path: ROUTES.pedidos, shortcut: 'Alt+4', group: 'dia_a_dia' },
  { label: 'Facturas', icon: Receipt, path: ROUTES.facturas, shortcut: 'Alt+5', group: 'dia_a_dia' },
  { label: 'Clientes', icon: Users, path: ROUTES.clientes, shortcut: 'Alt+6', group: 'personas' },
  { label: 'Proveedores', icon: Truck, path: ROUTES.proveedores, shortcut: 'Alt+9', group: 'personas' },
  { label: 'Clases', icon: Palette, path: ROUTES.clases, shortcut: 'Alt+7', group: 'personas' },
  { label: 'Finanzas', icon: TrendingUp, path: ROUTES.finanzas, shortcut: 'Alt+8', group: 'negocio' },
  { label: 'Inventario', icon: Package, path: ROUTES.inventario, group: 'negocio' },
  { label: 'Contratos', icon: FileSignature, path: ROUTES.contratos, group: 'negocio' },
  { label: 'Configuración', icon: Settings, path: ROUTES.configuracion, group: 'ajustes' }
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

// Estados "activos" desde el punto de vista del seguimiento diario — usamos
// este set para calcular estancamiento y saldos relevantes. Excluye cotizado
// (todavía no es trabajo en curso) y los terminales (entregado/cancelado).
export const ESTADOS_EN_SEGUIMIENTO: EstadoPedido[] = ['confirmado', 'en_proceso', 'listo']

// Estados terminales para la UI — ocultos por defecto cuando papá filtra "Solo
// activos". sin_reclamar NO es terminal (aún puede moverse a entregado/cancelado).
export const ESTADOS_TERMINALES_UI: EstadoPedido[] = ['entregado', 'cancelado']

export const TIPO_TRABAJO_LABEL: Record<TipoTrabajo, string> = {
  enmarcacion_estandar: 'Enmarcación',
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
