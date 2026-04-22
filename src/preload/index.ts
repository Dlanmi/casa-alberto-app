import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BackupInfo,
  Cliente,
  Configuracion,
  ConfiguracionSetPayload,
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
  NuevaDevolucion,
  NuevoPago,
  NuevoPedidoDatos,
  Pedido,
  PedidoConItems,
  PedidoListarFiltros,
  PdfFacturaPayload,
  PrecioVidrio,
  ResultadoCotizacion,
  StatsGenerales
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
    upsertAcudiente: (data: unknown) => invoke('clientes:upsertAcudiente', data)
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
    // C-01 — flag de primera ejecución
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
    // C-02 — gestión de respaldos de la base de datos
    crearAhora: () => invoke<IpcResult<BackupInfo>>('backup:crearAhora'),
    listar: () => invoke<IpcResult<BackupInfo[]>>('backup:listar'),
    restaurar: (backupPath: string) => invoke<IpcResult<void>>('backup:restaurar', backupPath),
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
    actualizarPrecioVidrio: (id: number, precioM2: number) =>
      invoke<IpcResult<PrecioVidrio>>('cotizador:actualizarPrecioVidrio', id, precioM2),
    crearPrecioVidrio: (tipo: string, precioM2: number) =>
      invoke<IpcResult<PrecioVidrio>>('cotizador:crearPrecioVidrio', tipo, precioM2),
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
      descripcion?: string | null
    }) => invoke<IpcResult<ResultadoCotizacion>>('cotizador:vidrioEspejo', input)
  },
  precios: {
    listarPaspartuPintado: () => invoke('precios:listarPaspartuPintado'),
    crearPaspartuPintado: (data: unknown) => invoke('precios:crearPaspartuPintado', data),
    actualizarPaspartuPintado: (id: number, precio: number) =>
      invoke('precios:actualizarPaspartuPintado', id, precio),
    eliminarPaspartuPintado: (id: number) => invoke('precios:eliminarPaspartuPintado', id),
    listarPaspartuAcrilico: () => invoke('precios:listarPaspartuAcrilico'),
    crearPaspartuAcrilico: (data: unknown) => invoke('precios:crearPaspartuAcrilico', data),
    actualizarPaspartuAcrilico: (id: number, precio: number) =>
      invoke('precios:actualizarPaspartuAcrilico', id, precio),
    eliminarPaspartuAcrilico: (id: number) => invoke('precios:eliminarPaspartuAcrilico', id),
    listarRetablos: () => invoke('precios:listarRetablos'),
    crearRetablo: (data: unknown) => invoke('precios:crearRetablo', data),
    actualizarRetablo: (id: number, precio: number) =>
      invoke('precios:actualizarRetablo', id, precio),
    eliminarRetablo: (id: number) => invoke('precios:eliminarRetablo', id),
    listarBastidores: () => invoke('precios:listarBastidores'),
    crearBastidor: (data: unknown) => invoke('precios:crearBastidor', data),
    actualizarBastidor: (id: number, precio: number) =>
      invoke('precios:actualizarBastidor', id, precio),
    eliminarBastidor: (id: number) => invoke('precios:eliminarBastidor', id),
    listarTapas: () => invoke('precios:listarTapas'),
    crearTapa: (data: unknown) => invoke('precios:crearTapa', data),
    actualizarTapa: (id: number, precio: number) => invoke('precios:actualizarTapa', id, precio),
    eliminarTapa: (id: number) => invoke('precios:eliminarTapa', id)
  },
  pedidos: {
    listar: (opts?: PedidoListarFiltros) => invoke<IpcResult<Pedido[]>>('pedidos:listar', opts),
    obtener: (id: number) => invoke<IpcResult<PedidoConItems | null>>('pedidos:obtener', id),
    obtenerPorNumero: (numero: string) =>
      invoke<IpcResult<PedidoConItems | null>>('pedidos:obtenerPorNumero', numero),
    crear: (datos: NuevoPedidoDatos, cotizacion: ResultadoCotizacion) =>
      invoke<IpcResult<Pedido>>('pedidos:crear', datos, cotizacion),
    cambiarEstado: (id: number, estado: Pedido['estado']) =>
      invoke<IpcResult<Pedido>>('pedidos:cambiarEstado', id, estado),
    actualizarFechaEntrega: (id: number, fecha: string | null) =>
      invoke<IpcResult<Pedido | null>>('pedidos:actualizarFechaEntrega', id, fecha),
    resumenEstado: () => invoke('pedidos:resumenEstado'),
    matrizUrgencia: (diasUrgencia?: number) =>
      invoke<IpcResult<MatrizUrgencia>>('pedidos:matrizUrgencia', diasUrgencia),
    reclasificar: () => invoke<IpcResult<number>>('pedidos:reclasificar'),
    saldos: () =>
      invoke<IpcResult<Array<{ pedidoId: number; total: number; pagado: number; saldo: number }>>>(
        'pedidos:saldos'
      ),
    alertas: {
      atrasados: () => invoke('pedidos:alertas:atrasados'),
      entregaProxima: (dias?: number) => invoke('pedidos:alertas:entregaProxima', dias),
      sinAbono: () => invoke('pedidos:alertas:sinAbono'),
      sinReclamar: (dias?: number) => invoke('pedidos:alertas:sinReclamar', dias),
      listosSinRecoger: (dias?: number) => invoke('pedidos:alertas:listosSinRecoger', dias)
    },
    porRangoFecha: (desde: string, hasta: string) => invoke('pedidos:porRangoFecha', desde, hasta)
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
    listar: (soloActivas?: boolean) => invoke('clases:listar', soloActivas),
    crear: (data: unknown) => invoke('clases:crear', data)
  },
  estudiantes: {
    listar: (soloActivos?: boolean) => invoke('estudiantes:listar', soloActivos),
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
    reporteMargenPorTipo: (mes: string) => invoke('finanzas:reporteMargenPorTipo', mes)
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
  excel: {
    exportarFinanzas: (mes: string) => invoke('excel:exportarFinanzas', mes),
    exportarClientes: () => invoke('excel:exportarClientes'),
    exportarInventario: () => invoke('excel:exportarInventario'),
    exportarListasPrecios: () => invoke('excel:exportarListasPrecios'),
    importarMarcos: () => invoke('excel:importarMarcos')
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
