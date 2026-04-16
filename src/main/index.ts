import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDb } from './db'
import { runMigrations } from './db/migrate'
import { ensureConfigInicial } from './db/seed'
import { getConfig, setConfig } from './db/queries/configuracion'
import { registerIpcHandlers } from './ipc'
import { reclasificarPedidos } from './db/queries/pedidos'
import { generarPagosDelMes } from './db/queries/clases'
import { crearBackupAhora, obtenerUltimoBackup } from './db/backup'
import { initAutoUpdater } from './updater'

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    // Título explícito de la ventana. Blinda contra que algún
    // componente React haga `document.title = ...` o que el HTML
    // tarde en cargar y Windows muestre "Electron" unos ms.
    title: 'Casa Alberto',
    // --- Custom titlebar ---
    // En macOS usamos `hiddenInset` que oculta la barra pero mantiene
    // los semáforos (rojo/amarillo/verde) con padding natural.
    // En Windows usamos `hidden` + `titleBarOverlay` que dibuja un área
    // draggable del color que elijamos y mantiene los botones nativos
    // minimizar/maximizar/cerrar a la derecha (los iconos del sistema).
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 14 } }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#ffffff', // --color-surface del tema (main.css)
            symbolColor: '#57534e', // --color-text-muted (warm neutral-700)
            height: 44
          }
        }),
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // `sandbox: false` es requerido por @electron-toolkit/preload (usa require()).
      // Todo lo demás se fija explícitamente para blindar contra cambios
      // accidentales de defaults en futuras versiones de Electron.
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Solo abrir protocolos seguros en el navegador del sistema. Bloquea
    // `file:`, `javascript:`, `vbscript:` y cualquier otro esquema que pueda
    // ejecutar código o exponer el filesystem.
    try {
      const parsed = new URL(details.url)
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        shell.openExternal(details.url)
      }
    } catch {
      // URL malformada: ignorar silenciosamente
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.casaalberto.app')

  // En macOS dev mode el dock muestra el icono genérico de Electron.
  // Forzamos el icono custom para que siempre se vea "CA".
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    app.dock.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const db = initDb()

    // Backup pre-migración: si la versión de la app cambió (update),
    // respaldar la DB ANTES de aplicar migraciones nuevas.
    // En primera instalación la tabla no existe aún — skip silencioso.
    const currentVersion = app.getVersion()
    try {
      const lastVersion = getConfig(db, 'app_version')
      if (lastVersion !== currentVersion) {
        const info = crearBackupAhora()
        console.log(
          `[boot] backup pre-migración (v${lastVersion ?? '?'} → v${currentVersion}): ${info.nombre}`
        )
      }
    } catch {
      // Primera instalación: no hay tablas aún, nada que respaldar
    }

    runMigrations(db)
    // Guardar versión actual después de migrar exitosamente
    setConfig(db, 'app_version', currentVersion, 'Versión de la aplicación instalada')
    // Fase B — solo aseguramos las claves de configuración mínimas. NO se
    // insertan datos de demostración automáticamente. Si el usuario quiere
    // datos de ejemplo, debe elegirlo explícitamente en el wizard de
    // onboarding via IPC `app:loadDemoData`.
    ensureConfigInicial(db)
    registerIpcHandlers(db)

    // Tareas automáticas de arranque (idempotentes):
    //  - Reclasificar pedidos listo→sin_reclamar tras +15 días (BR-009)
    //  - Generar pagos mensuales de clases del mes actual (BR-012)
    //  - Verificar que haya un backup reciente; si no, crear uno (C-02)
    try {
      const reclasificados = reclasificarPedidos(db)
      if (reclasificados > 0) {
        console.log(`[boot] ${reclasificados} pedido(s) marcados como sin_reclamar`)
      }
      const mesActual = new Date().toISOString().slice(0, 7)
      const pagosCreados = generarPagosDelMes(db, mesActual)
      if (pagosCreados > 0) {
        console.log(`[boot] ${pagosCreados} pago(s) de clase generado(s) para ${mesActual}`)
      }
      // C-02: si hace más de 24h que no se crea un backup (o nunca), hacerlo
      // ahora. Esto cubre el caso del papá que abre la app cada día: cada
      // mañana arranca un backup fresco del trabajo del día anterior.
      const ultimo = obtenerUltimoBackup()
      const necesitaBackup =
        !ultimo || Date.now() - new Date(ultimo.fecha).getTime() > BACKUP_INTERVAL_MS
      if (necesitaBackup) {
        const info = crearBackupAhora()
        console.log(`[boot] backup automático creado: ${info.nombre}`)
      }
    } catch (bootErr) {
      // Las tareas automáticas no deben tumbar la app si fallan.
      console.error('[boot] tarea automática falló:', bootErr)
    }

    // C-02 — Scheduler diario: mientras la app esté abierta, crea un backup
    // cada 24 horas. Si el papá la deja abierta varios días seguidos, el
    // intervalo se encarga. Si la cierra y reabre, el check de boot de
    // arriba se encarga.
    setInterval(() => {
      try {
        const info = crearBackupAhora()
        console.log(`[scheduler] backup diario: ${info.nombre}`)
      } catch (err) {
        console.error('[scheduler] backup diario falló:', err)
      }
    }, BACKUP_INTERVAL_MS)
  } catch (err) {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[boot] fatal error initializing database:', msg)
    dialog.showErrorBox(
      'Error al iniciar CasaAlberto',
      `No se pudo inicializar la base de datos.\n\n${msg}`
    )
    app.exit(1)
    return
  }

  createWindow()
  initAutoUpdater()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
