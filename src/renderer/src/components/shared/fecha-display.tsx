import { cn } from '@renderer/lib/cn'
import { formatFechaLarga, formatFechaRelativa } from '@renderer/lib/format'

type FechaDisplayProps = {
  fecha: string
  relative?: boolean
  className?: string
}

export function FechaDisplay({ fecha, relative = false, className }: FechaDisplayProps) {
  const display = relative ? formatFechaRelativa(fecha) : formatFechaLarga(fecha)
  return (
    <span className={cn('text-sm text-text-muted', className)} title={formatFechaLarga(fecha)}>
      {display}
    </span>
  )
}
