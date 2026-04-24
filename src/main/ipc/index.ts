import { ipcMain } from 'electron'
import type { DB } from '../db'
import type { IpcResult } from '../../shared/types'
import {
  actualizarCliente,
  crearCliente,
  desactivarCliente,
  estadisticasCliente,
  listarAcudientes,
  listarClientes,
  obtenerCliente,
  obtenerClienteConAcudiente,
  reactivarCliente,
  upsertAcudiente
} from '../db/queries/clientes'
import {
  actualizarProveedor,
  crearProveedor,
  desactivarProveedor,
  listarProveedores,
  obtenerProveedor
} from '../db/queries/proveedores'
import {
  getConfig,
  getConfigNumber,
  listarConfiguracion,
  setConfig,
  isOnboardingCompleted,
  marcarOnboardingCompleto
} from '../db/queries/configuracion'
import { seedDemo, clearDemoData } from '../db/seed'
import { statsGenerales } from '../db/queries/stats'
import { checkForUpdatesNow, getUpdateStatus, quitAndInstall } from '../updater'
import {
  crearBackupAhora,
  listarBackups,
  restaurarDesdeBackup,
  obtenerUltimoBackup
} from '../db/backup'
import { shell } from 'electron'
import { getBackupsDir } from '../db'
import {
  cotizarAcolchado,
  cotizarAdherido,
  cotizarBastidor,
  cotizarEnmarcacionEstandar,
  cotizarEnmarcacionPaspartu,
  cotizarRetablo,
  cotizarTapa,
  cotizarVidrioEspejo,
  listarMuestrasMarcos,
  obtenerMuestraMarco,
  crearMuestraMarco,
  actualizarMuestraMarco,
  desactivarMuestraMarco,
  listarPreciosVidrio,
  actualizarPrecioVidrio,
  crearPrecioVidrio,
  eliminarPrecioVidrio,
  listarPreciosPaspartuPintado,
  crearPrecioPaspartuPintado,
  actualizarPrecioPaspartuPintado,
  eliminarPrecioPaspartuPintado,
  listarPreciosPaspartuAcrilico,
  crearPrecioPaspartuAcrilico,
  actualizarPrecioPaspartuAcrilico,
  eliminarPrecioPaspartuAcrilico,
  listarPreciosRetablos,
  crearPrecioRetablo,
  actualizarPrecioRetablo,
  eliminarPrecioRetablo,
  listarPreciosBastidores,
  crearPrecioBastidor,
  actualizarPrecioBastidor,
  eliminarPrecioBastidor,
  listarPreciosTapas,
  crearPrecioTapa,
  actualizarPrecioTapa,
  eliminarPrecioTapa
} from '../db/queries/cotizador'
import {
  actualizarFechaEntrega,
  cambiarEstadoPedido,
  crearPedidoDesdeCotizacion,
  listarPedidos,
  obtenerMatrizUrgencia,
  obtenerPedido,
  obtenerPedidoPorNumero,
  obtenerSaldosPorPedido,
  pedidosAtrasados,
  pedidosEntregaProxima,
  pedidosPorRangoFecha,
  pedidosListosSinRecoger,
  pedidosSinAbono,
  pedidosSinAbonoConSaldo,
  entregasEnRango,
  pedidosSinReclamar,
  reclasificarPedidos,
  resumenPedidosPorEstado
} from '../db/queries/pedidos'
import {
  anularFactura,
  crearFactura,
  getSaldoFactura,
  listarFacturas,
  obtenerFactura,
  registrarDevolucion,
  registrarPago
} from '../db/queries/facturas'
import {
  actualizarEstudiante,
  crearClase,
  crearEstudiante,
  desactivarEstudiante,
  generarPagosDelMes,
  listarAsistencias,
  listarClases,
  listarEstudiantes,
  listarPagosMes,
  obtenerEstudiante,
  obtenerPagoClaseConDetalles,
  registrarAsistencia,
  registrarAsistenciaGrupal,
  registrarPagoClase,
  resumenAsistenciaMes,
  venderKit
} from '../db/queries/clases'
import {
  listarMovimientos,
  registrarMovimientoManual,
  reporteMargenPorTipo,
  resumenMensual
} from '../db/queries/finanzas'
import {
  alertasStockBajo,
  crearItemInventario,
  listarInventario,
  registrarMovimientoInventario
} from '../db/queries/inventario'
import {
  cambiarEstadoContrato,
  crearContrato,
  crearCuentaCobro,
  listarContratos,
  listarCuentasCobro,
  marcarCuentaCobroPagada,
  obtenerContrato
} from '../db/queries/contratos'
import { generarFacturaPDF, abrirPDF } from '../pdf/factura-pdf'
import {
  exportarReporteFinanciero,
  exportarClientes,
  exportarInventario,
  exportarListasPrecios,
  importarMarcosDesdeExcel
} from '../excel/excel-service'

