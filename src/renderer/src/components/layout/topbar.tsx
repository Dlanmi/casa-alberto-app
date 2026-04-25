import { useLocation, useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Sparkles } from 'lucide-react'
import { SIDEBAR_ITEMS } from '@renderer/lib/constants'
import { diaSemana } from '@renderer/lib/format'
import { formatPrimaryShortcut } from '@renderer/lib/shortcuts'

type TopbarProps = {
  onOpenSearch: () => void
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function getFormattedDate(): string {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const now = new Date()
  const dia = dias[diaSemana(now)]
  const formatted = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(now)

  return `${dia}, ${formatted}`
}

function getRouteHint(pathname: string): string {
  if (pathname.startsWith('/cotizador')) return 'Cotiza y crea un pedido sin salir del flujo.'
  if (pathname.startsWith('/pedidos')) return 'Arrastra tarjetas o abre un pedido para continuar.'
  if (pathname.startsWith('/facturas')) return 'Registra abonos y controla el saldo del cliente.'
  if (pathname.startsWith('/clientes')) return 'Mantén aquí el historial y los datos de contacto.'
  if (pathname.startsWith('/inventario'))
    return 'Revisa alertas de stock antes de que falte material.'
  if (pathname.startsWith('/configuracion'))
    return 'Completa primero los datos del negocio y los precios.'
  return 'Revisa alertas, pendientes y próximas entregas del día.'
}

export function Topbar({ onOpenSearch }: TopbarProps): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const segments = location.pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: 'Dashboard', path: '/' }]

  if (segments.length > 0) {
    const item = SIDEBAR_ITEMS.find((s) => s.path === `/${segments[0]}`)
    if (item) {
      crumbs.push({ label: item.label, path: item.path })
    }
  }

  return (
    <header className="h-14 flex items-center gap-4 px-6 border-b border-border bg-surface shrink-0">
      <nav className="flex items-center gap-1 text-sm min-w-0 shrink-0" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-text-soft" />}
            {i < crumbs.length - 1 ? (
              <button
                onClick={() => navigate(crumb.path)}
                className="text-text-soft hover:text-text-muted cursor-pointer"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-text font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-surface text-text-muted hover:border-border-strong hover:text-text transition-colors cursor-pointer shrink-0"
        aria-label="Abrir búsqueda global"
      >
        <Search size={16} />
        <span className="text-sm">Buscar…</span>
        <kbd className="hidden sm:inline-block text-xs bg-surface-muted px-1.5 py-0.5 rounded text-text-muted">
          {formatPrimaryShortcut('k')}
        </kbd>
      </button>

      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-xs text-text-muted max-w-xs">
          <Sparkles size={14} className="text-accent-strong shrink-0" />
          <span className="truncate">{getRouteHint(location.pathname)}</span>
        </div>

        <div className="text-right hidden md:block">
          <p className="text-sm font-medium text-text">{getGreeting()}, Alberto</p>
          <p className="text-xs text-text-muted">{getFormattedDate()}</p>
        </div>

        <div className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold shrink-0">
          AR
        </div>
      </div>
    </header>
  )
}
