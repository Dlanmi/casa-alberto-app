import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import type { UpdateStatus } from '@shared/types'

// Logger mínimo para electron-updater (no requiere electron-log)
autoUpdater.logger = {
  info: (...args: unknown[]) => console.log('[updater]', ...args),
  warn: (...args: unknown[]) => console.warn('[updater]', ...args),
  error: (...args: unknown[]) => console.error('[updater]', ...args),
  debug: (...args: unknown[]) => console.debug('[updater]', ...args)
}

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let currentStatus: UpdateStatus = { state: 'idle' }

function setStatus(s: UpdateStatus): void {
  currentStatus = s
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:status', currentStatus)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[updater] omitido — app no empaquetada (dev mode)')
    return
  }

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    setStatus({ state: 'available', version: info.version })
    autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-not-available', () => {
    setStatus({ state: 'idle' })
  })

  autoUpdater.on('download-progress', (progress) => {
    setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setStatus({ state: 'downloaded', version: info.version })
    console.log(`[updater] v${info.version} descargada — se instala al cerrar`)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
    setStatus({ state: 'error', message: err.message })
    setTimeout(() => setStatus({ state: 'idle' }), 30_000)
  })

  // Primer check 10s después de boot
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] check inicial falló:', err.message)
    })
  }, 10_000)

  // Cada 4 horas mientras la app esté abierta
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[updater] check periódico falló:', err.message)
      })
    },
    4 * 60 * 60 * 1000
  )
}
