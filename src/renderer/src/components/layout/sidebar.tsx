import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, HardDrive, Download } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { SIDEBAR_ITEMS, SIDEBAR_GROUP_LABEL } from '@renderer/lib/constants'
import type { SidebarGroup, SidebarItem } from '@renderer/lib/constants'
import { Tooltip } from '@renderer/components/ui/tooltip'
import type { BackupInfo, IpcResult, Pedido, UpdateStatus } from '@shared/types'

// C-02 — formateo relativo humano para "hace X horas" del indicador de
// backup. `now` se pasa explícitamente para que la función sea pura (no
// llama `Date.now()` durante render, React 19 lo marca como impure).
function formatRelative(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return 'hace menos de 1h'
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `hace ${diffD}d`
}

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

type BadgeCounts = {
  '/pedidos': number
  '/facturas': number
  '/inventario': number
}

export function Sidebar({ collapsed, onToggle }: SidebarProps): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [badges, setBadges] = useState<BadgeCounts>({
    '/pedidos': 0,
    '/facturas': 0,
    '/inventario': 0
  })
  // C-02 — último backup, para mostrar "Respaldo: hace Xh" en la parte
  // inferior del sidebar. Se refresca cada 5 minutos.
  const [ultimoBackup, setUltimoBackup] = useState<BackupInfo | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })

  // Suscribirse a cambios de estado del auto-updater
  useEffect(() => {
    const unsub = window.api.updater.onStatusChange((status) =>
      setUpdateStatus(status as UpdateStatus)
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadBadges(): Promise<void> {
      try {
        const [atrasadosRes, sinAbonoRes, stockRes] = (await Promise.all([
          window.api.pedidos.alertas.atrasados(),
          window.api.pedidos.alertas.sinAbono(),
          window.api.inventario.alertasStockBajo()
        ])) as [IpcResult<Pedido[]>, IpcResult<Pedido[]>, IpcResult<unknown[]>]
        if (!mounted) return
        setBadges({
          '/pedidos':
            (atrasadosRes.ok ? atrasadosRes.data.length : 0) +
            (sinAbonoRes.ok ? sinAbonoRes.data.length : 0),
          '/facturas': 0,
          '/inventario': stockRes.ok ? stockRes.data.length : 0
        })
      } catch (err) {
        console.error('Failed to load sidebar badges:', err)
      }
    }
    async function loadUltimoBackup(): Promise<void> {
      try {
        const res = (await window.api.backup.obtenerUltimo()) as IpcResult<BackupInfo | null>
        if (!mounted) return
        if (res.ok) setUltimoBackup(res.data)
      } catch (err) {
        console.error('Failed to load last backup:', err)
      }
    }
    loadBadges()
    loadUltimoBackup()
    // Badges refrescan cada 10s: el dueño registra un pago y espera ver el
    // contador de facturas bajar rápido. 30s se sentía lento en demos.
    const interval = setInterval(loadBadges, 10_000)
    const backupInterval = setInterval(loadUltimoBackup, 5 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(interval)
      clearInterval(backupInterval)
    }
  }, [])

  // C-02 — estado visual del indicador calculado cuando cambia el ultimo
  // backup o cuando tickRef se actualiza cada 5 minutos. Usamos useMemo
  // con una dependencia adicional `now` que se refresca periodicamente para
  // evitar llamar Date.now() durante el render (React 19 lo marca impure).
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])
  const backupStatus: 'ok' | 'warn' | 'error' = useMemo(() => {
    if (!ultimoBackup) return 'error'
    const hours = (now - new Date(ultimoBackup.fecha).getTime()) / (1000 * 60 * 60)
    if (hours < 24) return 'ok'
    if (hours < 48) return 'warn'
    return 'error'
  }, [ultimoBackup, now])

  const backupColorClasses = {
    ok: 'text-success-strong bg-success-bg',
    warn: 'text-warning-strong bg-warning-bg',
    error: 'text-error-strong bg-error-bg'
  }[backupStatus]

  const backupLabel = ultimoBackup
    ? `Respaldo: ${formatRelative(ultimoBackup.fecha, now)}`
    : 'Sin respaldo'
  const backupTooltipLabel = ultimoBackup
    ? `Último respaldo ${new Date(ultimoBackup.fecha).toLocaleString('es-CO')}. Clic para ver todos los respaldos.`
    : 'Nunca se ha creado un respaldo. Clic para crear el primero.'

  function isActive(path: string): boolean {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-surface border-r border-border transition-all duration-200 select-none shrink-0',
        collapsed ? 'w-15' : 'w-60'
      )}
    >
      {/* El header del sidebar con el logo CA se eliminó porque ahora el
          AppTitleBar muestra el mismo logo + nombre arriba, y duplicarlo
          generaba conflicto visual. La identidad del app queda en un solo
          lugar (la titlebar) y el sidebar arranca directo con los módulos. */}

      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {(Object.keys(SIDEBAR_GROUP_LABEL) as SidebarGroup[]).map((group, groupIndex) => {
          const items = SIDEBAR_ITEMS.filter((i) => i.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className={groupIndex > 0 ? 'mt-3' : undefined}>
              {!collapsed && (
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted px-3 pb-1.5">
                  {SIDEBAR_GROUP_LABEL[group]}
                </p>
              )}
              {collapsed && groupIndex > 0 && (
                <div className="mx-3 my-2 border-t border-border" aria-hidden />
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item: SidebarItem) => {
                  const active = isActive(item.path)
                  const Icon = item.icon
                  const badgeCount = badges[item.path as keyof BadgeCounts] ?? 0

                  const tourAnchor =
                    item.path === '/'
                      ? 'sidebar-dashboard'
                      : item.path === '/cotizador'
                        ? 'sidebar-cotizador'
                        : item.path === '/pedidos'
                          ? 'sidebar-pedidos'
                          : undefined

                  const button = (
                    <button
                      onClick={() => navigate(item.path)}
                      data-tour={tourAnchor}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-md transition-colors cursor-pointer relative',
                        collapsed ? 'h-11 justify-center' : 'h-11 px-3',
                        active
                          ? 'font-semibold text-text before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-[3px] before:rounded-r-full before:bg-accent'
                          : 'text-text-muted hover:bg-surface-muted hover:text-text'
                      )}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                    >
                      <Icon size={20} className="shrink-0" />
                      {!collapsed && (
                        <span className="text-base truncate flex-1">{item.label}</span>
                      )}
                      {badgeCount > 0 &&
                        (collapsed ? (
                          <span
                            aria-live="polite"
                            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-accent text-white text-xs font-bold"
                          >
                            {badgeCount}
                          </span>
                        ) : (
                          <span
                            aria-live="polite"
                            className="h-6 min-w-6 px-1.5 flex items-center justify-center rounded-full bg-accent text-white text-xs font-bold"
                          >
                            {badgeCount}
                          </span>
                        ))}
                    </button>
                  )

                  return (
                    <li key={item.path}>
                      {collapsed ? (
                        <Tooltip content={item.label} position="right">
                          {button}
                        </Tooltip>
                      ) : (
                        button
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border p-2 shrink-0 space-y-1">
        {/* C-02 — Indicador de último respaldo. Clic abre Configuración. */}
        {collapsed ? (
          <Tooltip content={backupTooltipLabel} position="right">
            <button
              onClick={() => navigate('/configuracion')}
              className={cn(
                'w-full h-10 flex items-center justify-center rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                backupColorClasses
              )}
              aria-label={backupLabel}
            >
              <HardDrive size={14} />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => navigate('/configuracion')}
            className={cn(
              'w-full flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
              backupColorClasses
            )}
            title={backupTooltipLabel}
          >
            <HardDrive size={13} className="shrink-0" />
            <span className="truncate">{backupLabel}</span>
          </button>
        )}
        {/* Indicador de actualización — solo visible cuando hay una update descargada */}
        {updateStatus.state === 'downloaded' &&
          (collapsed ? (
            <Tooltip
              content={`v${updateStatus.version} lista — se instala al cerrar`}
              position="right"
            >
              <div className="w-full h-10 flex items-center justify-center rounded-sm text-success-strong bg-success-bg">
                <Download size={14} />
              </div>
            </Tooltip>
          ) : (
            <div className="w-full flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-medium text-success-strong bg-success-bg">
              <Download size={13} className="shrink-0" />
              <span className="truncate">v{updateStatus.version} lista</span>
            </div>
          ))}
        <button
          onClick={onToggle}
          className="w-full h-11 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
    </aside>
  )
}
