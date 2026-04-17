import { cn } from '@renderer/lib/cn'
import { formatCOP } from '@renderer/lib/format'

type PagoBarProps = {
  total: number
  pagado: number
  className?: string
  showLabels?: boolean
}

export function PagoBar({
  total,
  pagado,
  className,
  showLabels = false
}: PagoBarProps): React.JSX.Element {
  const porcentaje = total > 0 ? Math.min((pagado / total) * 100, 100) : 0
  const completo = total > 0 && pagado >= total
  const toneClass = completo ? 'bg-success' : porcentaje > 0 ? 'bg-warning' : 'bg-border-strong'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full transition-all progress-bar', toneClass)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs tabular-nums">
          <span className="whitespace-nowrap text-text-muted">
            {formatCOP(pagado)} de {formatCOP(total)}
          </span>
          <span
            className={cn(
              'whitespace-nowrap font-medium',
              completo
                ? 'text-success-strong'
                : porcentaje > 0
                  ? 'text-warning-strong'
                  : 'text-text-soft'
            )}
          >
            {completo ? 'Pagado' : `${Math.round(porcentaje)}%`}
          </span>
        </div>
      )}
    </div>
  )
}
