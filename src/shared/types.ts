/**
 * Tipos compartidos entre main, preload y renderer.
 *
 * IMPORTANTE: este archivo sólo debe contener tipos (no código ejecutable),
 * para que tanto el proceso de Node (main/preload) como el de navegador
 * (renderer) puedan importarlo sin arrastrar dependencias nativas.
 */

import type {
  acudientes,
  asistencias,
  clases,
  clientes,
  configuracion,
  contratoItems,
  contratos,
  cuentasCobro,
  devoluciones,
  estudiantes,
  EstadoFactura,
  EstadoPedido,
  MetodoPago,
  facturas,
  historialCambios,
  inventario,
  movimientosFinancieros,
  movimientosInventario,
  muestrasMarcos,
  pagos,
  pagosClases,
  pagosClasesDetalle,
  pedidoItems,
  pedidos,
  plantillasCotizacion,
  preciosBastidores,
  preciosPaspartuAcrilico,
  preciosPaspartuPintado,
  preciosRetablos,
  preciosTapas,
  preciosVidrios,
  proveedores,
  ventasKits
} from '../main/db/schema'
import type {
  InputEnmarcacionEstandar,
  InputEnmarcacionPaspartu,
  NuevaMuestraMarco,
  ResultadoCotizacion
} from '../main/db/queries/cotizador'
import type { MatrizUrgencia, NuevoPedidoDatos } from '../main/db/queries/pedidos'
import type { NuevaFactura, NuevoPago, NuevaDevolucion } from '../main/db/queries/facturas'

// Re-exportamos los enums (son const arrays puras — válido en renderer).
export {
  TIPOS_TRABAJO,
  ESTADOS_PEDIDO,
  TIPOS_ENTREGA,
  TIPOS_ITEM_PEDIDO,
  TIPOS_PASPARTU,
  TIPOS_VIDRIO,
  TIPOS_VIDRIO_LISTA,
  ESTADOS_FACTURA,
  METODOS_PAGO,
  DIAS_SEMANA,
  ESTADOS_PAGO_CLASE,
  TIPOS_MOVIMIENTO_FIN,
  CATEGORIAS_MOVIMIENTO,
  REFERENCIAS_MOVIMIENTO,
  TIPOS_INVENTARIO,
  UNIDADES_INVENTARIO,
  TIPOS_MOV_INVENTARIO,
  MOTIVOS_MOV_INVENTARIO,
  ESTADOS_CONTRATO,
  ESTADOS_CUENTA_COBRO
} from '../main/db/schema'

export type {
  TipoTrabajo,
  EstadoPedido,
  TipoEntrega,
  TipoItemPedido,
  TipoPaspartu,
  TipoVidrio,
  TipoVidrioLista,
  EstadoFactura,
  MetodoPago,
  DiaSemana,
  EstadoPagoClase,
  TipoMovimientoFin,
  CategoriaMovimiento,
  ReferenciaMovimiento,
  TipoInventario,
  UnidadInventario,
  TipoMovInventario,
  MotivoMovInventario,
  EstadoContrato,
  EstadoCuentaCobro,
  PedidoItemMetadata
} from '../main/db/schema'

