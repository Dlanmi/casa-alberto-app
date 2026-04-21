/**
 * Diccionario de transiciones de estado válidas para pedidos.
 *
 * Single source of truth — importado tanto por el backend (validación en
 * cambiarEstadoPedido) como por el frontend (feedback visual durante el drag
 * en el kanban). Antes existía duplicado en ambos lados y podía driftear.
 *
 * Este archivo está en `shared/` porque no tiene dependencias nativas
 * (no usa drizzle ni nada de Node) — seguro para importar desde renderer.
 */

import type { EstadoPedido } from './types'

export const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  cotizado: ['confirmado', 'cancelado'],
  confirmado: ['en_proceso', 'cancelado'],
  en_proceso: ['listo', 'cancelado'],
  listo: ['entregado', 'sin_reclamar', 'cancelado'],
  entregado: [],
  sin_reclamar: ['entregado', 'cancelado'],
  cancelado: []
}
