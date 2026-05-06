import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, PackagePlus } from 'lucide-react'
import { WorkflowScreen } from '@renderer/components/layout/page-frame'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { TipoTrabajoGrid } from './tipo-trabajo-grid'
import { WizardShell } from './wizard/wizard-shell'
import { ListasPrecios } from './listas-precios'
import type { Cliente, TipoTrabajo } from '@shared/types'

export default function CotizadorPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [tipoTrabajo, setTipoTrabajo] = useState<TipoTrabajo | null>(null)
  const [showPrecios, setShowPrecios] = useState(false)
  const [cliente, setCliente] = useState<Cliente | null>(null)

  if (showPrecios) {
    return <ListasPrecios onBack={() => setShowPrecios(false)} />
  }

  if (tipoTrabajo) {
    return (
      <WizardShell
        tipoTrabajo={tipoTrabajo}
        onBack={() => setTipoTrabajo(null)}
        cliente={cliente}
        onClienteChange={setCliente}
      />
    )
  }

  return (
    <WorkflowScreen
      title="Cotizador operativo"
      subtitle="Elige el tipo de trabajo, calcula el precio y al final vincula al cliente para convertirlo en pedido."
      primaryAction={{
        label: 'Gestionar precios',
        onClick: () => setShowPrecios(true),
        icon: Settings,
        variant: 'secondary'
      }}
      main={
        <div className="space-y-5">
          {/* CTA destacado para el flujo multi-trabajo: cliente con varios
              cuadros distintos en una sola visita. Camino normal para el papá
              cuando hay más de una pieza para enmarcar. */}
          <Card padding="md" className="border-2 border-accent/30 bg-accent/5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                <PackagePlus size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text">
                  ¿Cliente con varios trabajos?
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  Si trae 2 o más cuadros (con marcos, paspartús o tipos de
                  trabajo distintos), agrégalos juntos en un solo pedido y una
                  sola factura.
                </p>
              </div>
              <Button onClick={() => navigate('/cotizador/pedido')} size="lg">
                Nuevo pedido
              </Button>
            </div>
          </Card>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">
              O cotiza un trabajo individual
            </h3>
            <TipoTrabajoGrid
              onSelect={setTipoTrabajo}
              onManagePrecios={() => setShowPrecios(true)}
            />
          </div>
        </div>
      }
      aside={
        <Card padding="md" className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
            Qué sigue
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-text">Si es un trabajo frecuente</p>
              <p className="text-sm text-text-muted">
                Usa primero enmarcación estándar, con paspartú o vidrio/espejo. Son los flujos más
                rápidos de cerrar.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Si es artesanal o a criterio</p>
              <p className="text-sm text-text-muted">
                Elige restauración o acolchado y deja una descripción útil para el PDF y el pedido.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Si cambia la lista base</p>
              <p className="text-sm text-text-muted">
                Entra a gestionar precios antes de cotizar para no corregir manualmente al final.
              </p>
            </div>
          </div>
        </Card>
      }
    />
  )
}
