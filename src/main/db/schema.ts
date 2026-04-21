import { sql, relations } from 'drizzle-orm'
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
  check,
  type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core'

// ============================================================================
// Enums (as TS consts — enforced at CHECK-constraint level in SQLite)
// ============================================================================

export const TIPOS_TRABAJO = [
  'enmarcacion_estandar',
  'acolchado',
  'adherido',
  'retablo',
  'bastidor',
  'tapa',
  'restauracion',
  'vidrio_espejo'
] as const
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number]

export const ESTADOS_PEDIDO = [
  'cotizado',
  'confirmado',
  'en_proceso',
  'listo',
  'entregado',
  'sin_reclamar',
  'cancelado'
] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

export const TIPOS_ENTREGA = ['estandar', 'urgente', 'sin_afan'] as const
export type TipoEntrega = (typeof TIPOS_ENTREGA)[number]

export const TIPOS_ITEM_PEDIDO = [
  'marco',
  'vidrio',
  'paspartu_pintado',
  'paspartu_acrilico',
  'acolchado',
  'adherido',
  'suplemento',
  'retablo',
  'bastidor',
  'tapa',
  'materiales_adicionales',
  'restauracion',
  'instalacion',
  'otro'
] as const
export type TipoItemPedido = (typeof TIPOS_ITEM_PEDIDO)[number]

export const TIPOS_PASPARTU = ['pintado', 'acrilico'] as const
export type TipoPaspartu = (typeof TIPOS_PASPARTU)[number]

// TIPOS_VIDRIO se mantiene como lista de referencia del seed; el pedido acepta
// cualquier string (para soportar tipos creados por el usuario) + 'ninguno'.
export const TIPOS_VIDRIO = ['claro', 'antirreflectivo', 'ninguno'] as const
export type TipoVidrio = string

// Tipos de vidrio precargados en el seed. El tipo es texto libre en la DB
// — el usuario puede agregar más tipos desde la UI de Listas de precios.
export const TIPOS_VIDRIO_LISTA = ['claro', 'antirreflectivo'] as const
export type TipoVidrioLista = string

export const ESTADOS_FACTURA = ['pendiente', 'pagada', 'anulada'] as const
export type EstadoFactura = (typeof ESTADOS_FACTURA)[number]

export const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'cheque'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]

export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]

export const ESTADOS_PAGO_CLASE = ['pendiente', 'parcial', 'pagado'] as const
export type EstadoPagoClase = (typeof ESTADOS_PAGO_CLASE)[number]

export const TIPOS_MOVIMIENTO_FIN = ['ingreso', 'gasto'] as const
export type TipoMovimientoFin = (typeof TIPOS_MOVIMIENTO_FIN)[number]

export const CATEGORIAS_MOVIMIENTO = [
  'enmarcacion',
  'clases',
  'kit_dibujo',
  'contratos',
  'restauracion',
  'materiales',
  'servicios',
  'transporte',
  'arriendo',
  'devolucion',
  'otro'
] as const
export type CategoriaMovimiento = (typeof CATEGORIAS_MOVIMIENTO)[number]

export const REFERENCIAS_MOVIMIENTO = [
  'pago',
  'pago_clase',
  'venta_kit',
  'devolucion',
  'cuenta_cobro',
  'manual'
] as const
export type ReferenciaMovimiento = (typeof REFERENCIAS_MOVIMIENTO)[number]

export const TIPOS_INVENTARIO = ['marco', 'vidrio', 'paspartu', 'mdf', 'carton', 'otro'] as const
export type TipoInventario = (typeof TIPOS_INVENTARIO)[number]

export const UNIDADES_INVENTARIO = ['metros', 'm2', 'unidades', 'laminas'] as const
export type UnidadInventario = (typeof UNIDADES_INVENTARIO)[number]

export const TIPOS_MOV_INVENTARIO = ['entrada', 'salida'] as const
export type TipoMovInventario = (typeof TIPOS_MOV_INVENTARIO)[number]

