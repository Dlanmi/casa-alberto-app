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
  PedidoItemMetadata,
  TipoEntrega,
  TipoItemPedido,
  TipoTrabajoConcreto,
  TipoTrabajo,
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
  MuestraMarcoConProveedor,
  NuevaMuestraMarco,
  NuevoPrecioVidrio,
  ResultadoCotizacion
} from '../main/db/queries/cotizador'
import type {
  CrearPedidoConfirmadoData,
  CrearPedidoConfirmadoResult,
  CrearPedidoMultiTrabajoInput,
  CrearPedidoMultiTrabajoResult,
  MatrizUrgencia,
  NuevoPedidoDatos,
  TrabajoCotizado
} from '../main/db/queries/pedidos'
import type { NuevaFactura, NuevoPago, NuevaDevolucion } from '../main/db/queries/facturas'

// Re-exportamos los enums (son const arrays puras — válido en renderer).
export {
  TIPOS_TRABAJO,
  TIPOS_TRABAJO_CONCRETO,
  ESTADOS_PEDIDO,
  TIPOS_ENTREGA,
  TIPOS_ITEM_PEDIDO,
  TIPOS_PASPARTU,
  TIPOS_VIDRIO_LISTA,
  ESTADOS_FACTURA,
  METODOS_PAGO,
  ESTADOS_RENTABILIDAD,
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
  TipoTrabajoConcreto,
  EstadoPedido,
  TipoEntrega,
  TipoItemPedido,
  TipoPaspartu,
  TipoVidrioLista,
  TipoProveedor,
  EstadoFactura,
  MetodoPago,
  EstadoRentabilidad,
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

export { TIPOS_PROVEEDOR } from '../main/db/schema'

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
  // Cuando true incluye pedidos entregados hace más de 30 días.
  // Por defecto se esconden para no inflar el kanban con histórico.
  incluirArchivados?: boolean
  // Búsqueda LIKE case-insensitive sobre número y descripción.
  busqueda?: string
}

export type FacturaListarFiltros = {
  clienteId?: number
  estado?: EstadoFactura
  limit?: number
  // Búsqueda LIKE sobre el número de factura.
  busqueda?: string
}

export type ConfiguracionSetPayload = {
  clave: string
  valor: string
  descripcion?: string
}

// ---------------------------------------------------------------------------
// Charts de finanzas — shapes compartidos entre main y renderer.
// Mantener sincronizado con `src/main/db/queries/finanzas.ts`.
// ---------------------------------------------------------------------------

export type SerieMensualFila = {
  /** 'YYYY-MM' */
  mes: string
  ingresos: number
  gastos: number
  balance: number
}

export type SerieDiariaFila = {
  /** 'YYYY-MM-DD' */
  fecha: string
  ingresos: number
  gastos: number
  transacciones: number
}

export type TopClienteFila = {
  clienteId: number
  nombre: string
  total: number
  facturas: number
}

export type TopMarcoFila = {
  /** Referencia tal como la registró el cotizador. 'Sin referencia' agrupa
   *  los items con referencia null o vacía. */
  referencia: string
  cantidad: number
  total: number
}

export type IngresoPorTipoFila = {
  /** TipoTrabajo del esquema o categoría sintética: 'clases', 'kits', 'contratos'. */
  categoria: TipoTrabajo | 'clases' | 'kits' | 'contratos'
  total: number
  cantidad: number
}

export type RangoFechas = {
  desde: string
  hasta: string
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
  /** Cuando el pedido es multi-trabajo (v2.2.0+), cada item lleva el id del
   *  trabajo al que pertenece (1, 2, 3...). El generador del PDF agrupa
   *  visualmente items con el mismo trabajoId bajo un sub-header. Items
   *  sin trabajoId (ej. descuento global) se renderizan al final sin grupo. */
  trabajoId?: number
  /** Tipo concreto del trabajo originario, para mostrar el sub-header. */
  tipoTrabajoOrigen?: TipoTrabajoConcreto
  /** Medidas del trabajo (para el sub-header del grupo). Solo el primer
   *  item de cada grupo necesita poblarlo, pero por consistencia se pasa
   *  en todos. */
  medidasTrabajo?: { anchoCm: number; altoCm: number }
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
  precioLista?: number
  descuentoMonto?: number
  descuentoMotivo?: string | null
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
  MuestraMarcoConProveedor,
  NuevaMuestraMarco,
  NuevoPrecioVidrio,
  CrearPedidoConfirmadoData,
  CrearPedidoConfirmadoResult,
  CrearPedidoMultiTrabajoInput,
  CrearPedidoMultiTrabajoResult,
  TrabajoCotizado,
  NuevoPedidoDatos,
  NuevaFactura,
  NuevoPago,
  NuevaDevolucion,
  ResultadoCotizacion
}

