import { eq, sql } from 'drizzle-orm'
import type { DB } from './index'
import {
  acudientes,
  clases,
  clientes,
  configuracion,
  inventario,
  muestrasMarcos,
  preciosBastidores,
  preciosPaspartuAcrilico,
  preciosPaspartuPintado,
  preciosRetablos,
  preciosTapas,
  preciosVidrios,
  proveedores,
  pedidos as pedidosTable
} from './schema'
import {
  cotizarAcolchado,
  cotizarBastidor,
  cotizarEnmarcacionEstandar,
  cotizarEnmarcacionPaspartu,
  cotizarRetablo,
  cotizarTapa
} from './queries/cotizador'
import { crearPedidoDesdeCotizacion, cambiarEstadoPedido } from './queries/pedidos'
import { crearFactura, registrarPago } from './queries/facturas'
import { crearEstudiante, registrarPagoClase, venderKit } from './queries/clases'

const CONFIG_INICIAL: { clave: string; valor: string; descripcion: string }[] = [
  // Valores vacíos en instalación real. El usuario los completa en el
  // wizard de onboarding. No pre-llenamos el nombre del negocio para que
  // no se sienta "identidad asumida" por el dueño.
  { clave: 'nombre_negocio', valor: '', descripcion: 'Nombre del negocio' },
  { clave: 'rut', valor: '', descripcion: 'RUT del negocio' },
  { clave: 'telefono', valor: '', descripcion: 'Teléfono del negocio' },
  { clave: 'direccion', valor: '', descripcion: 'Dirección del negocio' },
  { clave: 'correo', valor: '', descripcion: 'Correo electrónico' },
  { clave: 'consecutivo_facturas', valor: '1', descripcion: 'Siguiente número de factura' },
  { clave: 'consecutivo_pedidos', valor: '1', descripcion: 'Siguiente número de pedido' },
  { clave: 'consecutivo_contratos', valor: '1', descripcion: 'Siguiente número de contrato' },
  {
    clave: 'consecutivo_cuentas_cobro',
    valor: '1',
    descripcion: 'Siguiente número de cuenta de cobro'
  },
  {
    clave: 'porcentaje_materiales_default',
    valor: '10',
    descripcion: 'Porcentaje materiales adicionales'
  },
  { clave: 'tiempo_entrega_default', valor: '8', descripcion: 'Días de entrega por defecto' },
  { clave: 'precio_clase_mensual', valor: '110000', descripcion: 'Precio mensual clases' },
  { clave: 'precio_kit_dibujo', valor: '15000', descripcion: 'Precio kit de dibujo' },
  { clave: 'backup_ubicacion', valor: '', descripcion: 'Ruta carpeta backup' },
  { clave: 'backup_frecuencia', valor: 'diario', descripcion: 'Frecuencia backup automático' },
  { clave: 'inventario_activo', valor: '0', descripcion: 'Módulo inventario activo' },
  // Flag de onboarding: '1' = el dueño completó el wizard de bienvenida.
  // Si es '0' (default), App.tsx redirige automáticamente a /onboarding al
  // arrancar. El wizard lo pone en '1' al finalizar.
  {
    clave: 'onboarding_completed',
    valor: '0',
    descripcion: 'Wizard de primera ejecución completado'
  },
  {
    clave: 'emojis_habilitados',
    valor: '1',
    descripcion: 'Mostrar emojis en estados, categorías y notificaciones'
  }
]

function isEmpty(db: DB): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(clientes)
    .get()
  return (row?.n ?? 0) === 0
}

function seedConfiguracion(db: DB): void {
  const existentes = db.select().from(configuracion).all()
  const claves = new Set(existentes.map((c) => c.clave))
  for (const c of CONFIG_INICIAL) {
    if (!claves.has(c.clave)) {
      db.insert(configuracion).values(c).run()
    }
  }
}

