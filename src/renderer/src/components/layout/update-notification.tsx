import { useEffect, useState } from 'react'
import { CheckCircle2, Download, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useUpdateStatus } from '@renderer/hooks/use-update-status'
import { cn } from '@renderer/lib/cn'

// Banner flotante abajo a la derecha que refleja el estado del auto-updater.
// Pensado para el papá de 60 años: tipografía legible, copias calmadas, botón
// de acción primario bien visible cuando la update está lista. Los estados
// efímeros (checking, available, update-not-available) no se muestran porque
// el main los atraviesa en segundos y mostrarlos generaría un parpadeo.
export function UpdateNotification(): React.JSX.Element | null {
  const { status, quitAndInstall } = useUpdateStatus()
  const [dismissed, setDismissed] = useState(false)
  const [restarting, setRestarting] = useState(false)

  // Si el estado cambia (p. ej. llega una nueva descarga mientras el usuario
  // había oculto la anterior con "Después"), volvemos a mostrar el banner.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false)
  }, [status.state])

  if (dismissed) return null
  if (status.state === 'idle' || status.state === 'checking' || status.state === 'available') {
    return null
  }

  const isDownloading = status.state === 'downloading'
  const isDownloaded = status.state === 'downloaded'
  const isError = status.state === 'error'

  async function handleRestart(): Promise<void> {
    setRestarting(true)
    try {
      await quitAndInstall()
    } catch {
      // Si falla, quitamos el spinner. El main loggea el error; al usuario no
      // le damos detalles técnicos.
      setRestarting(false)
    }
  }

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        // Colocado encima del HelpButton (bottom-6 + 48px help + 24px gap = bottom-24).
        // Ancho 380px: cómodo para botones "Reiniciar ahora" + "Después" sin apretar.
        // En viewport chico se adapta restando el margen horizontal.
        'fixed bottom-24 right-6 z-50 w-[min(380px,calc(100vw-3rem))]',
        'rounded-lg border bg-surface shadow-(--shadow-4) animate-slide-in-right',
        'border-border'
      )}
    >
      {isDownloading && (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-accent-strong">
              <Download size={18} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-text">Descargando actualización</p>
              <p className="mt-1 text-sm text-text-muted">
                {status.percent}% — esto puede tomar unos minutos.
              </p>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.percent}
                aria-label="Progreso de descarga"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                  style={{ width: `${status.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isDownloaded && (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-strong">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-text">Actualización lista</p>
              <p className="mt-1 text-sm text-text-muted">
                Casa Alberto v{status.version} se instalará al reiniciar.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRestart}
                  disabled={restarting}
                  aria-label={`Reiniciar e instalar la versión ${status.version}`}
                >
                  {restarting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Reiniciando…
                    </>
                  ) : (
                    'Reiniciar ahora'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissed(true)}
                  disabled={restarting}
                >
                  Después
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-bg text-error-strong">
              <AlertCircle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-text">No pudimos actualizar</p>
              <p className="mt-1 text-sm text-text-muted">
                Revisa tu conexión a internet. Lo intentaremos de nuevo más tarde.
              </p>
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