export const MOTIVOS_MOV_INVENTARIO = ['pedido_proveedor', 'uso_pedido', 'ajuste', 'otro'] as const
export type MotivoMovInventario = (typeof MOTIVOS_MOV_INVENTARIO)[number]

export const ESTADOS_CONTRATO = ['enviada', 'aprobada', 'cobrada', 'rechazada'] as const
export type EstadoContrato = (typeof ESTADOS_CONTRATO)[number]

export const ESTADOS_CUENTA_COBRO = ['pendiente', 'pagada', 'anulada'] as const
export type EstadoCuentaCobro = (typeof ESTADOS_CUENTA_COBRO)[number]

// ============================================================================
// Timestamp helper
// ============================================================================

const now = sql`(datetime('now'))`

// ============================================================================
// Grupo 1 — Clientes y Contactos
// ============================================================================

export const clientes = sqliteTable(
  'clientes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    cedula: text('cedula').unique(),
    correo: text('correo'),
    direccion: text('direccion'),
    notas: text('notas'),
    esMenor: integer('es_menor', { mode: 'boolean' }).notNull().default(false),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_clientes_nombre').on(t.nombre),
    index('idx_clientes_cedula').on(t.cedula),
    index('idx_clientes_telefono').on(t.telefono)
  ]
)

export const acudientes = sqliteTable('acudientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clienteId: integer('cliente_id')
    .notNull()
    .unique()
    .references(() => clientes.id, { onDelete: 'restrict' }),
  nombre: text('nombre').notNull(),
  telefono: text('telefono').notNull(),
  parentesco: text('parentesco'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now)
})

// ============================================================================
// Grupo 2 — Listas de Precios
// ============================================================================

export const muestrasMarcos = sqliteTable(
  'muestras_marcos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    referencia: text('referencia').notNull().unique(),
    colillaCm: real('colilla_cm').notNull(),
    precioMetro: real('precio_metro').notNull(),
    descripcion: text('descripcion'),
    // Cada muestra viene de un proveedor fijo (Alberto o Edimol). Nullable para
    // que el usuario pueda crear marcos sin proveedor y no romper al borrar uno.
    proveedorId: integer('proveedor_id').references((): AnySQLiteColumn => proveedores.id, {
      onDelete: 'set null'
    }),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_marcos_referencia').on(t.referencia),
    index('idx_marcos_proveedor').on(t.proveedorId),
    check('muestras_marcos_precio_positivo', sql`${t.precioMetro} >= 0`),
    check('muestras_marcos_colilla_positiva', sql`${t.colillaCm} >= 0`)
  ]
)

