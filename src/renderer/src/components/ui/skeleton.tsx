import { cn } from '@renderer/lib/cn'

type SkeletonProps = {
  className?: string
  width?: string | number
  height?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ className, width, height, style }: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({
  className,
  lines = 1,
  lastLineWidth = '60%'
}: {
  className?: string
  lines?: number
  lastLineWidth?: string
}): React.JSX.Element {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded-sm"
          style={{ width: i === lines - 1 && lines > 1 ? lastLineWidth : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCircle({
  size = 36,
  className
}: {
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn('skeleton rounded-full', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

export function MetricSkeleton({ count = 3 }: { count?: number }): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Cargando métricas">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={36} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }): React.JSX.Element {
  return (
    <div
      className="bg-surface rounded-lg border border-border p-6"
      aria-busy="true"
      aria-label="Cargando tabla"
    >
      <div className="flex gap-4 mb-4 border-b border-border pb-3">
        {[2, 3, 4, 2, 1].map((flex, i) => (
          <Skeleton key={i} className="h-3" style={{ flex }} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center py-2">
            {[2, 3, 4, 2, 1].map((flex, j) => (
              <Skeleton key={j} className="h-4" style={{ flex }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