function seedListasPrecios(db: DB, provs: ProveedoresSeed) {
  // Muestras de marcos — según Fase 2 (A.1): referencia, colilla (cm), precio/metro
  // La colilla es el desperdicio TOTAL de la muestra (ej: K473 = 48cm). Se suma UNA vez al perímetro.
  // Cada marco viene de un proveedor fijo (primeros 5 a Alberto, últimos 5 a Edimol).
  const marcos = [
    {
      referencia: 'RN-001',
      colillaCm: 32,
      precioMetro: 28000,
      descripcion: 'Roble Natural',
      proveedorId: provs.alberto
    },
    {
      referencia: 'RO-002',
      colillaCm: 36,
      precioMetro: 32000,
      descripcion: 'Roble Oscuro',
      proveedorId: provs.alberto
    },
    {
      referencia: 'CE-003',
      colillaCm: 40,
      precioMetro: 35000,
      descripcion: 'Cedro',
      proveedorId: provs.alberto
    },
    {
      referencia: 'PA-004',
      colillaCm: 44,
      precioMetro: 42000,
      descripcion: 'Plata Antigua',
      proveedorId: provs.alberto
    },
    {
      referencia: 'DC-005',
      colillaCm: 48,
      precioMetro: 48000,
      descripcion: 'Dorado Clasico',
      proveedorId: provs.alberto
    },
    {
      referencia: 'NM-006',
      colillaCm: 28,
      precioMetro: 26000,
      descripcion: 'Negro Mate',
      proveedorId: provs.edimol
    },
    {
      referencia: 'BL-007',
      colillaCm: 30,
      precioMetro: 30000,
      descripcion: 'Blanco Liso',
      proveedorId: provs.edimol
    },
    {
      referencia: 'WE-008',
      colillaCm: 38,
      precioMetro: 38000,
      descripcion: 'Wengue',
      proveedorId: provs.edimol
    },
    {
      referencia: 'CH-009',
      colillaCm: 26,
      precioMetro: 25000,
      descripcion: 'Chapilla Pino',
      proveedorId: provs.edimol
    },
    {
      referencia: 'TA-010',
      colillaCm: 52,
      precioMetro: 55000,
      descripcion: 'Tallado Premium',
      proveedorId: provs.edimol
    }
  ]
  db.insert(muestrasMarcos).values(marcos).run()

  // Vidrios — precios según spec: claro $100.000/m2, antirreflectivo $115.000/m2
  db.insert(preciosVidrios)
    .values([
      { tipo: 'claro', precioM2: 100000 },
      { tipo: 'antirreflectivo', precioM2: 115000 }
    ])
    .run()

  // Paspartú pintado (cartón) — precio por medida exterior.
  // Estos precios son realistas: un paspartú siempre cuesta MENOS que el marco.
  // Para un cuadro 30x40 con paspartú de 5cm → exterior 40x50 → marco 40x50 a $28k/m ≈ $52k.
  // El paspartú de 40x50 a $18k es ~35% del marco. Proporción correcta.
  db.insert(preciosPaspartuPintado)
    .values([
      { anchoCm: 30, altoCm: 40, precio: 12000 },
      { anchoCm: 40, altoCm: 50, precio: 18000 },
      { anchoCm: 50, altoCm: 70, precio: 25000 },
      { anchoCm: 70, altoCm: 100, precio: 38000 }
    ])
    .run()

  // Paspartú acrílico (MDF) — ~40% más caro que el pintado
  db.insert(preciosPaspartuAcrilico)
    .values([
      { anchoCm: 30, altoCm: 40, precio: 17000 },
      { anchoCm: 40, altoCm: 50, precio: 25000 },
      { anchoCm: 50, altoCm: 70, precio: 35000 },
      { anchoCm: 70, altoCm: 100, precio: 52000 }
    ])
    .run()

  db.insert(preciosRetablos)
    .values([
      { anchoCm: 20, altoCm: 30, precio: 18000 },
      { anchoCm: 30, altoCm: 40, precio: 28000 },
      { anchoCm: 40, altoCm: 60, precio: 45000 },
      { anchoCm: 60, altoCm: 80, precio: 75000 }
    ])
    .run()

  db.insert(preciosBastidores)
    .values([
      { anchoCm: 30, altoCm: 40, precio: 22000 },
      { anchoCm: 40, altoCm: 60, precio: 38000 },
      { anchoCm: 60, altoCm: 80, precio: 58000 },
      { anchoCm: 80, altoCm: 100, precio: 85000 }
    ])
    .run()

  db.insert(preciosTapas)
    .values([
      { anchoCm: 30, altoCm: 40, precio: 12000 },
      { anchoCm: 40, altoCm: 60, precio: 20000 },
      { anchoCm: 60, altoCm: 80, precio: 32000 }
    ])
    .run()
}

