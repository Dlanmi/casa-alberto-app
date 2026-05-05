// Componente base para todos los charts de finanzas. Provee:
//   - Header (título + subtítulo opcional)
//   - Slot de controles a la derecha (selectores de período, etc.)
//   - Slot de contenido (el chart)
//   - Empty state automático cuando `isEmpty=true`
//   - Loading skeleton cuando `loading=true`
//   - Wrapper con border + shadow + padding consistente
//
// Encapsular esto evita que cada chart re-implemente título, padding, sombra,
// estados — y permite cambiar la apariencia global de todos los charts en
// un solo lugar.
import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

type ChartCardProps = {
  title: string
  subtitle?: string
  // Slot a la derecha del título — típicamente un selector de período.
  controls?: ReactNode
  loading?: boolean
  // Cuando true, en lugar del contenido se muestra un mensaje estándar
  // de "sin datos" con un mensaje opcional personalizable.
  isEmpty?: boolean
  emptyMessage?: string
  // Altura mínima del área de contenido. Recharts usa esto como referencia
  // para ResponsiveContainer.
  contentHeight?: number
  className?: string
  children?: ReactNode
  // Footer opcional debajo del chart (ej. "Total: $X" o leyenda).
  footer?: ReactNode
}

export function ChartCard({
  title,
  subtitle,
  controls,
  loading = false,
  isEmpty = false,
  emptyMessage = 'Aún no hay datos para mostrar.',
  contentHeight = 240,
  className,
  children,
  footer
}: ChartCardProps): React.JSX.Element {
  // Estados mutuamente excluyentes: si ambos vienen true, indica un bug
  // upstream (típicamente un effect que setea isEmpty antes de limpiar
  // loading). Avisamos en dev — no rompe la app.
  if (loading && isEmpty && import.meta.env.DEV) {
    console.warn(
      `ChartCard "${title}": loading=true Y isEmpty=true simultáneamente. ` +
        'Probablemente upstream no está reseteando isEmpty al re-fetch.'
    )
  }
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface shadow-1 p-5 flex flex-col gap-4',
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 min-h-12">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text truncate">{title}</h3>
          {subtitle && <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        {controls && <div className="shrink-0">{controls}</div>}
      </header>

      <div className="relative" style={{ minHeight: contentHeight }}>
        {loading ? (
          <ChartSkeleton height={contentHeight} />
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center text-sm text-text-muted"
            style={{ minHeight: contentHeight }}
            role="status"
          >
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>

      {footer && !loading && !isEmpty && (
        <footer className="text-xs text-text-muted border-t border-border pt-3">{footer}</footer>
      )}
    </div>
  )
}

/**
 * Skeleton genérico para charts. Pinta una serie de barras tenues que
 * insinúan la forma del chart sin parecer contenido real. Usa el sistema
 * de animación de Tailwind (`animate-pulse`) — sin dependencias extra.
 */
function ChartSkeleton({ height }: { height: number }): React.JSX.Element {
  return (
    <div
      className="flex items-end gap-2 px-2"
      style={{ height }}
      role="status"
      aria-label="Cargando datos"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-surface-muted animate-pulse rounded-t"
          style={{ height: `${30 + ((i * 13) % 60)}%` }}
        />
      ))}
    </div>
  )
}
