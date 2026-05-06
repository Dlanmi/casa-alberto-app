import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BackupInfo,
  Cliente,
  Configuracion,
  ConfiguracionSetPayload,
  CrearPedidoConfirmadoData,
  CrearPedidoConfirmadoResult,
  CrearPedidoDirectoInput,
  CrearPedidoDirectoResult,
  CrearPedidoMultiTrabajoInput,
  CrearPedidoMultiTrabajoResult,
  Factura,
  FacturaConPagos,
  FacturaListarFiltros,
  IpcResult,
  InputEnmarcacionEstandar,
  InputEnmarcacionPaspartu,
  MatrizUrgencia,
  MuestraMarco,
  MuestraMarcoConProveedor,
  NuevaFactura,
  NuevaMuestraMarco,
  NuevoPrecioVidrio,
  NuevaDevolucion,
  NuevoPago,
  NuevoPedidoDatos,
  Pedido,
  PedidoConItems,
  PedidoListarFiltros,
  PdfFacturaPayload,
  EntregaDelDia,
  PedidoSinAbonoConSaldo,
  PrecioVidrio,
  ResultadoCotizacion,
  SerieDiariaFila,
  SerieMensualFila,
  StatsGenerales,
  TopClienteFila,
  TopMarcoFila,
  IngresoPorTipoFila
} from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>

