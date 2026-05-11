// Toggle switch reutilizable — patrón estándar del cotizador y los paneles
// de pedidos. Pista 48×28, thumb 22×22 con animación de deslizamiento.
// Active = bg-success (verde, "activado"), inactive = bg-border (gris,
// "apagado"). Antes este markup se repetía 6 veces inline; ahora vive en
// un solo lugar para que cambios al diseño (tamaño, color, animación) se
// propaguen automáticamente.
//
// NOTA — la pantalla de Configuración tiene su propio toggle con `bg-accent`
// y `translate-x` (no `left`), porque semánticamente representa identidad
// del usuario, no estado activo de una opción. Esa variante NO debe usar
// este componente.
import { forwardRef } from 'react'
import { cn } from '@renderer/lib/cn'

type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
  /** Color del fondo cuando checked. Default `success` (acción "activado").
   *  Usar `warning` cuando el "activado" indica alerta/urgencia (ej. marcar
   *  un pedido como urgente). */
  tone?: 'success' | 'warning'
  className?: string
}

const TONE_BG: Record<NonNullable<ToggleProps['tone']>, string> = {
  success: 'bg-success',
  warning: 'bg-warning'
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, ariaLabel, disabled, tone = 'success', className },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? TONE_BG[tone] : 'bg-border',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-1 transition-all duration-base',
          checked ? 'left-[23px]' : 'left-[3px]'
        )}
      />
    </button>
  )
})
