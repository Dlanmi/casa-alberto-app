import { MuestraMarcoPicker } from '@renderer/components/shared/muestra-marco-picker'
import type { MuestraMarcoConProveedor } from '@shared/types'
import type { WizardData } from './wizard-shell'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
  marcos: MuestraMarcoConProveedor[]
}

export function StepMarco({ data, onChange, marcos }: Props): React.JSX.Element {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">Seleccionar marco</h2>
      <p className="text-sm text-text-muted mb-4">
        El cliente escoge la muestra. Cada referencia tiene colilla y precio por metro.
      </p>

      <MuestraMarcoPicker
        marcos={marcos}
        selectedId={data.muestraMarcoId}
        onSelect={(marco) => onChange({ muestraMarcoId: marco.id, muestraMarco: marco })}
      />
    </div>
  )
}
