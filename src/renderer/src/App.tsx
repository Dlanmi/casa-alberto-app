import { lazy, Suspense } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from '@renderer/contexts/toast-context'
import { EmojisProvider } from '@renderer/contexts/emojis-context'
import { AppShell } from '@renderer/components/layout/app-shell'
import { AppRouteError } from '@renderer/components/layout/app-route-error'
import { PageLoader } from '@renderer/components/ui/spinner'
import DashboardPage from '@renderer/features/dashboard/page'

// Lazy-load todas las rutas salvo Dashboard (es la de arranque). Esto evita
// que la app cargue ~12 módulos en el bundle inicial, que era el costo
// dominante en el tiempo hasta primer render en producción.
const AgendaPage = lazy(() => import('@renderer/features/agenda/page'))
const CotizadorPage = lazy(() => import('@renderer/features/cotizador/page'))
const PedidosPage = lazy(() => import('@renderer/features/pedidos/page'))
const FacturasPage = lazy(() => import('@renderer/features/facturas/page'))
const ClientesPage = lazy(() => import('@renderer/features/clientes/page'))
const ClasesPage = lazy(() => import('@renderer/features/clases/page'))
const FinanzasPage = lazy(() => import('@renderer/features/finanzas/page'))
const ProveedoresPage = lazy(() => import('@renderer/features/proveedores/page'))
const ContratosPage = lazy(() => import('@renderer/features/contratos/page'))
const InventarioPage = lazy(() => import('@renderer/features/inventario/page'))
const ConfiguracionPage = lazy(() => import('@renderer/features/configuracion/page'))
const OnboardingPage = lazy(() => import('@renderer/features/onboarding/page'))

function lazyRoute(element: React.ReactNode): React.JSX.Element {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>
}

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppRouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'agenda', element: lazyRoute(<AgendaPage />) },
      { path: 'cotizador', element: lazyRoute(<CotizadorPage />) },
      { path: 'pedidos', element: lazyRoute(<PedidosPage />) },
      { path: 'pedidos/:id', element: lazyRoute(<PedidosPage />) },
      { path: 'facturas', element: lazyRoute(<FacturasPage />) },
      { path: 'facturas/:id', element: lazyRoute(<FacturasPage />) },
      { path: 'clientes', element: lazyRoute(<ClientesPage />) },
      { path: 'clientes/:id', element: lazyRoute(<ClientesPage />) },
      { path: 'clases', element: lazyRoute(<ClasesPage />) },
      { path: 'finanzas', element: lazyRoute(<FinanzasPage />) },
      { path: 'proveedores', element: lazyRoute(<ProveedoresPage />) },
      { path: 'contratos', element: lazyRoute(<ContratosPage />) },
      { path: 'contratos/:id', element: lazyRoute(<ContratosPage />) },
      { path: 'inventario', element: lazyRoute(<InventarioPage />) },
      { path: 'configuracion', element: lazyRoute(<ConfiguracionPage />) }
    ]
  },
  {
    path: '/onboarding',
    element: lazyRoute(<OnboardingPage />),
    errorElement: <AppRouteError />
  }
])

function App(): React.JSX.Element {
  return (
    <EmojisProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </EmojisProvider>
  )
}

export default App
