import { cn } from '@renderer/lib/cn'
import { formatCOP } from '@renderer/lib/format'

type PrecioDisplayProps = {
  value: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PrecioDisplay({ value, size = 'md', className }: PrecioDisplayProps) {
  return (
    <span
      className={cn(
        'tabular-nums font-semibold',
        size === 'sm' && 'text-sm',
        size === 'md' && 'text-base',
        size === 'lg' && 'text-2xl',
        className
      )}
    >
      {formatCOP(value)}
    </span>
  )
}