// Información de un archivo de backup expuesta al renderer.
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

// ---------------------------------------------------------------------------
// Conteos agregados (empty-state detection en el HelpButton)
// ---------------------------------------------------------------------------

export type StatsGenerales = {
  clientes: number
  pedidos: number
  facturas: number
  proveedores: number
  inventario: number
  clases: number
  estudiantes: number
  contratos: number
}

// ---------------------------------------------------------------------------
// Deudores accionables (HelpButton — lista de clientes con saldo pendiente
// con datos suficientes para llamar o mandar WhatsApp sin más queries).
// ---------------------------------------------------------------------------

export type PedidoSinAbonoConSaldo = {
  pedidoId: number
  pedidoNumero: string
  clienteId: number
  clienteNombre: string
  clienteTelefono: string | null
  saldoPendiente: number
  diasSinAbono: number
  fechaEntrega: string | null
}

// ---------------------------------------------------------------------------
// Entregas del día / rango (HelpButton de /agenda — lista accionable)
// ---------------------------------------------------------------------------

export type EntregaDelDia = {
  pedidoId: number
  pedidoNumero: string
  clienteId: number
  clienteNombre: string
  clienteTelefono: string | null
  fechaEntrega: string
  tipoTrabajo: TipoTrabajo
  estado: EstadoPedido
}

// ---------------------------------------------------------------------------
// Pedido directo — feature para registrar pedidos sin pasar por el cotizador.
// Casos: precio fijo en el momento, retroactivo, precios históricos.
// El backend (`crearPedidoDirecto`) NO valida contra listas de precios actuales
// — confía en que el dueño introduce los precios correctos manualmente.
// ---------------------------------------------------------------------------

export type ItemPedidoDirecto = {
  /** Tipo de item del enum del schema, o 'otro' para descripción libre. */
  tipoItem: TipoItemPedido | 'otro'
  /** Descripción legible — siempre requerida. */
  descripcion: string
  /** SKU/referencia si vino de una lista de precios. Opcional. */
  referencia?: string | null
  cantidad: number
  precioUnitario: number
  /** Si se eligió desde lista de precios, vendrá poblado. Si es libre, null. */
  costoUnitarioEstimado?: number | null
  /** Metadata estructurada cuando viene de lista (medidas, área, etc.). */
  metadata?: PedidoItemMetadata | null
}

export type DatosClienteParaPedidoDirecto =
  | { tipo: 'existente'; id: number }
  | {
      tipo: 'nuevo'
      data: {
        nombre: string
        telefono?: string | null
        cedula?: string | null
        correo?: string | null
        direccion?: string | null
        notas?: string | null
        esMenor?: boolean
      }
    }

export type CrearPedidoDirectoInput = {
  cliente: DatosClienteParaPedidoDirecto
  pedido: {
    tipoTrabajo: TipoTrabajo
    descripcion?: string | null
    anchoCm?: number | null
    altoCm?: number | null
    /** ISO YYYY-MM-DD. Puede ser fecha pasada (caso retroactivo). */
    fechaIngreso: string
    fechaEntrega?: string | null
    tipoEntrega: TipoEntrega
    /** Estado al que se aterriza el pedido. Default `confirmado`. Para casos
     *  retroactivos puede ser `entregado` directamente. */
    estadoInicial: EstadoPedido
    notas?: string | null
  }
  /** Mínimo 1 item. */
  items: ItemPedidoDirecto[]
  /** Si se omite, usa la suma de items. Si se pasa y difiere, el backend
   *  guarda el override directo SIN materializar descuento (decisión P16:
   *  precio histórico ≠ descuento). */
  precioTotalOverride?: number | null
  factura: {
    fecha: string
    notas?: string | null
  }
  /** Pago inicial opcional. Si se omite, factura queda 100% pendiente. */
  abono?: {
    monto: number
    metodoPago: MetodoPago
    fecha: string
    notas?: string | null
  } | null
  /** Si true, después del create se llama a pdf:generarFactura. */
  generarPDF: boolean
}

export type CrearPedidoDirectoResult = {
  pedido: Pedido
  factura: Factura
  pago: Pago | null
  saldo: number
}