function wrap<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => IpcResult<R> {
  return (...args: A) => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ipc]', fn.name, '→', msg)
      return { ok: false, error: msg }
    }
  }
}

export function registerIpcHandlers(db: DB): void {
  // clientes
  ipcMain.handle('clientes:listar', (_e, opts) => wrap(listarClientes)(db, opts))
  ipcMain.handle('clientes:obtener', (_e, id: number) => wrap(obtenerCliente)(db, id))
  ipcMain.handle('clientes:obtenerConAcudiente', (_e, id: number) =>
    wrap(obtenerClienteConAcudiente)(db, id)
  )
  ipcMain.handle('clientes:crear', (_e, data) => wrap(crearCliente)(db, data))
  ipcMain.handle('clientes:actualizar', (_e, id: number, data) =>
    wrap(actualizarCliente)(db, id, data)
  )
  ipcMain.handle('clientes:desactivar', (_e, id: number) => wrap(desactivarCliente)(db, id))
  ipcMain.handle('clientes:reactivar', (_e, id: number) => wrap(reactivarCliente)(db, id))
  ipcMain.handle('clientes:estadisticas', (_e, id: number) => wrap(estadisticasCliente)(db, id))
  ipcMain.handle('clientes:upsertAcudiente', (_e, data) => wrap(upsertAcudiente)(db, data))
  ipcMain.handle('clientes:listarAcudientes', () => wrap(listarAcudientes)(db))

  // proveedores
  ipcMain.handle('proveedores:listar', (_e, opts) => wrap(listarProveedores)(db, opts))
  ipcMain.handle('proveedores:obtener', (_e, id: number) => wrap(obtenerProveedor)(db, id))
  ipcMain.handle('proveedores:crear', (_e, data) => wrap(crearProveedor)(db, data))
  ipcMain.handle('proveedores:actualizar', (_e, id: number, data) =>
    wrap(actualizarProveedor)(db, id, data)
  )
  ipcMain.handle('proveedores:desactivar', (_e, id: number) => wrap(desactivarProveedor)(db, id))

  // configuracion
  ipcMain.handle('configuracion:listar', () => wrap(listarConfiguracion)(db))
  ipcMain.handle('configuracion:get', (_e, clave: string) => wrap(getConfig)(db, clave))
  ipcMain.handle('configuracion:getNumber', (_e, clave: string, fallback?: number) =>
    wrap(getConfigNumber)(db, clave, fallback)
  )
  ipcMain.handle('configuracion:set', (_e, clave: string, valor: string, desc?: string) =>
    wrap(setConfig)(db, clave, valor, desc)
  )
  // C-01 — flag de onboarding
  ipcMain.handle('configuracion:isOnboardingCompleted', () => wrap(isOnboardingCompleted)(db))
  ipcMain.handle('configuracion:marcarOnboardingCompleto', () => wrap(marcarOnboardingCompleto)(db))

  // app — manejo de datos de demostración opt-in (Fase B)
  ipcMain.handle('app:loadDemoData', () => wrap(seedDemo)(db))
  ipcMain.handle('app:clearDemoData', () => wrap(clearDemoData)(db))
  // Conteos agregados para detectar empty-states desde el HelpButton.
  ipcMain.handle('app:statsGenerales', () => wrap(statsGenerales)(db))

  // backup — C-02
  ipcMain.handle('backup:crearAhora', () => wrap(crearBackupAhora)())
  ipcMain.handle('backup:listar', () => wrap(listarBackups)())
  ipcMain.handle('backup:restaurar', (_e, backupPath: string) =>
    wrap(restaurarDesdeBackup)(backupPath)
  )
  ipcMain.handle('backup:obtenerUltimo', () => wrap(obtenerUltimoBackup)())
  // Abre la carpeta de backups en el explorador del SO para que el usuario
  // pueda copiar los archivos a un USB manualmente.
  ipcMain.handle('backup:abrirCarpeta', async (): Promise<IpcResult<void>> => {
    try {
      await shell.openPath(getBackupsDir())
      return { ok: true, data: undefined }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // shell — abrir URLs externas (WhatsApp, tel:, mailto:) desde el renderer.
  // Validación estricta de protocolo: bloquea `file:`, `javascript:`, etc.
  // para prevenir leak de filesystem o ejecución de código.
  const PROTOCOLOS_PERMITIDOS = new Set(['https:', 'http:', 'tel:', 'mailto:'])
  ipcMain.handle('shell:openExternal', async (_e, url: string): Promise<IpcResult<void>> => {
    try {
      if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
        return { ok: false, error: 'URL inválida' }
      }
      const parsed = new URL(url)
      if (!PROTOCOLOS_PERMITIDOS.has(parsed.protocol)) {
        return { ok: false, error: `Protocolo no permitido: ${parsed.protocol}` }
      }
      await shell.openExternal(url)
      return { ok: true, data: undefined }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // cotizador — muestras de marcos CRUD
  ipcMain.handle('cotizador:listarMuestrasMarcos', () => wrap(listarMuestrasMarcos)(db))
  ipcMain.handle('cotizador:obtenerMuestraMarco', (_e, id: number) =>
    wrap(obtenerMuestraMarco)(db, id)
  )
  ipcMain.handle('cotizador:crearMuestraMarco', (_e, data) => wrap(crearMuestraMarco)(db, data))
  ipcMain.handle('cotizador:actualizarMuestraMarco', (_e, id: number, data) =>
    wrap(actualizarMuestraMarco)(db, id, data)
  )
  ipcMain.handle('cotizador:desactivarMuestraMarco', (_e, id: number) =>
    wrap(desactivarMuestraMarco)(db, id)
  )
  ipcMain.handle('cotizador:listarPreciosVidrio', () => wrap(listarPreciosVidrio)(db))
  ipcMain.handle('cotizador:actualizarPrecioVidrio', (_e, id: number, precioM2: number) =>
    wrap(actualizarPrecioVidrio)(db, id, precioM2)
  )
  ipcMain.handle('cotizador:crearPrecioVidrio', (_e, tipo: string, precioM2: number) =>
    wrap(crearPrecioVidrio)(db, tipo, precioM2)
  )
  ipcMain.handle('cotizador:eliminarPrecioVidrio', (_e, id: number) =>
    wrap(eliminarPrecioVidrio)(db, id)
  )
  // Listas de precios — CRUD (5 tablas por medida)
  ipcMain.handle('precios:listarPaspartuPintado', () => wrap(listarPreciosPaspartuPintado)(db))
  ipcMain.handle('precios:crearPaspartuPintado', (_e, data) =>
    wrap(crearPrecioPaspartuPintado)(db, data)
  )
  ipcMain.handle('precios:actualizarPaspartuPintado', (_e, id: number, precio: number) =>
    wrap(actualizarPrecioPaspartuPintado)(db, id, precio)
  )
  ipcMain.handle('precios:eliminarPaspartuPintado', (_e, id: number) =>
    wrap(eliminarPrecioPaspartuPintado)(db, id)
  )
  ipcMain.handle('precios:listarPaspartuAcrilico', () => wrap(listarPreciosPaspartuAcrilico)(db))
  ipcMain.handle('precios:crearPaspartuAcrilico', (_e, data) =>
    wrap(crearPrecioPaspartuAcrilico)(db, data)
  )
  ipcMain.handle('precios:actualizarPaspartuAcrilico', (_e, id: number, precio: number) =>
    wrap(actualizarPrecioPaspartuAcrilico)(db, id, precio)
  )
  ipcMain.handle('precios:eliminarPaspartuAcrilico', (_e, id: number) =>
    wrap(eliminarPrecioPaspartuAcrilico)(db, id)
  )
  ipcMain.handle('precios:listarRetablos', () => wrap(listarPreciosRetablos)(db))
  ipcMain.handle('precios:crearRetablo', (_e, data) => wrap(crearPrecioRetablo)(db, data))
  ipcMain.handle('precios:actualizarRetablo', (_e, id: number, precio: number) =>
    wrap(actualizarPrecioRetablo)(db, id, precio)
  )
  ipcMain.handle('precios:eliminarRetablo', (_e, id: number) => wrap(eliminarPrecioRetablo)(db, id))
  ipcMain.handle('precios:listarBastidores', () => wrap(listarPreciosBastidores)(db))
  ipcMain.handle('precios:crearBastidor', (_e, data) => wrap(crearPrecioBastidor)(db, data))
  ipcMain.handle('precios:actualizarBastidor', (_e, id: number, precio: number) =>
    wrap(actualizarPrecioBastidor)(db, id, precio)
  )
  ipcMain.handle('precios:eliminarBastidor', (_e, id: number) =>
    wrap(eliminarPrecioBastidor)(db, id)
  )
  ipcMain.handle('precios:listarTapas', () => wrap(listarPreciosTapas)(db))
  ipcMain.handle('precios:crearTapa', (_e, data) => wrap(crearPrecioTapa)(db, data))
  ipcMain.handle('precios:actualizarTapa', (_e, id: number, precio: number) =>
    wrap(actualizarPrecioTapa)(db, id, precio)
  )
  ipcMain.handle('precios:eliminarTapa', (_e, id: number) => wrap(eliminarPrecioTapa)(db, id))

  ipcMain.handle('cotizador:enmarcacionEstandar', (_e, input) =>
    wrap(cotizarEnmarcacionEstandar)(db, input)
  )
  ipcMain.handle('cotizador:enmarcacionPaspartu', (_e, input) =>
    wrap(cotizarEnmarcacionPaspartu)(db, input)
  )
  ipcMain.handle('cotizador:acolchado', (_e, input) => wrap(cotizarAcolchado)(db, input))
  ipcMain.handle('cotizador:adherido', (_e, input) => wrap(cotizarAdherido)(db, input))
  ipcMain.handle('cotizador:retablo', (_e, input) => wrap(cotizarRetablo)(db, input))
  ipcMain.handle('cotizador:bastidor', (_e, input) => wrap(cotizarBastidor)(db, input))
  ipcMain.handle('cotizador:tapa', (_e, input) => wrap(cotizarTapa)(db, input))
  ipcMain.handle('cotizador:vidrioEspejo', (_e, input) => wrap(cotizarVidrioEspejo)(db, input))

  // pedidos
  ipcMain.handle('pedidos:listar', (_e, opts) => wrap(listarPedidos)(db, opts))
  ipcMain.handle('pedidos:obtener', (_e, id: number) => wrap(obtenerPedido)(db, id))
  ipcMain.handle('pedidos:obtenerPorNumero', (_e, numero: string) =>
    wrap(obtenerPedidoPorNumero)(db, numero)
  )
  ipcMain.handle('pedidos:crear', (_e, datos, cotizacion) =>
    wrap(crearPedidoDesdeCotizacion)(db, datos, cotizacion)
  )
  ipcMain.handle('pedidos:cambiarEstado', (_e, id: number, estado) =>
    wrap(cambiarEstadoPedido)(db, id, estado)
  )
  ipcMain.handle('pedidos:actualizarFechaEntrega', (_e, id: number, fecha) =>
    wrap(actualizarFechaEntrega)(db, id, fecha)
  )
  ipcMain.handle('pedidos:alertas:atrasados', () => wrap(pedidosAtrasados)(db))
  ipcMain.handle('pedidos:alertas:entregaProxima', (_e, dias?: number) =>
    wrap(pedidosEntregaProxima)(db, dias)
  )
  ipcMain.handle('pedidos:alertas:sinAbono', () => wrap(pedidosSinAbono)(db))
  ipcMain.handle('pedidos:sinAbonoConSaldo', (_e, limit?: number) =>
    wrap(pedidosSinAbonoConSaldo)(db, limit)
  )
  ipcMain.handle('pedidos:entregasEnRango', (_e, desde: string, hasta: string) =>
    wrap(entregasEnRango)(db, desde, hasta)
  )
  ipcMain.handle('pedidos:alertas:sinReclamar', (_e, dias?: number) =>
    wrap(pedidosSinReclamar)(db, dias)
  )
  ipcMain.handle('pedidos:alertas:listosSinRecoger', (_e, dias?: number) =>
    wrap(pedidosListosSinRecoger)(db, dias)
  )
  ipcMain.handle('pedidos:resumenEstado', () => wrap(resumenPedidosPorEstado)(db))
  ipcMain.handle('pedidos:matrizUrgencia', (_e, diasUrgencia?: number) =>
    wrap(obtenerMatrizUrgencia)(db, diasUrgencia)
  )
  ipcMain.handle('pedidos:reclasificar', () => wrap(reclasificarPedidos)(db))
  ipcMain.handle('pedidos:porRangoFecha', (_e, desde: string, hasta: string) =>
    wrap(pedidosPorRangoFecha)(db, desde, hasta)
  )
  // Fase 1 — saldos por pedido (LEFT JOIN facturas+pagos en una sola query)
  ipcMain.handle('pedidos:saldos', () => wrap(obtenerSaldosPorPedido)(db))

  // facturas
  ipcMain.handle('facturas:crear', (_e, data) => wrap(crearFactura)(db, data))
  ipcMain.handle('facturas:obtener', (_e, id: number) => wrap(obtenerFactura)(db, id))
  ipcMain.handle('facturas:listar', (_e, opts) => wrap(listarFacturas)(db, opts))
  ipcMain.handle('facturas:saldo', (_e, id: number) => wrap(getSaldoFactura)(db, id))
  ipcMain.handle('facturas:registrarPago', (_e, data) => wrap(registrarPago)(db, data))
  ipcMain.handle('facturas:registrarDevolucion', (_e, data) => wrap(registrarDevolucion)(db, data))
  ipcMain.handle('facturas:anular', (_e, id: number) => wrap(anularFactura)(db, id))

  // clases
  ipcMain.handle('clases:listar', (_e, soloActivas?: boolean) =>
    wrap(listarClases)(db, soloActivas)
  )
  ipcMain.handle('clases:crear', (_e, data) => wrap(crearClase)(db, data))
  ipcMain.handle('estudiantes:listar', (_e, soloActivos?: boolean) =>
    wrap(listarEstudiantes)(db, soloActivos)
  )
  ipcMain.handle('estudiantes:obtener', (_e, id: number) => wrap(obtenerEstudiante)(db, id))
  ipcMain.handle('estudiantes:crear', (_e, data) => wrap(crearEstudiante)(db, data))
  ipcMain.handle('estudiantes:desactivar', (_e, id: number) => wrap(desactivarEstudiante)(db, id))
  ipcMain.handle('pagosClases:listarMes', (_e, mes: string) => wrap(listarPagosMes)(db, mes))
  ipcMain.handle('pagosClases:obtenerConDetalles', (_e, id: number) =>
    wrap(obtenerPagoClaseConDetalles)(db, id)
  )
  ipcMain.handle('pagosClases:registrar', (_e, data) => wrap(registrarPagoClase)(db, data))
  ipcMain.handle('pagosClases:generarMes', (_e, mes: string) => wrap(generarPagosDelMes)(db, mes))
  ipcMain.handle('kits:vender', (_e, data) => wrap(venderKit)(db, data))

  // estudiantes — actualizar
  ipcMain.handle('estudiantes:actualizar', (_e, id: number, data) =>
    wrap(actualizarEstudiante)(db, id, data)
  )

  // asistencias
  ipcMain.handle('asistencias:registrar', (_e, data) => wrap(registrarAsistencia)(db, data))
  ipcMain.handle('asistencias:registrarGrupal', (_e, claseId: number, fecha: string, items) =>
    wrap(registrarAsistenciaGrupal)(db, claseId, fecha, items)
  )
  ipcMain.handle('asistencias:listar', (_e, filtros) => wrap(listarAsistencias)(db, filtros))
  ipcMain.handle('asistencias:resumenMes', (_e, estudianteId: number, mes: string) =>
    wrap(resumenAsistenciaMes)(db, estudianteId, mes)
  )

  // finanzas
  ipcMain.handle('finanzas:listarMovimientos', (_e, opts) => wrap(listarMovimientos)(db, opts))
  ipcMain.handle('finanzas:registrarManual', (_e, data) =>
    wrap(registrarMovimientoManual)(db, data)
  )
  ipcMain.handle('finanzas:resumenMensual', (_e, mes: string) => wrap(resumenMensual)(db, mes))
  ipcMain.handle('finanzas:reporteMargenPorTipo', (_e, mes: string) =>
    wrap(reporteMargenPorTipo)(db, mes)
  )

  // inventario
  ipcMain.handle('inventario:listar', (_e, soloActivos?: boolean) =>
    wrap(listarInventario)(db, soloActivos)
  )
  ipcMain.handle('inventario:crear', (_e, data) => wrap(crearItemInventario)(db, data))
  ipcMain.handle('inventario:registrarMovimiento', (_e, data) =>
    wrap(registrarMovimientoInventario)(db, data)
  )
  ipcMain.handle('inventario:alertasStockBajo', () => wrap(alertasStockBajo)(db))

  // contratos
  ipcMain.handle('contratos:listar', (_e, opts) => wrap(listarContratos)(db, opts))
  ipcMain.handle('contratos:obtener', (_e, id: number) => wrap(obtenerContrato)(db, id))
  ipcMain.handle('contratos:crear', (_e, data) => wrap(crearContrato)(db, data))
  ipcMain.handle('contratos:cambiarEstado', (_e, id: number, estado) =>
    wrap(cambiarEstadoContrato)(db, id, estado)
  )
  ipcMain.handle('cuentasCobro:listar', (_e, contratoId?: number) =>
    wrap(listarCuentasCobro)(db, contratoId)
  )
  ipcMain.handle('cuentasCobro:crear', (_e, data) => wrap(crearCuentaCobro)(db, data))
  ipcMain.handle('cuentasCobro:marcarPagada', (_e, id: number, fecha: string) =>
    wrap(marcarCuentaCobroPagada)(db, id, fecha)
  )

  // pdf
  ipcMain.handle('pdf:generarFactura', (_e, data) => wrap(generarFacturaPDF)(db, data))
  ipcMain.handle('pdf:abrir', (_e, filePath: string) => wrap(abrirPDF)(filePath))

  // excel
  ipcMain.handle('excel:exportarFinanzas', (_e, mes: string) =>
    wrap(exportarReporteFinanciero)(db, mes)
  )
  ipcMain.handle('excel:exportarClientes', () => wrap(exportarClientes)(db))
  ipcMain.handle('excel:exportarInventario', () => wrap(exportarInventario)(db))
  ipcMain.handle('excel:exportarListasPrecios', () => wrap(exportarListasPrecios)(db))
  ipcMain.handle('excel:importarMarcos', () => wrap(importarMarcosDesdeExcel)(db))

  // updater — estado del auto-updater (solo lectura) + acciones
  ipcMain.handle('updater:getStatus', () => wrap(getUpdateStatus)())
  ipcMain.handle('updater:quitAndInstall', () => wrap(quitAndInstall)())
  ipcMain.handle('updater:checkNow', () => wrap(checkForUpdatesNow)())

  console.log('[ipc] handlers registered')
}
