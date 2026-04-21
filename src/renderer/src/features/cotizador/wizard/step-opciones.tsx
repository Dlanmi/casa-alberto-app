import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Slider } from '@renderer/components/ui/slider'
import { useIpc } from '@renderer/hooks/use-ipc'
import { formatCOP } from '@renderer/lib/format'
import type { PrecioVidrio, TipoTrabajo } from '@shared/types'
import type { WizardData } from './wizard-shell'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
  tipoTrabajo: TipoTrabajo
}

function labelVidrio(tipo: string): string {
  return tipo
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StepOpciones({ data, onChange, tipoTrabajo }: Props): React.JSX.Element {
  const showPaspartu = tipoTrabajo === 'enmarcacion_estandar'

  const { data: vidrios } = useIpc<PrecioVidrio[]>(
    () => window.api.cotizador.listarPreciosVidrio(),
    []
  )

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">Opciones</h2>
      <p className="text-sm text-text-muted mb-6">Configura paspartú y vidrio para este cuadro.</p>

      <div className="space-y-8 max-w-lg">
        {/* Paspartú */}
        {showPaspartu && (
          <div className="bg-surface rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-sm font-semibold text-text">Paspartú</span>
                <p className="text-xs text-text-muted mt-0.5">
                  Se coloca alrededor de la obra. Amplía las dimensiones del marco y el vidrio.
                </p>
              </div>
              <button
                onClick={() => onChange({ conPaspartu: !data.conPaspartu })}
                className={cn(
                  'relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0',
                  data.conPaspartu ? 'bg-success' : 'bg-border'
                )}
                aria-label={data.conPaspartu ? 'Desactivar paspartu' : 'Activar paspartu'}
              >
                <span
                  className={cn(
                    'absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-1 transition-all duration-200',
                    data.conPaspartu ? 'left-[23px]' : 'left-[3px]'
                  )}
                />
              </button>
            </div>

            {data.conPaspartu && (
              <div className="space-y-5 pt-2 border-t border-border">
                <div className="pt-4">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
                    Tipo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        key: 'pintado' as const,
                        label: 'Pintado (cartón)',
                        desc: 'Cartón prensado, pintado a mano por el dueño.'
                      },
                      {
                        key: 'acrilico' as const,
                        label: 'Acrílico (MDF)',
                        desc: 'MDF pintado. Tiene un precio más alto.'
                      }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => onChange({ tipoPaspartu: opt.key })}
                        className={cn(
                          'relative flex flex-col items-start p-4 rounded-lg border-2 cursor-pointer transition-all text-left',
                          data.tipoPaspartu === opt.key
                            ? 'border-accent bg-accent/10 shadow-1'
                            : 'border-border hover:border-border-strong'
                        )}
                      >
                        {data.tipoPaspartu === opt.key && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        <span className="text-sm font-semibold text-text">{opt.label}</span>
                        <span className="text-xs text-text-muted mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Slider
                  label="Ancho del paspartú"
                  min={2}
                  max={10}
                  step={1}
                  value={data.anchoPaspartuCm}
                  onChange={(e) =>
                    onChange({ anchoPaspartuCm: Number((e.target as HTMLInputElement).value) })
                  }
                  suffix=" cm"
                />
              </div>
            )}
          </div>
        )}

        {/* Vidrio */}
        <div className="bg-surface rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-semibold text-text">Vidrio</span>
              <p className="text-xs text-text-muted mt-0.5">
                Se cotiza por metro cuadrado. Las medidas se redondean de 10 en 10 cm.
              </p>
            </div>
            <button
              onClick={() => onChange({ conVidrio: !data.conVidrio })}
              className={cn(
                'relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0',
                data.conVidrio ? 'bg-success' : 'bg-border'
              )}
              aria-label={data.conVidrio ? 'Desactivar vidrio' : 'Activar vidrio'}
            >
              <span
                className={cn(
                  'absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-1 transition-all duration-200',
                  data.conVidrio ? 'left-[23px]' : 'left-[3px]'
                )}
              />
            </button>
          </div>

          {data.conVidrio && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 pt-4">
                Tipo de vidrio
              </p>
              {vidrios && vidrios.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vidrios.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => onChange({ tipoVidrio: v.tipo })}
                      className={cn(
                        'relative flex flex-col items-start p-4 rounded-lg border-2 cursor-pointer transition-all text-left',
                        data.tipoVidrio === v.tipo
                          ? 'border-accent bg-accent/10 shadow-1'
                          : 'border-border hover:border-border-strong'
                      )}
                    >
                      {data.tipoVidrio === v.tipo && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <span className="text-sm font-semibold text-text">
                        {labelVidrio(v.tipo)}
                      </span>
                      <span className="text-xs font-medium text-accent-strong mt-1">
                        {formatCOP(v.precioM2)}/m²
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">
                  No hay tipos de vidrio configurados. Agrégalos en Listas de precios.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
