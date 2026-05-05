// MoneyField — input estándar para montos en pesos colombianos.
// Wrap de `useMoneyInput` con prefijo `$` visible y formato automático
// al perder foco (escribe "50000" → ve "$50.000" al hacer blur).
//
// Por qué existe: antes los inputs de monto eran `<input type="text">`
// crudos. Si el dueño escribía "50.000" la app leía 50, y ningún feedback
// visual lo avisaba. Centralizar aquí elimina la posibilidad de error.
import { type FocusEvent } from 'react'
import { cn } from '@renderer/lib/cn'
import { useMoneyInput } from '@renderer/lib/use-money-input'

type MoneyFieldProps = {
  label: string
  value: number
  onChange: (n: number) => void
  /** Llamado en blur DESPUÉS del reformateo del hook. */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  /** Texto del placeholder. Default '0'. */
  placeholder?: string
  /** Mensaje de error inline. Si está presente, el input se marca rojo
   *  y el mensaje aparece debajo. */
  error?: string
  /** Mensaje informativo que aparece cuando se aplica el clamp `max`.
   *  Útil para que el dueño sepa que se ajustó silente. */
  clampMessage?: string
  /** Cap superior. Si el dueño tipea más, se clampea silente. Mostrar
   *  `clampMessage` cuando esto pase es responsabilidad del padre. */
  max?: number
  /** Cap inferior — default 0 (no permite negativos). Pasar a -Infinity
   *  si se necesita explícitamente permitir negativos. */
  min?: number
  /** ID HTML para asociar la label. Si se omite se deriva del label. */
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

export function MoneyField({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '0',
  error,
  clampMessage,
  max,
  min = 0,
  id,
  className,
  disabled,
  required,
  autoFocus
}: MoneyFieldProps): React.JSX.Element {
  const moneyInput = useMoneyInput(value, onChange, { min, max })
  const fieldId = id ?? `money-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = error ? `${fieldId}-error` : undefined
  const helpId = clampMessage && !error ? `${fieldId}-help` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span aria-hidden="true" className="text-error-strong ml-0.5">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-text-soft pointer-events-none"
        >
          $
        </span>
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          value={moneyInput.raw.replace(/^\$\s*/, '')}
          onChange={moneyInput.handleChange}
          onBlur={(e) => {
            moneyInput.handleBlur()
            onBlur?.(e)
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={errorId ?? helpId}
          aria-required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            'h-11 w-full pl-7 pr-3 rounded-md border bg-surface text-sm text-text tabular-nums',
            'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-error focus:border-error focus:ring-error'
              : 'border-border focus:border-accent focus:ring-accent'
          )}
        />
      </div>
      {error && (
        <p id={errorId} className="text-xs text-error-strong">
          {error}
        </p>
      )}
      {!error && clampMessage && (
        <p id={helpId} className="text-xs text-text-muted">
          {clampMessage}
        </p>
      )}
    </div>
  )
}