export const preciosPaspartuPintado = sqliteTable(
  'precios_paspartu_pintado',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchoCm: real('ancho_cm').notNull(),
    altoCm: real('alto_cm').notNull(),
    precio: real('precio').notNull(),
    descripcion: text('descripcion'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_paspartu_pintado_precio_positivo', sql`${t.precio} >= 0`)]
)

export const preciosPaspartuAcrilico = sqliteTable(
  'precios_paspartu_acrilico',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchoCm: real('ancho_cm').notNull(),
    altoCm: real('alto_cm').notNull(),
    precio: real('precio').notNull(),
    descripcion: text('descripcion'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_paspartu_acrilico_precio_positivo', sql`${t.precio} >= 0`)]
)

export const preciosRetablos = sqliteTable(
  'precios_retablos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchoCm: real('ancho_cm').notNull(),
    altoCm: real('alto_cm').notNull(),
    precio: real('precio').notNull(),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_retablos_precio_positivo', sql`${t.precio} >= 0`)]
)

export const preciosVidrios = sqliteTable(
  'precios_vidrios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tipo: text('tipo').notNull(),
    precioM2: real('precio_m2').notNull(),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_vidrios_precio_positivo', sql`${t.precioM2} >= 0`)]
)

export const preciosBastidores = sqliteTable(
  'precios_bastidores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchoCm: real('ancho_cm').notNull(),
    altoCm: real('alto_cm').notNull(),
    precio: real('precio').notNull(),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_bastidores_precio_positivo', sql`${t.precio} >= 0`)]
)

export const preciosTapas = sqliteTable(
  'precios_tapas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchoCm: real('ancho_cm').notNull(),
    altoCm: real('alto_cm').notNull(),
    precio: real('precio').notNull(),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [check('precios_tapas_precio_positivo', sql`${t.precio} >= 0`)]
)

// ============================================================================
// Grupo 3 — Pedidos y Facturación
// ============================================================================

export const pedidos = sqliteTable(
  'pedidos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    tipoTrabajo: text('tipo_trabajo', { enum: TIPOS_TRABAJO }).notNull(),
    descripcion: text('descripcion'),
    anchoCm: real('ancho_cm'),
    altoCm: real('alto_cm'),
    anchoPaspartuCm: real('ancho_paspartu_cm'),
    tipoPaspartu: text('tipo_paspartu', { enum: TIPOS_PASPARTU }),
    tipoVidrio: text('tipo_vidrio'),
    porcentajeMateriales: real('porcentaje_materiales').notNull().default(10),
    subtotal: real('subtotal').notNull().default(0),
    totalMateriales: real('total_materiales').notNull().default(0),
    precioTotal: real('precio_total').notNull(),
    estado: text('estado', { enum: ESTADOS_PEDIDO }).notNull().default('cotizado'),
    tipoEntrega: text('tipo_entrega', { enum: TIPOS_ENTREGA }).notNull().default('estandar'),
    fechaIngreso: text('fecha_ingreso').notNull(),
    fechaEntrega: text('fecha_entrega'),
    notas: text('notas'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_pedidos_numero').on(t.numero),
    index('idx_pedidos_cliente').on(t.clienteId),
    index('idx_pedidos_estado').on(t.estado),
    index('idx_pedidos_fecha_entrega').on(t.fechaEntrega),
    index('idx_pedidos_cliente_estado').on(t.clienteId, t.estado),
    check('pedidos_porcentaje_materiales_rango', sql`${t.porcentajeMateriales} BETWEEN 5 AND 10`),
    check('pedidos_subtotal_no_negativo', sql`${t.subtotal} >= 0`),
    check('pedidos_materiales_no_negativo', sql`${t.totalMateriales} >= 0`),
    check('pedidos_total_no_negativo', sql`${t.precioTotal} >= 0`)
  ]
)

export type PedidoItemMetadata = {
  perimetroCm?: number
  colillaCm?: number
  metros?: number
  anchoRedondeado?: number
  altoRedondeado?: number
  areaM2?: number
  anchoExteriorCm?: number
  altoExteriorCm?: number
  [key: string]: unknown
}

export const pedidoItems = sqliteTable(
  'pedido_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pedidoId: integer('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    tipoItem: text('tipo_item', { enum: TIPOS_ITEM_PEDIDO }).notNull(),
    descripcion: text('descripcion'),
    referencia: text('referencia'),
    cantidad: real('cantidad').notNull().default(1),
    precioUnitario: real('precio_unitario'),
    subtotal: real('subtotal').notNull(),
    metadata: text('metadata', { mode: 'json' }).$type<PedidoItemMetadata>(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [
    index('idx_pedido_items_pedido').on(t.pedidoId),
    check('pedido_items_subtotal_no_negativo', sql`${t.subtotal} >= 0`)
  ]
)

export const facturas = sqliteTable(
  'facturas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    pedidoId: integer('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'restrict' }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    fecha: text('fecha').notNull(),
    total: real('total').notNull(),
    fechaEntrega: text('fecha_entrega'),
    notas: text('notas'),
    estado: text('estado', { enum: ESTADOS_FACTURA }).notNull().default('pendiente'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_facturas_numero').on(t.numero),
    index('idx_facturas_cliente').on(t.clienteId),
    index('idx_facturas_pedido').on(t.pedidoId),
    index('idx_facturas_estado').on(t.estado),
    // A9 — Protección a nivel DB contra doble facturación: solo puede haber
    // una factura activa (no anulada) por pedido. El app-level check en
    // crearFactura tiene TOCTOU race en multi-instancia; este índice parcial
    // es la garantía real.
    uniqueIndex('idx_facturas_pedido_activa')
      .on(t.pedidoId)
      .where(sql`estado != 'anulada'`),
    check('facturas_total_no_negativo', sql`${t.total} >= 0`)
  ]
)

export const pagos = sqliteTable(
  'pagos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facturaId: integer('factura_id')
      .notNull()
      .references(() => facturas.id, { onDelete: 'restrict' }),
    monto: real('monto').notNull(),
    metodoPago: text('metodo_pago', { enum: METODOS_PAGO }).notNull(),
    fecha: text('fecha').notNull(),
    notas: text('notas'),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [
    index('idx_pagos_factura').on(t.facturaId),
    index('idx_pagos_fecha').on(t.fecha),
    check('pagos_monto_positivo', sql`${t.monto} > 0`)
  ]
)

export const devoluciones = sqliteTable(
  'devoluciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facturaId: integer('factura_id')
      .notNull()
      .references(() => facturas.id, { onDelete: 'restrict' }),
    monto: real('monto').notNull(),
    motivo: text('motivo').notNull(),
    fecha: text('fecha').notNull(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [check('devoluciones_monto_positivo', sql`${t.monto} > 0`)]
)

// ============================================================================
// Grupo 4 — Clases
// ============================================================================

export const clases = sqliteTable('clases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  diaSemana: text('dia_semana', { enum: DIAS_SEMANA }).notNull(),
  horaInicio: text('hora_inicio').notNull(),
  horaFin: text('hora_fin').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now)
})

export const estudiantes = sqliteTable(
  'estudiantes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    claseId: integer('clase_id').references(() => clases.id, { onDelete: 'set null' }),
    fechaIngreso: text('fecha_ingreso').notNull(),
    esMenor: integer('es_menor', { mode: 'boolean' }).notNull().default(false),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [index('idx_estudiantes_cliente').on(t.clienteId)]
)

export const pagosClases = sqliteTable(
  'pagos_clases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.id, { onDelete: 'restrict' }),
    mes: text('mes').notNull(),
    valorTotal: real('valor_total').notNull(),
    estado: text('estado', { enum: ESTADOS_PAGO_CLASE }).notNull().default('pendiente'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_pagos_clases_estud_mes').on(t.estudianteId, t.mes),
    check('pagos_clases_valor_no_negativo', sql`${t.valorTotal} >= 0`)
  ]
)

export const pagosClasesDetalle = sqliteTable(
  'pagos_clases_detalle',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pagoClaseId: integer('pago_clase_id')
      .notNull()
      .references(() => pagosClases.id, { onDelete: 'cascade' }),
    monto: real('monto').notNull(),
    metodoPago: text('metodo_pago', { enum: METODOS_PAGO }).notNull(),
    fecha: text('fecha').notNull(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [check('pagos_clases_detalle_monto_positivo', sql`${t.monto} > 0`)]
)

export const asistencias = sqliteTable(
  'asistencias',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    estudianteId: integer('estudiante_id')
      .notNull()
      .references(() => estudiantes.id, { onDelete: 'restrict' }),
    claseId: integer('clase_id')
      .notNull()
      .references(() => clases.id, { onDelete: 'restrict' }),
    fecha: text('fecha').notNull(),
    presente: integer('presente', { mode: 'boolean' }).notNull().default(true),
    notas: text('notas'),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [
    index('idx_asistencias_estudiante_fecha').on(t.estudianteId, t.fecha),
    index('idx_asistencias_clase_fecha').on(t.claseId, t.fecha)
  ]
)

export const ventasKits = sqliteTable(
  'ventas_kits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    estudianteId: integer('estudiante_id').references(() => estudiantes.id, {
      onDelete: 'set null'
    }),
    clienteId: integer('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
    precio: real('precio').notNull(),
    fecha: text('fecha').notNull(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [check('ventas_kits_precio_no_negativo', sql`${t.precio} >= 0`)]
)

// ============================================================================
// Grupo 6 — Proveedores e Inventario (declarado antes de finanzas por FK)
// ============================================================================

export const TIPOS_PROVEEDOR = ['marco', 'vidrio', 'paspartu_material', 'otro'] as const
export type TipoProveedor = (typeof TIPOS_PROVEEDOR)[number]

export const proveedores = sqliteTable('proveedores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  producto: text('producto'),
  // Tipo categoriza al proveedor para filtrar por rubro en el cotizador
  // (solo marcos en paso marco, solo vidrios en paso vidrio). 'otro' cubre
  // proveedores genéricos precargados antes de la migración.
  tipo: text('tipo', { enum: TIPOS_PROVEEDOR }).notNull().default('otro'),
  telefono: text('telefono'),
  diasPedido: text('dias_pedido'),
  formaPago: text('forma_pago'),
  formaEntrega: text('forma_entrega'),
  notas: text('notas'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now)
})

export const inventario = sqliteTable(
  'inventario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    referencia: text('referencia'),
    tipo: text('tipo', { enum: TIPOS_INVENTARIO }).notNull(),
    unidad: text('unidad', { enum: UNIDADES_INVENTARIO }).notNull(),
    stockActual: real('stock_actual').notNull().default(0),
    stockMinimo: real('stock_minimo').notNull().default(0),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    check('inventario_stock_no_negativo', sql`${t.stockActual} >= 0`),
    check('inventario_stock_minimo_no_negativo', sql`${t.stockMinimo} >= 0`)
  ]
)

