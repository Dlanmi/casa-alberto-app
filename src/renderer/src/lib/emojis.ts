import type {
  CategoriaMovimiento,
  EstadoFactura,
  EstadoPedido,
  TipoTrabajo
} from '@shared/types'

export const EMOJI_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  cotizado: '📝',
  confirmado: '✅',
  en_proceso: '🛠️',
  listo: '📦',
  entregado: '🤝',
  sin_reclamar: '⏰',
  cancelado: '❌'
}

export const EMOJI_TIPO_TRABAJO: Record<TipoTrabajo, string> = {
  enmarcacion_estandar: '🖼️',
  acolchado: '🧵',
  retablo: '🪵',
  bastidor: '🖌️',
  tapa: '📐',
  restauracion: '🔧',
  vidrio_espejo: '🪟'
}

export const EMOJI_CATEGORIA_FINANZAS: Record<CategoriaMovimiento, string> = {
  enmarcacion: '🖼️',
  clases: '🎨',
  kit_dibujo: '✏️',
  contratos: '📜',
  restauracion: '🔧',
  materiales: '📦',
  servicios: '🛠️',
  transporte: '🚚',
  arriendo: '🏠',
  devolucion: '↩️',
  otro: '💼'
}

export const EMOJI_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  pendiente: '⏳',
  pagada: '💸',
  anulada: '❌'
}

export const EMOJI_TOAST = {
  pedido_creado: '🎉',
  pedido_entregado: '✨',
  pago_registrado: '💰',
  factura_pagada: '💸',
  cliente_creado: '👋',
  cotizacion_guardada: '📝'
} as const