function seedClientes(db: DB): number[] {
  const rows = db
    .insert(clientes)
    .values([
      {
        nombre: 'Ana Restrepo',
        telefono: '3104567890',
        cedula: '52123456',
        correo: 'ana.restrepo@example.com',
        direccion: 'Cra 15 #85-20, Bogotá',
        notas: 'Cliente frecuente de enmarcación de fotografías.'
      },
      {
        nombre: 'Carlos Méndez',
        telefono: '3151234567',
        cedula: '79987654',
        correo: 'carlos.mendez@example.com',
        direccion: 'Calle 100 #12-45, Bogotá',
        notas: 'Colecciona obras de artistas bogotanos.'
      },
      {
        nombre: 'María Gómez',
        telefono: '3208765432',
        cedula: '41234567',
        correo: 'maria.gomez@example.com',
        direccion: 'Av 19 #132-10, Bogotá',
        notas: null
      },
      {
        nombre: 'Pedro Acevedo',
        telefono: '3005678901',
        cedula: '80345678',
        correo: null,
        direccion: 'Cra 7 #56-30, Bogotá',
        notas: 'Prefiere pagos en efectivo.'
      }
    ])
    .returning()
    .all()
  return rows.map((r) => r.id)
}

export type ProveedoresSeed = { alberto: number; edimol: number; homecenter: number }

function seedProveedores(db: DB): ProveedoresSeed {
  const rows = db
    .insert(proveedores)
    .values([
      {
        nombre: 'Alberto',
        producto: 'Marcos a medida',
        tipo: 'marco',
        telefono: '3101234567',
        diasPedido: 'lunes,miercoles',
        formaPago: 'Contra entrega',
        formaEntrega: 'En el local',
        notas: 'Proveedor principal de marcos. Trae cortados a medida.'
      },
      {
        nombre: 'Edimol',
        producto: 'Marcos a medida',
        tipo: 'marco',
        telefono: '3109876543',
        diasPedido: 'lunes,miercoles',
        formaPago: 'Contra entrega',
        formaEntrega: 'En el local',
        notas: 'Segundo proveedor de marcos.'
      },
      {
        nombre: 'Homecenter',
        producto: 'MDF, carton para paspartu',
        tipo: 'paspartu_material',
        telefono: '',
        diasPedido: '',
        formaPago: 'De contado',
        formaEntrega: 'Compra directa',
        notas: 'MDF y carton se compran cuando se agotan.'
      }
    ])
    .returning()
    .all()
  const byName = new Map(rows.map((r) => [r.nombre, r.id]))
  return {
    alberto: byName.get('Alberto')!,
    edimol: byName.get('Edimol')!,
    homecenter: byName.get('Homecenter')!
  }
}

function seedInventario(db: DB): void {
  // Fase 2 (E.2): marcos NO se almacenan — se piden bajo demanda a Alberto/Edimol.
  // Solo se trackea stock de materiales que sí se compran y almacenan.
  db.insert(inventario)
    .values([
      { nombre: 'Vidrio claro 2mm', tipo: 'vidrio', unidad: 'm2', stockActual: 8, stockMinimo: 3 },
      {
        nombre: 'Vidrio antirreflectivo',
        tipo: 'vidrio',
        unidad: 'm2',
        stockActual: 2,
        stockMinimo: 2
      },
      { nombre: 'MDF 3mm', tipo: 'mdf', unidad: 'laminas', stockActual: 4, stockMinimo: 6 },
      {
        nombre: 'Carton para paspartu',
        tipo: 'carton',
        unidad: 'laminas',
        stockActual: 10,
        stockMinimo: 5
      }
    ])
    .run()
}

function seedClasesYEstudiantes(db: DB, clienteIds: number[]): void {
  const clase = db
    .insert(clases)
    .values({
      nombre: 'Dibujo Básico',
      diaSemana: 'sabado',
      horaInicio: '09:00',
      horaFin: '11:00'
    })
    .returning()
    .get()

  const est1 = crearEstudiante(db, {
    clienteId: clienteIds[0],
    claseId: clase.id,
    fechaIngreso: '2026-01-15',
    esMenor: false
  })
  const est2 = crearEstudiante(db, {
    clienteId: clienteIds[1],
    claseId: clase.id,
    fechaIngreso: '2026-02-01',
    esMenor: false
  })
  // Fase 2 §C.1 — para estudiantes menores registramos el acudiente antes
  // de crear el estudiante (crearEstudiante ahora exige la presencia del
  // acudiente cuando esMenor=true).
  db.insert(acudientes)
    .values({
      clienteId: clienteIds[2],
      nombre: 'Luisa Gómez',
      telefono: '3201234567',
      parentesco: 'Madre'
    })
    .run()
  const est3 = crearEstudiante(db, {
    clienteId: clienteIds[2],
    claseId: clase.id,
    fechaIngreso: '2026-03-01',
    esMenor: true
  })

  // Pagos completos de marzo
  registrarPagoClase(db, {
    estudianteId: est1.id,
    mes: '2026-03',
    monto: 110000,
    metodoPago: 'transferencia',
    fecha: '2026-03-05'
  })
  registrarPagoClase(db, {
    estudianteId: est2.id,
    mes: '2026-03',
    monto: 110000,
    metodoPago: 'efectivo',
    fecha: '2026-03-06'
  })
  // Pago parcial de marzo
  registrarPagoClase(db, {
    estudianteId: est3.id,
    mes: '2026-03',
    monto: 50000,
    metodoPago: 'efectivo',
    fecha: '2026-03-10'
  })

  // Venta de un kit al primer estudiante
  venderKit(db, { estudianteId: est1.id, fecha: '2026-03-15' })
}