export const movimientosInventario = sqliteTable(
  'movimientos_inventario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    inventarioId: integer('inventario_id')
      .notNull()
      .references(() => inventario.id, { onDelete: 'restrict' }),
    tipo: text('tipo', { enum: TIPOS_MOV_INVENTARIO }).notNull(),
    cantidad: real('cantidad').notNull(),
    motivo: text('motivo', { enum: MOTIVOS_MOV_INVENTARIO }),
    pedidoId: integer('pedido_id').references(() => pedidos.id, { onDelete: 'set null' }),
    proveedorId: integer('proveedor_id').references(() => proveedores.id, {
      onDelete: 'set null'
    }),
    fecha: text('fecha').notNull(),
    notas: text('notas'),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [
    index('idx_movinv_inventario').on(t.inventarioId),
    check('movinv_cantidad_positiva', sql`${t.cantidad} > 0`)
  ]
)

// ============================================================================
// Grupo 5 — Finanzas
// ============================================================================

export const movimientosFinancieros = sqliteTable(
  'movimientos_financieros',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tipo: text('tipo', { enum: TIPOS_MOVIMIENTO_FIN }).notNull(),
    categoria: text('categoria', { enum: CATEGORIAS_MOVIMIENTO }).notNull(),
    descripcion: text('descripcion'),
    monto: real('monto').notNull(),
    fecha: text('fecha').notNull(),
    referenciaTipo: text('referencia_tipo', { enum: REFERENCIAS_MOVIMIENTO }),
    referenciaId: integer('referencia_id'),
    proveedorId: integer('proveedor_id').references(() => proveedores.id, {
      onDelete: 'set null'
    }),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [
    index('idx_movfin_tipo').on(t.tipo),
    index('idx_movfin_categoria').on(t.categoria),
    index('idx_movfin_fecha').on(t.fecha),
    index('idx_movfin_referencia').on(t.referenciaTipo, t.referenciaId),
    index('idx_movfin_proveedor').on(t.proveedorId),
    check('movfin_monto_positivo', sql`${t.monto} > 0`)
  ]
)