// Tipos inferidos por tabla
export type Cliente = typeof clientes.$inferSelect
export type NuevoClienteRow = typeof clientes.$inferInsert
export type Acudiente = typeof acudientes.$inferSelect
export type MuestraMarco = typeof muestrasMarcos.$inferSelect
export type PrecioPaspartuPintado = typeof preciosPaspartuPintado.$inferSelect
export type PrecioPaspartuAcrilico = typeof preciosPaspartuAcrilico.$inferSelect
export type PrecioRetablo = typeof preciosRetablos.$inferSelect
export type PrecioVidrio = typeof preciosVidrios.$inferSelect
export type PrecioBastidor = typeof preciosBastidores.$inferSelect
export type PrecioTapa = typeof preciosTapas.$inferSelect
export type Pedido = typeof pedidos.$inferSelect
export type PedidoItem = typeof pedidoItems.$inferSelect
export type Factura = typeof facturas.$inferSelect
export type Pago = typeof pagos.$inferSelect
export type Devolucion = typeof devoluciones.$inferSelect
export type Clase = typeof clases.$inferSelect
export type Estudiante = typeof estudiantes.$inferSelect
export type PagoClase = typeof pagosClases.$inferSelect & {
  // Añadido por `listarPagosMes`: suma de los detalles de pago del mes.
  // Opcional porque `obtenerPagoClaseConDetalles` devuelve el pago sin esta
  // proyección (ya trae la lista completa de detalles).
  totalPagado?: number
}
export type PagoClaseDetalle = typeof pagosClasesDetalle.$inferSelect
export type VentaKit = typeof ventasKits.$inferSelect
export type Asistencia = typeof asistencias.$inferSelect
export type ResumenAsistencia = { total: number; presentes: number; ausentes: number }
export type MovimientoFinanciero = typeof movimientosFinancieros.$inferSelect
export type Proveedor = typeof proveedores.$inferSelect
export type InventarioItem = typeof inventario.$inferSelect
export type MovimientoInventario = typeof movimientosInventario.$inferSelect
export type Contrato = typeof contratos.$inferSelect
export type ContratoItem = typeof contratoItems.$inferSelect
export type CuentaCobro = typeof cuentasCobro.$inferSelect
export type Configuracion = typeof configuracion.$inferSelect
export type PlantillaCotizacion = typeof plantillasCotizacion.$inferSelect
export type HistorialCambio = typeof historialCambios.$inferSelect

// Payloads y respuestas compartidas para IPC
export type PedidoConItems = Pedido & { items?: PedidoItem[] }
export type FacturaConPagos = Factura & { pagos?: Pago[] }

export type PedidoListarFiltros = {
  estado?: EstadoPedido
  clienteId?: number
  limit?: number
}

export type FacturaListarFiltros = {
  clienteId?: number
  estado?: EstadoFactura
  limit?: number
}

export type ConfiguracionSetPayload = {
  clave: string
  valor: string
  descripcion?: string
}

export type CotizadorInputArea = {
  anchoCm: number
  altoCm: number
  porcentajeMateriales?: number
}

export type CotizadorInputVidrioEspejo = InputEnmarcacionEstandar

export type PdfItem = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export type PdfPago = {
  fecha: string
  monto: number
  metodo: MetodoPago
}

/** Formato físico para el PDF de factura (Fase 3 v2 §5.4.3). */
export type PdfFormato = 'carta' | 'a4' | 'termico80'
export const PDF_FORMATOS: PdfFormato[] = ['carta', 'a4', 'termico80']

export type PdfFacturaPayload = {
  numero: string
  fecha: string
  clienteNombre: string
  clienteCedula?: string | null
  clienteTelefono?: string | null
  clienteDireccion?: string | null
  items: PdfItem[]
  subtotal: number
  totalMateriales: number
  total: number
  pagos: PdfPago[]
  saldo: number
  notas?: string | null
  /** Formato de impresión (default: 'carta'). */
  formato?: PdfFormato
}

export type {
  InputEnmarcacionEstandar,
  InputEnmarcacionPaspartu,
  MatrizUrgencia,
  NuevaMuestraMarco,
  NuevoPedidoDatos,
  NuevaFactura,
  NuevoPago,
  NuevaDevolucion,
  ResultadoCotizacion
}

// C-02 — Información de un archivo de backup expuesta al renderer.
export type BackupInfo = {
  path: string
  nombre: string
  fecha: string
  tamanoBytes: number
}

// ---------------------------------------------------------------------------
// IPC result envelope
// ---------------------------------------------------------------------------

export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: string }
export type IpcResult<T> = IpcOk<T> | IpcErr

// ---------------------------------------------------------------------------
// Auto-updater status
// ---------------------------------------------------------------------------

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
