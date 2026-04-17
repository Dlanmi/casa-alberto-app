import { Slider } from '@renderer/components/ui/slider'
import type { WizardData } from './wizard-shell'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
}

export function StepMateriales({ data, onChange }: Props): React.JSX.Element {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">Materiales adicionales</h2>
      <p className="text-sm text-text-muted mb-6">
        Cartón, puntillas, pegante, cinta y piola — como % del subtotal.
      </p>

      <div className="max-w-md">
        <Slider
          label="Porcentaje de materiales"
          min={5}
          max={10}
          step={1}
          value={data.porcentajeMateriales}
          onChange={(e) =>
            onChange({ porcentajeMateriales: Number((e.target as HTMLInputElement).value) })
          }
          suffix="%"
        />

        <p className="mt-4 text-sm text-text-muted">
          Cuadros económicos: 10%. Cuadros grandes o costosos: 5% a 10%, según criterio.
        </p>
      </div>
    </div>
  )
}