// ============================================================================
// Grupo 7 — Contratos
// ============================================================================

export const contratos = sqliteTable(
  'contratos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    descripcion: text('descripcion'),
    total: real('total').notNull(),
    retencionPorcentaje: real('retencion_porcentaje').notNull().default(0),
    retencionMonto: real('retencion_monto').notNull().default(0),
    condiciones: text('condiciones'),
    estado: text('estado', { enum: ESTADOS_CONTRATO }).notNull().default('enviada'),
    fecha: text('fecha').notNull(),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now)
  },
  (t) => [
    index('idx_contratos_numero').on(t.numero),
    index('idx_contratos_cliente').on(t.clienteId),
    index('idx_contratos_estado_fecha').on(t.estado, t.fecha),
    check('contratos_total_no_negativo', sql`${t.total} >= 0`)
  ]
)

export const contratoItems = sqliteTable(
  'contrato_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contratoId: integer('contrato_id')
      .notNull()
      .references(() => contratos.id, { onDelete: 'cascade' }),
    descripcion: text('descripcion').notNull(),
    cantidad: real('cantidad').notNull().default(1),
    valorUnitario: real('valor_unitario').notNull(),
    subtotal: real('subtotal').notNull(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [check('contrato_items_subtotal_no_negativo', sql`${t.subtotal} >= 0`)]
)

export const cuentasCobro = sqliteTable(
  'cuentas_cobro',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero').notNull().unique(),
    contratoId: integer('contrato_id')
      .notNull()
      .references(() => contratos.id, { onDelete: 'restrict' }),
    total: real('total').notNull(),
    retencion: real('retencion').notNull().default(0),
    totalNeto: real('total_neto').notNull(),
    estado: text('estado', { enum: ESTADOS_CUENTA_COBRO }).notNull().default('pendiente'),
    fecha: text('fecha').notNull(),
    createdAt: text('created_at').notNull().default(now)
  },
  (t) => [check('cuentas_cobro_total_no_negativo', sql`${t.total} >= 0`)]
)