function seedPedidos(db: DB, clienteIds: number[]): number[] {
  const [ana, carlos, maria, pedro] = clienteIds
  const pedidoIds: number[] = []

  // 1. Cotizado
  const c1 = cotizarEnmarcacionEstandar(db, {
    anchoCm: 30,
    altoCm: 40,
    muestraMarcoId: 1,
    tipoVidrio: 'claro'
  })
  const p1 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: ana,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Foto familiar 30x40',
      anchoCm: 30,
      altoCm: 40,
      tipoVidrio: 'claro',
      fechaIngreso: '2026-04-01',
      fechaEntrega: '2026-04-09'
    },
    c1
  )
  pedidoIds.push(p1.id)

  // 2. Cotizado
  const c2 = cotizarEnmarcacionPaspartu(db, {
    anchoCm: 20,
    altoCm: 30,
    anchoPaspartuCm: 5,
    tipoPaspartu: 'pintado',
    muestraMarcoId: 3,
    tipoVidrio: 'antirreflectivo'
  })
  const p2 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: carlos,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Acuarela 20x30 con paspartú',
      anchoCm: 20,
      altoCm: 30,
      anchoPaspartuCm: 5,
      tipoPaspartu: 'pintado',
      tipoVidrio: 'antirreflectivo',
      fechaIngreso: '2026-04-03',
      fechaEntrega: '2026-04-12'
    },
    c2
  )
  pedidoIds.push(p2.id)

  // 3. Confirmado
  const c3 = cotizarEnmarcacionEstandar(db, {
    anchoCm: 50,
    altoCm: 70,
    muestraMarcoId: 5,
    tipoVidrio: 'claro'
  })
  const p3 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: maria,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Poster 50x70',
      anchoCm: 50,
      altoCm: 70,
      tipoVidrio: 'claro',
      fechaIngreso: '2026-03-25',
      fechaEntrega: '2026-04-05'
    },
    c3
  )
  cambiarEstadoPedido(db, p3.id, 'confirmado')
  pedidoIds.push(p3.id)

  // 4. Confirmado
  const c4 = cotizarRetablo(db, { anchoCm: 30, altoCm: 40 })
  const p4 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: pedro,
      tipoTrabajo: 'retablo',
      descripcion: 'Retablo religioso 30x40',
      anchoCm: 30,
      altoCm: 40,
      fechaIngreso: '2026-03-28',
      fechaEntrega: '2026-04-08'
    },
    c4
  )
  cambiarEstadoPedido(db, p4.id, 'confirmado')
  pedidoIds.push(p4.id)

  // 5. En proceso
  const c5 = cotizarAcolchado(db, { anchoCm: 25, altoCm: 35 })
  const p5 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: ana,
      tipoTrabajo: 'acolchado',
      descripcion: 'Acolchado 25x35',
      anchoCm: 25,
      altoCm: 35,
      fechaIngreso: '2026-03-20',
      fechaEntrega: '2026-04-02'
    },
    c5
  )
  cambiarEstadoPedido(db, p5.id, 'confirmado')
  cambiarEstadoPedido(db, p5.id, 'en_proceso')
  pedidoIds.push(p5.id)

  // 6. En proceso
  const c6 = cotizarBastidor(db, { anchoCm: 40, altoCm: 60 })
  const p6 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: carlos,
      tipoTrabajo: 'bastidor',
      descripcion: 'Bastidor 40x60 para óleo',
      anchoCm: 40,
      altoCm: 60,
      fechaIngreso: '2026-03-18',
      fechaEntrega: '2026-03-30'
    },
    c6
  )
  cambiarEstadoPedido(db, p6.id, 'confirmado')
  cambiarEstadoPedido(db, p6.id, 'en_proceso')
  pedidoIds.push(p6.id)

  // 7. Listo
  const c7 = cotizarTapa(db, { anchoCm: 30, altoCm: 40 })
  const p7 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: maria,
      tipoTrabajo: 'tapa',
      descripcion: 'Tapa 30x40',
      anchoCm: 30,
      altoCm: 40,
      fechaIngreso: '2026-03-10',
      fechaEntrega: '2026-03-20'
    },
    c7
  )
  cambiarEstadoPedido(db, p7.id, 'confirmado')
  cambiarEstadoPedido(db, p7.id, 'en_proceso')
  cambiarEstadoPedido(db, p7.id, 'listo')
  pedidoIds.push(p7.id)

  // 8. Entregado
  const c8 = cotizarEnmarcacionEstandar(db, {
    anchoCm: 40,
    altoCm: 50,
    muestraMarcoId: 2,
    tipoVidrio: 'claro'
  })
  const p8 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: pedro,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Foto 40x50',
      anchoCm: 40,
      altoCm: 50,
      tipoVidrio: 'claro',
      fechaIngreso: '2026-02-15',
      fechaEntrega: '2026-02-25'
    },
    c8
  )
  cambiarEstadoPedido(db, p8.id, 'confirmado')
  cambiarEstadoPedido(db, p8.id, 'en_proceso')
  cambiarEstadoPedido(db, p8.id, 'listo')
  cambiarEstadoPedido(db, p8.id, 'entregado')
  pedidoIds.push(p8.id)

  // 9. Entregado
  const c9 = cotizarEnmarcacionEstandar(db, {
    anchoCm: 20,
    altoCm: 25,
    muestraMarcoId: 4,
    tipoVidrio: 'claro'
  })
  const p9 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: ana,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Diploma 20x25',
      anchoCm: 20,
      altoCm: 25,
      tipoVidrio: 'claro',
      fechaIngreso: '2026-02-05',
      fechaEntrega: '2026-02-14'
    },
    c9
  )
  cambiarEstadoPedido(db, p9.id, 'confirmado')
  cambiarEstadoPedido(db, p9.id, 'en_proceso')
  cambiarEstadoPedido(db, p9.id, 'listo')
  cambiarEstadoPedido(db, p9.id, 'entregado')
  pedidoIds.push(p9.id)

  // 10. Sin reclamar (listo hace tiempo)
  const c10 = cotizarEnmarcacionEstandar(db, {
    anchoCm: 30,
    altoCm: 30,
    muestraMarcoId: 6,
    tipoVidrio: 'claro'
  })
  const p10 = crearPedidoDesdeCotizacion(
    db,
    {
      clienteId: carlos,
      tipoTrabajo: 'enmarcacion_estandar',
      descripcion: 'Foto 30x30',
      anchoCm: 30,
      altoCm: 30,
      tipoVidrio: 'claro',
      fechaIngreso: '2026-01-10',
      fechaEntrega: '2026-01-20'
    },
    c10
  )
  cambiarEstadoPedido(db, p10.id, 'confirmado')
  cambiarEstadoPedido(db, p10.id, 'en_proceso')
  cambiarEstadoPedido(db, p10.id, 'listo')
  cambiarEstadoPedido(db, p10.id, 'sin_reclamar')
  pedidoIds.push(p10.id)

  return pedidoIds
}

