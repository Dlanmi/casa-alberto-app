import { createHashRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from '@renderer/contexts/toast-context'
import { EmojisProvider } from '@renderer/contexts/emojis-context'
import { AppShell } from '@renderer/components/layout/app-shell'
import { AppRouteError } from '@renderer/components/layout/app-route-error'
import DashboardPage from '@renderer/features/dashboard/page'
import AgendaPage from '@renderer/features/agenda/page'
import CotizadorPage from '@renderer/features/cotizador/page'
import PedidosPage from '@renderer/features/pedidos/page'
import FacturasPage from '@renderer/features/facturas/page'
import ClientesPage from '@renderer/features/clientes/page'
import ClasesPage from '@renderer/features/clases/page'
import FinanzasPage from '@renderer/features/finanzas/page'
import ProveedoresPage from '@renderer/features/proveedores/page'
import ContratosPage from '@renderer/features/contratos/page'
import InventarioPage from '@renderer/features/inventario/page'
import ConfiguracionPage from '@renderer/features/configuracion/page'
import OnboardingPage from '@renderer/features/onboarding/page'

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppRouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'cotizador', element: <CotizadorPage /> },
      { path: 'pedidos', element: <PedidosPage /> },
      { path: 'pedidos/:id', element: <PedidosPage /> },
      { path: 'facturas', element: <FacturasPage /> },
      { path: 'facturas/:id', element: <FacturasPage /> },
      { path: 'clientes', element: <ClientesPage /> },
      { path: 'clientes/:id', element: <ClientesPage /> },
      { path: 'clases', element: <ClasesPage /> },
      { path: 'finanzas', element: <FinanzasPage /> },
      { path: 'proveedores', element: <ProveedoresPage /> },
      { path: 'contratos', element: <ContratosPage /> },
      { path: 'contratos/:id', element: <ContratosPage /> },
      { path: 'inventario', element: <InventarioPage /> },
      { path: 'configuracion', element: <ConfiguracionPage /> }
    ]
  },
  { path: '/onboarding', element: <OnboardingPage />, errorElement: <AppRouteError /> }
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