// ============================================================================
// Grupo 8 — Sistema
// ============================================================================

export const configuracion = sqliteTable('configuracion', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clave: text('clave').notNull().unique(),
  valor: text('valor').notNull(),
  descripcion: text('descripcion')
})

export const plantillasCotizacion = sqliteTable('plantillas_cotizacion', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  tipoTrabajo: text('tipo_trabajo').notNull(),
  datos: text('datos', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now)
})

export const historialCambios = sqliteTable(
  'historial_cambios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tabla: text('tabla').notNull(),
    registroId: integer('registro_id').notNull(),
    campo: text('campo').notNull(),
    valorAnterior: text('valor_anterior'),
    valorNuevo: text('valor_nuevo'),
    fecha: text('fecha').notNull().default(now)
  },
  (t) => [
    index('idx_historial_registro').on(t.tabla, t.registroId),
    index('idx_historial_fecha').on(t.fecha)
  ]
)

// ============================================================================
// Relations
// ============================================================================

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  acudiente: one(acudientes, {
    fields: [clientes.id],
    references: [acudientes.clienteId]
  }),
  pedidos: many(pedidos),
  facturas: many(facturas),
  contratos: many(contratos),
  estudiante: many(estudiantes)
}))

export const acudientesRelations = relations(acudientes, ({ one }) => ({
  cliente: one(clientes, {
    fields: [acudientes.clienteId],
    references: [clientes.id]
  })
}))

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [pedidos.clienteId],
    references: [clientes.id]
  }),
  items: many(pedidoItems),
  facturas: many(facturas)
}))

export const pedidoItemsRelations = relations(pedidoItems, ({ one }) => ({
  pedido: one(pedidos, {
    fields: [pedidoItems.pedidoId],
    references: [pedidos.id]
  })
}))