function seedFacturasYPagos(db: DB, pedidoIds: number[]): void {
  const casos: {
    idx: number
    pagos: {
      fraction?: number
      monto?: number
      metodoPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
      fecha: string
    }[]
  }[] = [
    { idx: 2, pagos: [] },
    {
      idx: 4,
      pagos: [{ fraction: 0.5, metodoPago: 'transferencia', fecha: '2026-03-25' }]
    },
    // Para estos tres necesitamos pagos que cubran el total
    { idx: 6, pagos: [] },
    { idx: 7, pagos: [] },
    { idx: 8, pagos: [] }
  ]

  for (const caso of casos) {
    const pedidoId = pedidoIds[caso.idx]
    const pedido = db.select().from(pedidosTable).where(eq(pedidosTable.id, pedidoId)).get()
    if (!pedido) continue
    const factura = crearFactura(db, {
      pedidoId: pedido.id,
      clienteId: pedido.clienteId,
      fecha: pedido.fechaIngreso,
      total: pedido.precioTotal,
      fechaEntrega: pedido.fechaEntrega
    })

    let pagosList = caso.pagos
    if ([6, 7, 8].includes(caso.idx)) {
      pagosList = [
        {
          monto: pedido.precioTotal,
          metodoPago: caso.idx === 7 ? 'efectivo' : 'transferencia',
          fecha: pedido.fechaEntrega ?? pedido.fechaIngreso
        }
      ]
    }

    for (const p of pagosList) {
      const monto = p.fraction ? Math.floor(pedido.precioTotal * p.fraction) : (p.monto ?? 0)
      registrarPago(db, {
        facturaId: factura.id,
        monto,
        metodoPago: p.metodoPago,
        fecha: p.fecha
      })
    }
  }
}

