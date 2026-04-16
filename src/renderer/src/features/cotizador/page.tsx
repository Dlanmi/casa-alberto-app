import { useState } from 'react'
import { Settings } from 'lucide-react'
import { WorkflowScreen } from '@renderer/components/layout/page-frame'
import { Card } from '@renderer/components/ui/card'
import { TipoTrabajoGrid } from './tipo-trabajo-grid'
import { WizardShell } from './wizard/wizard-shell'
import { ListasPrecios } from './listas-precios'
import type { Cliente, TipoTrabajo } from '@shared/types'

export default function CotizadorPage(): React.JSX.Element {
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
        <TipoTrabajoGrid onSelect={setTipoTrabajo} onManagePrecios={() => setShowPrecios(true)} />
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
