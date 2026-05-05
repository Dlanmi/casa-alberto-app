import { useState, useCallback, useEffect, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppTitleBar } from './app-titlebar'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from './command-palette'
import { getEntityProviders } from './command-providers'
import { createAccionesProvider } from './command-actions-provider'
import { createRecientesProvider } from './command-recent-provider'
import { ShortcutsHelp } from './shortcuts-help'
import {
  getRecentEntitiesSnapshot,
  useTrackRouteAsRecent
} from '@renderer/hooks/use-recent-entities'
import { HelpButton } from './help-button'
import { WelcomeTour } from './welcome-tour'
import { UpdateNotification } from './update-notification'
import { useKeyboard } from '@renderer/hooks/use-keyboard'
import { useIpc } from '@renderer/hooks/use-ipc'
import { PageLoader } from '@renderer/components/ui/spinner'
import { SIDEBAR_ITEMS } from '@renderer/lib/constants'
import { getPrimaryShortcutCombo } from '@renderer/lib/shortcuts'

export function AppShell(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const navigate = useNavigate()

  // Gate de primera ejecución. Si el flag aún no está en '1', el dueño
  // todavía no ha completado el wizard. Redirigimos desde el shell para
  // capturar cualquier ruta protegida. useIpc da loading/error consistente.
  const { data: completed, loading: flagLoading } = useIpc<boolean>(
    () => window.api.configuracion.isOnboardingCompleted(),
    []
  )

  useEffect(() => {
    if (!flagLoading && completed === false) {
      navigate('/onboarding', { replace: true })
    }
  }, [flagLoading, completed, navigate])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    function handleChange(e: MediaQueryListEvent): void {
      if (e.matches) setSidebarCollapsed(true)
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // Track navegación a páginas detalle para alimentar el provider de recientes.
  useTrackRouteAsRecent()

  // Conjunto de providers que alimenta el CommandPalette. Orden visual:
  //   1. Recientes (cuando palette se abre vacío) — lee del store sin React
  //   2. Acciones rápidas (siempre)
  //   3. Entidades (clientes, pedidos, facturas, …)
  // El array es estable (deps vacías) — el provider de recientes lee la
  // snapshot al ejecutar, no al construirse, así que el palette no pierde
  // su query de búsqueda cuando el usuario navega a una página detalle.
  const commandProviders = useMemo(
    () => [
      createRecientesProvider(getRecentEntitiesSnapshot),
      createAccionesProvider({ verAtajos: () => setShortcutsOpen(true) }),
      ...getEntityProviders()
    ],
    []
  )

  // Helper que combina el modificador primario (Ctrl en Win, ⌘ en Mac) con
  // Shift+letra. Mantiene la guía Mac/Windows centralizada en `shortcuts.ts`.
  const shiftPrimaryCombo = useCallback((key: string) => {
    const base = getPrimaryShortcutCombo(key)
    return { ...base, shift: true }
  }, [])

  const shortcuts = useMemo(
    () => [
      // Primary+K — Búsqueda global
      { combo: getPrimaryShortcutCombo('k'), handler: () => setSearchOpen((o) => !o) },
      // Primary+N — Nueva cotización
      { combo: getPrimaryShortcutCombo('n'), handler: () => navigate('/cotizador') },
      // Primary+/ — Help overlay de atajos. Usamos `ignoreShift=true` porque
      // en teclados es-LA `/` se obtiene con Shift+7: el `e.key` resulta `/`
      // pero `e.shiftKey` es true. Sin `ignoreShift`, el match fallaría en
      // ese layout. En US-QWERTY donde `/` es directo, ignorar shift no
      // afecta porque no hay chance de un Shift+/ legítimo distinto.
      {
        combo: { ...getPrimaryShortcutCombo('/'), ignoreShift: true },
        handler: () => setShortcutsOpen((o) => !o)
      },
      // Escape — Cierra search/help
      {
        combo: { key: 'Escape' },
        handler: () => {
          setSearchOpen(false)
          setShortcutsOpen(false)
        }
      },
      // Atajos directos de creación. Cada uno navega a la página destino con
      // el flag `?nuevo=1` (o variante) — la página lee el flag con
      // `useQueryFlag` y abre el modal correspondiente. Single source of truth.
      { combo: shiftPrimaryCombo('c'), handler: () => navigate('/clientes?nuevo=1') },
      { combo: shiftPrimaryCombo('f'), handler: () => navigate('/facturas?nueva=1') },
      { combo: shiftPrimaryCombo('v'), handler: () => navigate('/proveedores?nuevo=1') },
      { combo: shiftPrimaryCombo('p'), handler: () => navigate('/cotizador') },
      // Alt+1 to Alt+9 — Atajos a módulos de la sidebar
      ...SIDEBAR_ITEMS.slice(0, 9).map((item, i) => ({
        combo: { key: String(i + 1), alt: true },
        handler: () => navigate(item.path)
      }))
    ],
    [navigate, shiftPrimaryCombo]
  )

  useKeyboard(shortcuts)

  // Mientras consultamos el flag de onboarding, mostramos loader. Si ya
  // sabemos que el usuario NO completó el wizard, el effect de arriba va a
  // redirigir — el loader evita el flash del shell antes del redirect.
  if (flagLoading || completed === false) {
    return <PageLoader />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppTitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar onOpenSearch={openSearch} onOpenShortcuts={() => setShortcutsOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={searchOpen} onClose={closeSearch} providers={commandProviders} />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <HelpButton />
      <WelcomeTour />
      <UpdateNotification />
    </div>
  )
}
