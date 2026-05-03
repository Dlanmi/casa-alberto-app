import { useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/cn'
import { formatCOP } from '@renderer/lib/format'

type PrecioDisplayProps = {
  value: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PrecioDisplay({ value, size = 'md', className }: PrecioDisplayProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevValue = useRef(value)

  // Re-aplica la clase de flash cada vez que el valor cambia. Mount inicial
  // no flashea (prevValue === value). Forzamos reflow para reiniciar la
  // animación si dispara durante una activa.
  useEffect(() => {
    if (prevValue.current === value) return
    const el = ref.current
    if (!el) {
      prevValue.current = value
      return
    }
    const flashClass = size === 'lg' ? 'animate-price-flash-emphasis' : 'animate-price-flash'
    el.classList.remove(flashClass)
    void el.offsetWidth
    el.classList.add(flashClass)
    prevValue.current = value
  }, [value, size])

  return (
    <span
      ref={ref}
      className={cn(
        'tabular-nums font-semibold inline-block rounded-sm',
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
