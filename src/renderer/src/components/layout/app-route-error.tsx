import { AlertTriangle, Home, RefreshCcw } from 'lucide-react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'

type ErrorCopy = {
  title: string
  message: string
  technical?: string
}

function getErrorCopy(error: unknown): ErrorCopy {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'No encontramos esa pantalla',
        message:
          'La ruta que intentaste abrir ya no existe o cambió. Puedes volver al tablero y continuar desde allí.',
        technical: `${error.status} ${error.statusText}`
      }
    }

    return {
      title: 'No pudimos abrir esta vista',
      message:
        'La app encontró un problema al cargar esta pantalla. Puedes volver al inicio o recargar para intentar de nuevo.',
      technical: `${error.status} ${error.statusText}`
    }
  }

  if (error instanceof Error) {
    return {
      title: 'Algo salió mal al abrir esta vista',
      message:
        'La operación no pudo completarse como esperábamos. Vuelve al inicio o recarga la app para retomar el flujo.',
      technical: error.message
    }
  }

  return {
    title: 'Algo salió mal al abrir esta vista',
    message:
      'La operación no pudo completarse como esperábamos. Vuelve al inicio o recarga la app para retomar el flujo.'
  }
}

export function AppRouteError(): React.JSX.Element {
  const navigate = useNavigate()
  const error = useRouteError()
  const copy = getErrorCopy(error)

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <Card padding="lg" className="w-full max-w-xl space-y-6 border-border bg-surface shadow-3">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error-bg">
            <AlertTriangle size={22} className="text-error-strong" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
              Error de navegación
            </p>
            <h1 className="text-2xl font-semibold text-text">{copy.title}</h1>
            <p className="text-sm leading-6 text-text-muted">{copy.message}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/')}>
            <Home size={16} />
            Volver al inicio
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCcw size={16} />
            Recargar la app
          </Button>
        </div>

        {copy.technical && (
          <div className="rounded-md border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
              Detalle técnico
            </p>
            <p className="mt-1 text-sm text-text-muted">{copy.technical}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