const api = {
  clientes: {
    listar: (opts?: unknown) => invoke<IpcResult<Cliente[]>>('clientes:listar', opts),
    obtener: (id: number) => invoke<IpcResult<Cliente | null>>('clientes:obtener', id),
    obtenerConAcudiente: (id: number) => invoke('clientes:obtenerConAcudiente', id),
    crear: (data: unknown) => invoke('clientes:crear', data),
    actualizar: (id: number, data: unknown) => invoke('clientes:actualizar', id, data),
    desactivar: (id: number) => invoke('clientes:desactivar', id),
    reactivar: (id: number) => invoke('clientes:reactivar', id),
    estadisticas: (id: number) => invoke('clientes:estadisticas', id),
    upsertAcudiente: (data: unknown) => invoke('clientes:upsertAcudiente', data),
    listarAcudientes: () => invoke('clientes:listarAcudientes')
  },
  proveedores: {
    listar: (opts?: unknown) => invoke('proveedores:listar', opts),
    obtener: (id: number) => invoke('proveedores:obtener', id),
    crear: (data: unknown) => invoke('proveedores:crear', data),
    actualizar: (id: number, data: unknown) => invoke('proveedores:actualizar', id, data),
    desactivar: (id: number) => invoke('proveedores:desactivar', id)
  },
  configuracion: {
    listar: () => invoke<IpcResult<Configuracion[]>>('configuracion:listar'),
    get: (clave: string) => invoke<IpcResult<string | null>>('configuracion:get', clave),
    getNumber: (clave: string, fallback?: number) =>
      invoke<IpcResult<number>>('configuracion:getNumber', clave, fallback),
    set: (clave: string, valor: string, desc?: string) =>
      invoke<IpcResult<void>>('configuracion:set', clave, valor, desc),
    guardar: (payload: ConfiguracionSetPayload) =>
      invoke<IpcResult<void>>(
        'configuracion:set',
        payload.clave,
        payload.valor,
        payload.descripcion
      ),
    // Flag de primera ejecución
    isOnboardingCompleted: () => invoke<IpcResult<boolean>>('configuracion:isOnboardingCompleted'),
    marcarOnboardingCompleto: () =>
      invoke<IpcResult<void>>('configuracion:marcarOnboardingCompleto')
  },
  app: {
    // Fase B — datos de demostración opt-in
    loadDemoData: () => invoke<IpcResult<void>>('app:loadDemoData'),
    clearDemoData: () => invoke<IpcResult<void>>('app:clearDemoData'),
    statsGenerales: () => invoke<IpcResult<StatsGenerales>>('app:statsGenerales')
  },
  backup: {
    // Gestión de respaldos de la base de datos
    crearAhora: () => invoke<IpcResult<BackupInfo>>('backup:crearAhora'),
    listar: () => invoke<IpcResult<BackupInfo[]>>('backup:listar'),
    restaurar: (backupPath: string) => invoke<IpcResult<void>>('backup:restaurar', backupPath),
    // v1.7.1 — preferir restaurarPorId; el renderer pasa el `nombre` que
    // viene de `backup.listar()`, sin exponer rutas del filesystem.
    restaurarPorId: (id: string) => invoke<IpcResult<void>>('backup:restaurarPorId', id),
    obtenerUltimo: () => invoke<IpcResult<BackupInfo | null>>('backup:obtenerUltimo'),
    abrirCarpeta: () => invoke<IpcResult<void>>('backup:abrirCarpeta')
  },
  cotizador: {
    listarMuestrasMarcos: () =>
      invoke<IpcResult<MuestraMarcoConProveedor[]>>('cotizador:listarMuestrasMarcos'),
    obtenerMuestraMarco: (id: number) =>
      invoke<IpcResult<MuestraMarco | null>>('cotizador:obtenerMuestraMarco', id),
    crearMuestraMarco: (data: NuevaMuestraMarco) =>
      invoke<IpcResult<MuestraMarco>>('cotizador:crearMuestraMarco', data),
    actualizarMuestraMarco: (id: number, data: Partial<NuevaMuestraMarco>) =>
      invoke<IpcResult<MuestraMarco>>('cotizador:actualizarMuestraMarco', id, data),
    desactivarMuestraMarco: (id: number) =>
      invoke<IpcResult<MuestraMarco>>('cotizador:desactivarMuestraMarco', id),
    listarPreciosVidrio: () => invoke<IpcResult<PrecioVidrio[]>>('cotizador:listarPreciosVidrio'),
    actualizarPrecioVidrio: (id: number, data: NuevoPrecioVidrio) =>
      invoke<IpcResult<PrecioVidrio>>('cotizador:actualizarPrecioVidrio', id, data),
    crearPrecioVidrio: (data: NuevoPrecioVidrio) =>
      invoke<IpcResult<PrecioVidrio>>('cotizador:crearPrecioVidrio', data),
    eliminarPrecioVidrio: (id: number) =>
      invoke<IpcResult<PrecioVidrio>>('cotizador:eliminarPrecioVidrio', id),
    enmarcacionEstandar: (input: InputEnmarcacionEstandar) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:enmarcacionEstandar', input),
    enmarcacionPaspartu: (input: InputEnmarcacionPaspartu) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:enmarcacionPaspartu', input),
    acolchado: (input: {
      anchoCm: number
      altoCm: number
      muestraMarcoId?: number | null
      porcentajeMateriales?: number
    }) => invoke<IpcResult<ResultadoCotizacion>>('cotizador:acolchado', input),
    adherido: (input: { anchoCm: number; altoCm: number; porcentajeMateriales?: number }) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:adherido', input),
    retablo: (input: { anchoCm: number; altoCm: number; porcentajeMateriales?: number }) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:retablo', input),
    bastidor: (input: { anchoCm: number; altoCm: number; porcentajeMateriales?: number }) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:bastidor', input),
    tapa: (input: { anchoCm: number; altoCm: number; porcentajeMateriales?: number }) =>
      invoke<IpcResult<ResultadoCotizacion>>('cotizador:tapa', input),
    vidrioEspejo: (input: {
      anchoCm: number
      altoCm: number
      tipoVidrio: string
      precioInstalacion?: number
      costoInstalacionEstimado?: number | null
      descripcion?: string | null
    }) => invoke<IpcResult<ResultadoCotizacion>>('cotizador:vidrioEspejo', input)
  },
  precios: {
    listarPaspartuPintado: () => invoke('precios:listarPaspartuPintado'),
    crearPaspartuPintado: (data: unknown) => invoke('precios:crearPaspartuPintado', data),
    actualizarPaspartuPintado: (id: number, data: { precio: number; costoEstimado?: number | null }) =>
      invoke('precios:actualizarPaspartuPintado', id, data),
    eliminarPaspartuPintado: (id: number) => invoke('precios:eliminarPaspartuPintado', id),
    listarPaspartuAcrilico: () => invoke('precios:listarPaspartuAcrilico'),
    crearPaspartuAcrilico: (data: unknown) => invoke('precios:crearPaspartuAcrilico', data),
    actualizarPaspartuAcrilico: (id: number, data: { precio: number; costoEstimado?: number | null }) =>
      invoke('precios:actualizarPaspartuAcrilico', id, data),
    eliminarPaspartuAcrilico: (id: number) => invoke('precios:eliminarPaspartuAcrilico', id),
    listarRetablos: () => invoke('precios:listarRetablos'),
    crearRetablo: (data: unknown) => invoke('precios:crearRetablo', data),
    actualizarRetablo: (id: number, data: { precio: number; costoEstimado?: number | null }) =>
      invoke('precios:actualizarRetablo', id, data),
    eliminarRetablo: (id: number) => invoke('precios:eliminarRetablo', id),
    listarBastidores: () => invoke('precios:listarBastidores'),
    crearBastidor: (data: unknown) => invoke('precios:crearBastidor', data),
    actualizarBastidor: (id: number, data: { precio: number; costoEstimado?: number | null }) =>
      invoke('precios:actualizarBastidor', id, data),
    eliminarBastidor: (id: number) => invoke('precios:eliminarBastidor', id),
    listarTapas: () => invoke('precios:listarTapas'),
    crearTapa: (data: unknown) => invoke('precios:crearTapa', data),
    actualizarTapa: (id: number, data: { precio: number; costoEstimado?: number | null }) =>
      invoke('precios:actualizarTapa', id, data),
    eliminarTapa: (id: number) => invoke('precios:eliminarTapa', id)
  },
  pedidos: {
    listar: (opts?: PedidoListarFiltros) => invoke<IpcResult<Pedido[]>>('pedidos:listar', opts),
    obtener: (id: number) => invoke<IpcResult<PedidoConItems | null>>('pedidos:obtener', id),
    obtenerPorNumero: (numero: string) =>
      invoke<IpcResult<PedidoConItems | null>>('pedidos:obtenerPorNumero', numero),
    crear: (datos: NuevoPedidoDatos, cotizacion: ResultadoCotizacion) =>
      invoke<IpcResult<Pedido>>('pedidos:crear', datos, cotizacion),
    crearConfirmado: (data: CrearPedidoConfirmadoData) =>
      invoke<IpcResult<CrearPedidoConfirmadoResult>>('pedidos:crearConfirmado', data),
    crearDirecto: (data: CrearPedidoDirectoInput) =>
      invoke<IpcResult<CrearPedidoDirectoResult>>('pedidos:crearDirecto', data),
    crearMultiTrabajo: (data: CrearPedidoMultiTrabajoInput) =>
      invoke<IpcResult<CrearPedidoMultiTrabajoResult>>('pedidos:crearMultiTrabajo', data),
    cambiarEstado: (id: number, estado: Pedido['estado']) =>
      invoke<IpcResult<Pedido>>('pedidos:cambiarEstado', id, estado),
    actualizarFechaEntrega: (id: number, fecha: string | null) =>
      invoke<IpcResult<Pedido | null>>('pedidos:actualizarFechaEntrega', id, fecha),
    actualizarTipoEntrega: (id: number, tipo: 'estandar' | 'urgente' | 'sin_afan') =>
      invoke<IpcResult<Pedido | null>>('pedidos:actualizarTipoEntrega', id, tipo),
    editarComercial: (input: {
      pedidoId: number
      descuentoMonto: number
      descuentoMotivo?: string | null
      costoEstimadoTotal?: number | null
    }) => invoke('pedidos:editarComercial', input),
    cobrarYEntregar: (input: {
      pedidoId: number
      monto: number
      metodoPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
      fecha: string
      notas?: string | null
    }) => invoke('pedidos:cobrarYEntregar', input),
    resumenEstado: () => invoke('pedidos:resumenEstado'),
    matrizUrgencia: (diasUrgencia?: number) =>
      invoke<IpcResult<MatrizUrgencia>>('pedidos:matrizUrgencia', diasUrgencia),
    reclasificar: () => invoke<IpcResult<number>>('pedidos:reclasificar'),
    saldos: () =>
      invoke<IpcResult<Array<{ pedidoId: number; total: number; pagado: number; saldo: number }>>>(
        'pedidos:saldos'
      ),
    sinAbonoConSaldo: (limit?: number) =>
      invoke<IpcResult<PedidoSinAbonoConSaldo[]>>('pedidos:sinAbonoConSaldo', limit),
    entregasEnRango: (desde: string, hasta: string) =>
      invoke<IpcResult<EntregaDelDia[]>>('pedidos:entregasEnRango', desde, hasta),
    alertas: {
      atrasados: () => invoke('pedidos:alertas:atrasados'),
      entregaProxima: (dias?: number) => invoke('pedidos:alertas:entregaProxima', dias),
      sinAbono: () => invoke('pedidos:alertas:sinAbono'),
      sinReclamar: (dias?: number) => invoke('pedidos:alertas:sinReclamar', dias),
      listosSinRecoger: (dias?: number) => invoke('pedidos:alertas:listosSinRecoger', dias)
    },
    porRangoFecha: (desde: string, hasta: string) => invoke('pedidos:porRangoFecha', desde, hasta),
    agenda: () => invoke('pedidos:agenda')
  },
  facturas: {
    crear: (data: NuevaFactura) => invoke<IpcResult<Factura>>('facturas:crear', data),
    obtener: (id: number) => invoke<IpcResult<FacturaConPagos | null>>('facturas:obtener', id),
    listar: (opts?: FacturaListarFiltros) => invoke<IpcResult<Factura[]>>('facturas:listar', opts),
    saldo: (id: number) => invoke<IpcResult<number>>('facturas:saldo', id),
    registrarPago: (data: NuevoPago) => invoke('facturas:registrarPago', data),
    registrarDevolucion: (data: NuevaDevolucion) => invoke('facturas:registrarDevolucion', data),
    anular: (id: number) => invoke<IpcResult<Factura | null>>('facturas:anular', id)
  },
  clases: {
    // Acepta el booleano legado o un objeto { soloActivas, busqueda, limit }.
    // El backend lo resuelve internamente.
    listar: (
      optsOrFlag?: boolean | { soloActivas?: boolean; busqueda?: string; limit?: number }
    ) => invoke('clases:listar', optsOrFlag),
    crear: (data: unknown) => invoke('clases:crear', data)
  },
  estudiantes: {
    listar: (
      optsOrFlag?: boolean | { soloActivos?: boolean; busqueda?: string; limit?: number }
    ) => invoke('estudiantes:listar', optsOrFlag),
    obtener: (id: number) => invoke('estudiantes:obtener', id),
    crear: (data: unknown) => invoke('estudiantes:crear', data),
    actualizar: (id: number, data: unknown) => invoke('estudiantes:actualizar', id, data),
    desactivar: (id: number) => invoke('estudiantes:desactivar', id)
  },
  asistencias: {
    registrar: (data: unknown) => invoke('asistencias:registrar', data),
    registrarGrupal: (claseId: number, fecha: string, items: unknown) =>
      invoke('asistencias:registrarGrupal', claseId, fecha, items),
    listar: (filtros?: unknown) => invoke('asistencias:listar', filtros),
    resumenMes: (estudianteId: number, mes: string) =>
      invoke('asistencias:resumenMes', estudianteId, mes)
  },
  pagosClases: {
    listarMes: (mes: string) => invoke('pagosClases:listarMes', mes),
    obtenerConDetalles: (id: number) => invoke('pagosClases:obtenerConDetalles', id),
    registrar: (data: unknown) => invoke('pagosClases:registrar', data),
    generarMes: (mes: string) => invoke<IpcResult<number>>('pagosClases:generarMes', mes)
  },
  kits: {
    vender: (data: unknown) => invoke('kits:vender', data)
  },
  finanzas: {
    listarMovimientos: (opts?: unknown) => invoke('finanzas:listarMovimientos', opts),
    registrarManual: (data: unknown) => invoke('finanzas:registrarManual', data),
    resumenMensual: (mes: string) => invoke('finanzas:resumenMensual', mes),
    resumenComercialMensual: (mes: string) => invoke('finanzas:resumenComercialMensual', mes),
    reporteMargenPorTipo: (mes: string) => invoke('finanzas:reporteMargenPorTipo', mes),
    // Charts: tipos explícitos para que el renderer obtenga inferencia
    // sin cast manual `as IpcResult<T>` en cada llamada.
    serieMensual: (mesesAtras?: number) =>
      invoke<IpcResult<SerieMensualFila[]>>('finanzas:serieMensual', mesesAtras),
    serieDiariaMensual: (mes: string) =>
      invoke<IpcResult<SerieDiariaFila[]>>('finanzas:serieDiariaMensual', mes),
    topClientes: (opts: { desde: string; hasta: string; limit?: number }) =>
      invoke<IpcResult<TopClienteFila[]>>('finanzas:topClientes', opts),
    topMarcosVendidos: (opts: { desde: string; hasta: string; limit?: number }) =>
      invoke<IpcResult<TopMarcoFila[]>>('finanzas:topMarcosVendidos', opts),
    ingresosPorTipoTrabajo: (opts: { desde: string; hasta: string }) =>
      invoke<IpcResult<IngresoPorTipoFila[]>>('finanzas:ingresosPorTipoTrabajo', opts)
  },
  inventario: {
    listar: (soloActivos?: boolean) => invoke('inventario:listar', soloActivos),
    crear: (data: unknown) => invoke('inventario:crear', data),
    registrarMovimiento: (data: unknown) => invoke('inventario:registrarMovimiento', data),
    alertasStockBajo: () => invoke('inventario:alertasStockBajo')
  },
  contratos: {
    listar: (opts?: unknown) => invoke('contratos:listar', opts),
    obtener: (id: number) => invoke('contratos:obtener', id),
    crear: (data: unknown) => invoke('contratos:crear', data),
    cambiarEstado: (id: number, estado: unknown) => invoke('contratos:cambiarEstado', id, estado)
  },
  cuentasCobro: {
    listar: (contratoId?: number) => invoke('cuentasCobro:listar', contratoId),
    crear: (data: unknown) => invoke('cuentasCobro:crear', data),
    marcarPagada: (id: number, fecha: string) => invoke('cuentasCobro:marcarPagada', id, fecha)
  },
  pdf: {
    generarFactura: (data: PdfFacturaPayload) =>
      invoke<IpcResult<string>>('pdf:generarFactura', data),
    abrir: (filePath: string) => invoke<IpcResult<void>>('pdf:abrir', filePath)
  },
  updater: {
    getStatus: () => invoke('updater:getStatus'),
    quitAndInstall: () => invoke('updater:quitAndInstall'),
    checkNow: () => invoke('updater:checkNow'),
    onStatusChange: (callback: (status: unknown) => void) => {
      ipcRenderer.on('updater:status', (_e, status) => callback(status))
      return () => {
        ipcRenderer.removeAllListeners('updater:status')
      }
    }
  },
  shell: {
    // Abre URLs en el browser del sistema (https, tel:, mailto:). El main
    // valida el protocolo para evitar fugas de filesystem o ejecución.
    openExternal: (url: string) => invoke<IpcResult<void>>('shell:openExternal', url)
  },
  excel: {
    exportarFinanzas: (mes: string) => invoke('excel:exportarFinanzas', mes),
    exportarClientes: () => invoke('excel:exportarClientes'),
    exportarInventario: () => invoke('excel:exportarInventario'),
    exportarListasPrecios: () => invoke('excel:exportarListasPrecios'),
    importarMarcos: () => invoke('excel:importarMarcos'),
    // Plantilla unificada (genera y abre + sube por dialog + carga + exporta actual)
    plantilla: {
      generar: () => invoke<IpcResult<string>>('excel:plantilla:generar'),
      subir: () => invoke('excel:plantilla:subir'),
      cargar: (parsed: unknown, modo: 'upsert' | 'solo_agregar' | 'reemplazar') =>
        invoke('excel:plantilla:cargar', parsed, modo),
      exportarActual: () => invoke<IpcResult<string>>('excel:plantilla:exportarActual')
    }
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