/**
 * Configuración mínima que se ejecuta en TODA instalación (no solo en
 * demo). Asegura que existan las claves de configuración básicas pero NO
 * inserta clientes, pedidos, facturas u otros datos de muestra.
 *
 * Es idempotente: si la clave ya existe no la sobreescribe. Por eso puede
 * correrse en cada boot sin hacer daño.
 */
export function ensureConfigInicial(db: DB): void {
  db.transaction((tx) => {
    const txDb = tx as unknown as DB
    seedConfiguracion(txDb)
  })
  console.log('[db] ensureConfigInicial: claves base listas')
}

/**
 * Fase B — Datos de demostración (clientes, pedidos, facturas, clases). SOLO
 * se ejecuta cuando el usuario elige "Explorar con datos de ejemplo" en el
 * wizard de onboarding. NO se llama automáticamente en boot. Si la DB ya
 * tiene clientes, retorna sin hacer nada para evitar duplicar.
 */
export function seedDemo(db: DB): void {
  if (!isEmpty(db)) {
    console.log('[db] seedDemo: ya hay datos, no se inserta nada')
    return
  }
  console.log('[db] seedDemo: insertando datos de demostración…')
  db.transaction((tx) => {
    const txDb = tx as unknown as DB
    seedConfiguracion(txDb) // idempotente
    const provs = seedProveedores(txDb)
    seedListasPrecios(txDb, provs)
    const clienteIds = seedClientes(txDb)
    seedInventario(txDb)
    const pedidoIds = seedPedidos(txDb, clienteIds)
    seedFacturasYPagos(txDb, pedidoIds)
    seedClasesYEstudiantes(txDb, clienteIds)
  })
  console.log('[db] seedDemo: datos de demostración insertados')
}

/**
 * Fase B — Limpia los datos de demostración sin tocar la configuración del
 * negocio. Borra clientes, pedidos, facturas, pagos, clases, estudiantes,
 * inventario, proveedores, listas de precios. Preserva la tabla
 * `configuracion` y el flag `onboarding_completed`.
 */
export function clearDemoData(db: DB): void {
  db.transaction((tx) => {
    // Orden importante: tablas hijas primero para respetar FKs.
    tx.run(sql`DELETE FROM pagos`)
    tx.run(sql`DELETE FROM devoluciones`)
    tx.run(sql`DELETE FROM facturas`)
    tx.run(sql`DELETE FROM cotizaciones`)
    tx.run(sql`DELETE FROM pedidos`)
    tx.run(sql`DELETE FROM pagos_clases`)
    tx.run(sql`DELETE FROM asistencias_clases`)
    tx.run(sql`DELETE FROM estudiantes`)
    tx.run(sql`DELETE FROM clases`)
    tx.run(sql`DELETE FROM clientes`)
    tx.run(sql`DELETE FROM movimientos_inventario`)
    tx.run(sql`DELETE FROM inventario`)
    tx.run(sql`DELETE FROM proveedores`)
    tx.run(sql`DELETE FROM muestras_marcos`)
    tx.run(sql`DELETE FROM precios_vidrios`)
    tx.run(sql`DELETE FROM precios_paspartu_pintado`)
    tx.run(sql`DELETE FROM precios_paspartu_acrilico`)
    tx.run(sql`DELETE FROM precios_retablos`)
    tx.run(sql`DELETE FROM precios_bastidores`)
    tx.run(sql`DELETE FROM precios_tapas`)
    tx.run(sql`DELETE FROM historial_cambios`)
    // Reiniciar consecutivos
    tx.run(
      sql`UPDATE configuracion SET valor = '1' WHERE clave IN ('consecutivo_facturas','consecutivo_pedidos','consecutivo_contratos')`
    )
  })
  console.log('[db] clearDemoData: datos de demostración eliminados')
}