export const facturasRelations = relations(facturas, ({ one, many }) => ({
  pedido: one(pedidos, {
    fields: [facturas.pedidoId],
    references: [pedidos.id]
  }),
  cliente: one(clientes, {
    fields: [facturas.clienteId],
    references: [clientes.id]
  }),
  pagos: many(pagos),
  devoluciones: many(devoluciones)
}))

export const pagosRelations = relations(pagos, ({ one }) => ({
  factura: one(facturas, {
    fields: [pagos.facturaId],
    references: [facturas.id]
  })
}))

export const devolucionesRelations = relations(devoluciones, ({ one }) => ({
  factura: one(facturas, {
    fields: [devoluciones.facturaId],
    references: [facturas.id]
  })
}))

export const clasesRelations = relations(clases, ({ many }) => ({
  estudiantes: many(estudiantes),
  asistencias: many(asistencias)
}))

export const estudiantesRelations = relations(estudiantes, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [estudiantes.clienteId],
    references: [clientes.id]
  }),
  clase: one(clases, {
    fields: [estudiantes.claseId],
    references: [clases.id]
  }),
  pagosClases: many(pagosClases),
  ventasKits: many(ventasKits),
  asistencias: many(asistencias)
}))

export const pagosClasesRelations = relations(pagosClases, ({ one, many }) => ({
  estudiante: one(estudiantes, {
    fields: [pagosClases.estudianteId],
    references: [estudiantes.id]
  }),
  detalles: many(pagosClasesDetalle)
}))

export const pagosClasesDetalleRelations = relations(pagosClasesDetalle, ({ one }) => ({
  pagoClase: one(pagosClases, {
    fields: [pagosClasesDetalle.pagoClaseId],
    references: [pagosClases.id]
  })
}))

export const ventasKitsRelations = relations(ventasKits, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [ventasKits.estudianteId],
    references: [estudiantes.id]
  }),
  cliente: one(clientes, {
    fields: [ventasKits.clienteId],
    references: [clientes.id]
  })
}))

export const asistenciasRelations = relations(asistencias, ({ one }) => ({
  estudiante: one(estudiantes, {
    fields: [asistencias.estudianteId],
    references: [estudiantes.id]
  }),
  clase: one(clases, {
    fields: [asistencias.claseId],
    references: [clases.id]
  })
}))

export const proveedoresRelations = relations(proveedores, ({ many }) => ({
  movimientosInventario: many(movimientosInventario),
  movimientosFinancieros: many(movimientosFinancieros)
}))

export const inventarioRelations = relations(inventario, ({ many }) => ({
  movimientos: many(movimientosInventario)
}))

export const movimientosInventarioRelations = relations(movimientosInventario, ({ one }) => ({
  inventario: one(inventario, {
    fields: [movimientosInventario.inventarioId],
    references: [inventario.id]
  }),
  pedido: one(pedidos, {
    fields: [movimientosInventario.pedidoId],
    references: [pedidos.id]
  }),
  proveedor: one(proveedores, {
    fields: [movimientosInventario.proveedorId],
    references: [proveedores.id]
  })
}))

export const movimientosFinancierosRelations = relations(movimientosFinancieros, ({ one }) => ({
  proveedor: one(proveedores, {
    fields: [movimientosFinancieros.proveedorId],
    references: [proveedores.id]
  })
}))

export const contratosRelations = relations(contratos, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [contratos.clienteId],
    references: [clientes.id]
  }),
  items: many(contratoItems),
  cuentasCobro: many(cuentasCobro)
}))

export const contratoItemsRelations = relations(contratoItems, ({ one }) => ({
  contrato: one(contratos, {
    fields: [contratoItems.contratoId],
    references: [contratos.id]
  })
}))

export const cuentasCobroRelations = relations(cuentasCobro, ({ one }) => ({
  contrato: one(contratos, {
    fields: [cuentasCobro.contratoId],
    references: [contratos.id]
  })
}))
