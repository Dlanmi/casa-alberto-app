import { Input } from '@renderer/components/ui/input'
import { useDecimalInput } from '@renderer/lib/use-decimal-input'
import type { WizardData } from './wizard-shell'

// BR-002 — Fase 2 §A.1: medidas válidas entre 1 y 500 cm. El backend valida,
// el UI previene: clamp temprano ayuda a que `canContinueFromStep` se actualice
// correctamente cuando el papá tipea algo absurdo (negativo o NaN).
const MEDIDA_MAX_CM = 500

// Patrón permisivo para permitir decimales con punto o coma (43.32, 43,32).
// El teclado móvil se activa con `inputMode="decimal"`; el pattern evita que
// el navegador marque el campo como inválido mientras el papá escribe.
const MEDIDA_PATTERN = '[0-9]*[.,]?[0-9]*'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
}

export function StepMedidas({ data, onChange }: Props): React.JSX.Element {
  // BR-003 — Fase 2 §A.2.1: las medidas del vidrio se redondean al múltiplo
  // de 10 superior. Mostrar la vista previa en vivo ayuda al usuario a entender
  // por qué el precio cambia cuando pasa de 31 cm a 32 cm (salta a 40).
  const mostrarRedondeoVidrio = data.conVidrio || data.anchoCm > 0
  const anchoRedondeado = data.anchoCm > 0 ? Math.ceil(data.anchoCm / 10) * 10 : 0
  const altoRedondeado = data.altoCm > 0 ? Math.ceil(data.altoCm / 10) * 10 : 0
  const cambiaAncho = anchoRedondeado !== data.anchoCm
  const cambiaAlto = altoRedondeado !== data.altoCm

  const ancho = useDecimalInput(data.anchoCm, (n) => onChange({ anchoCm: n }), {
    max: MEDIDA_MAX_CM
  })
  const alto = useDecimalInput(data.altoCm, (n) => onChange({ altoCm: n }), { max: MEDIDA_MAX_CM })

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">Medidas</h2>
      <p className="text-sm text-text-muted mb-6">
        Ancho y alto de la pieza, en centímetros y medida interior.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        <Input
          label="Ancho (cm)"
          type="number"
          inputMode="decimal"
          pattern={MEDIDA_PATTERN}
          min={1}
          max={MEDIDA_MAX_CM}
          value={ancho.raw}
          onChange={ancho.handleChange}
          placeholder="Ej: 43.32"
        />
        <Input
          label="Alto (cm)"
          type="number"
          inputMode="decimal"
          pattern={MEDIDA_PATTERN}
          min={1}
          max={MEDIDA_MAX_CM}
          value={alto.raw}
          onChange={alto.handleChange}
          placeholder="Ej: 70.5"
        />
      </div>

      {data.anchoCm > 0 && data.altoCm > 0 && (
        <div className="mt-4 space-y-2 max-w-md">
          <div className="p-3 bg-surface-muted rounded-md text-sm text-text-muted">
            Dimensión base: {data.anchoCm} × {data.altoCm} cm
          </div>

          {mostrarRedondeoVidrio && (cambiaAncho || cambiaAlto) && (
            <div className="p-3 bg-info-bg border border-info/30 rounded-md text-sm text-info-strong">
              <p className="font-semibold mb-1">Redondeo para vidrio</p>
              <p className="text-xs leading-relaxed">
                El vidrio se corta y cobra al múltiplo de 10 superior (Fase 2 §A.2):{' '}
                <span className="font-medium">
                  {data.anchoCm} → {anchoRedondeado} cm
                </span>
                ,{' '}
                <span className="font-medium">
                  {data.altoCm} → {altoRedondeado} cm
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
