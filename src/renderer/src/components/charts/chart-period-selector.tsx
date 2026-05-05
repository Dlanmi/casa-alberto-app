// Selector compacto de período para los charts. Acepta un subset de claves
// y muestra solo esas opciones — distintos charts piden distintos rangos
// (ej. mes-vs-mes solo expone 3/6/12 meses; top-clientes incluye año actual).
import { CHART_PERIODS, type ChartPeriodKey } from '@renderer/hooks/use-chart-period'
import { cn } from '@renderer/lib/cn'

type ChartPeriodSelectorProps = {
  value: ChartPeriodKey
  onChange: (k: ChartPeriodKey) => void
  // Subset de keys a mostrar — si se omite, muestra todas.
  options?: ChartPeriodKey[]
  // Estilo: 'tabs' (compacto, segmentado) o 'select' (dropdown nativo).
  // Default 'tabs' para charts pequeños.
  variant?: 'tabs' | 'select'
}

export function ChartPeriodSelector({
  value,
  onChange,
  options,
  variant = 'tabs'
}: ChartPeriodSelectorProps): React.JSX.Element {
  const visibles = options ? CHART_PERIODS.filter((p) => options.includes(p.key)) : CHART_PERIODS

  if (variant === 'select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ChartPeriodKey)}
        className="h-9 px-3 text-sm rounded-md border border-border bg-surface text-text cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="Seleccionar período"
      >
        {visibles.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      role="tablist"
      aria-label="Seleccionar período"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-surface-muted border border-border"
    >
      {visibles.map((p) => {
        const active = p.key === value
        return (
          <button
            key={p.key}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer min-h-8',
              active ? 'bg-surface text-text shadow-1' : 'text-text-muted hover:text-text'
            )}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
