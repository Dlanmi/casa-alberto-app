import { useState, useCallback, useEffect, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppTitleBar } from './app-titlebar'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from './command-palette'
import { useKeyboard } from '@renderer/hooks/use-keyboard'
import { useIpc } from '@renderer/hooks/use-ipc'
import { PageLoader } from '@renderer/components/ui/spinner'
import { SIDEBAR_ITEMS } from '@renderer/lib/constants'
import { getPrimaryShortcutCombo } from '@renderer/lib/shortcuts'

export function AppShell(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768)
  const [searchOpen, setSearchOpen] = useState(false)

  const navigate = useNavigate()

  // C-01 — Gate de primera ejecución. Si el flag aún no está en '1', el
  // dueño todavía no ha completado el wizard. Redirigimos desde el shell
  // (cualquier ruta protegida). Usamos useIpc para loading/error consistente.
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

  const shortcuts = useMemo(
    () => [
      // Primary+K — Global search
      { combo: getPrimaryShortcutCombo('k'), handler: () => setSearchOpen((o) => !o) },
      // Primary+N — New quote
      { combo: getPrimaryShortcutCombo('n'), handler: () => navigate('/cotizador') },
      // Escape — Close search
      { combo: { key: 'Escape' }, handler: () => setSearchOpen(false) },
      // Alt+1 to Alt+9 — Module shortcuts
      ...SIDEBAR_ITEMS.slice(0, 9).map((item, i) => ({
        combo: { key: String(i + 1), alt: true },
        handler: () => navigate(item.path)
      }))
    ],
    [navigate]
  )

  useKeyboard(shortcuts)

  // C-01 — mientras consultamos el flag, mostramos loader. Si ya sabemos
  // que el usuario NO completó onboarding, el effect de arriba ya nos va a
  // redirigir — mostramos loader mientras tanto para evitar flash del shell.
  if (flagLoading || completed === false) {
    return <PageLoader />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppTitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar onOpenSearch={openSearch} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={searchOpen} onClose={closeSearch} />
    </div>
  )
}
