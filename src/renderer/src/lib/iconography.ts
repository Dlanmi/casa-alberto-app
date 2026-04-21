// AGENT_UX: Central iconography palette for the whole app.
// Keep a single source of truth so every concept (tipo trabajo, categoría,
// cotización, etc.) always gets the same icon. 60-year-old user relies on
// visual shorthand — one icon per concept reduces cognitive load.
import {
  Frame,
  Image as ImageIcon,
  Layers,
  Square,
  PaintBucket,
  Sparkles,
  Grid3x3,
  Hammer,
  Package,
  Wrench,
  ShoppingCart,
  Truck,
  Coins,
  GraduationCap,
  Palette,
  Home,
  RefreshCw,
  MoreHorizontal,
  FileText,
  Receipt,
  Users,
  Scissors,
  Ruler,
  type LucideIcon
} from 'lucide-react'
import type { TipoTrabajo } from '@shared/types'

// -- Tipos de trabajo --------------------------------------------------

export const TIPO_TRABAJO_ICON: Record<TipoTrabajo, LucideIcon> = {
  enmarcacion_estandar: Frame,
  acolchado: Square,
  adherido: Layers,
  retablo: ImageIcon,
  bastidor: Grid3x3,
  tapa: Package,
  restauracion: Sparkles,
  vidrio_espejo: PaintBucket
}

// -- Categorías financieras --------------------------------------------

export const CATEGORIA_FIN_ICON: Record<string, LucideIcon> = {
  enmarcacion: Frame,
  clases: GraduationCap,
  kit_dibujo: Palette,
  contratos: FileText,
  restauracion: Sparkles,
  materiales: ShoppingCart,
  servicios: Wrench,
  transporte: Truck,
  arriendo: Home,
  devolucion: RefreshCw,
  otro: MoreHorizontal
}

// -- Conceptos de cotización (items) -----------------------------------

export const CONCEPTO_ICON: Record<string, LucideIcon> = {
  marco: Frame,
  vidrio: Square,
  paspartu: Layers,
  acolchado: Square,
  adherido: Layers,
  suplemento: Ruler,
  retablo: ImageIcon,
  bastidor: Grid3x3,
  tapa: Package,
  restauracion: Sparkles,
  materiales_adicionales: ShoppingCart,
  instalacion: Wrench,
  colilla: Scissors,
  medidas: Ruler
}

export function conceptoIcon(tipoItem: string | undefined): LucideIcon {
  if (!tipoItem) return FileText
  return CONCEPTO_ICON[tipoItem] ?? FileText
}

// -- Comercial / relación ----------------------------------------------

export const COMERCIAL_ICON = {
  clientes: Users,
  proveedor: Truck,
  factura: Receipt,
  pago: Coins,
  pedido: Hammer
} as const
