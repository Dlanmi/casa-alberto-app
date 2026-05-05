// TelefonoField — teléfono. Acepta cualquier formato (paréntesis, guiones,
// espacios, +). Al blur muestra solo dígitos. El padre recibe el valor
// canónico (digit-only) listo para guardar en DB.
import { type FocusEvent } from 'react'
import { cn } from '@renderer/lib/cn'
import { useTelefonoInput } from '@renderer/lib/use-text-input'

type TelefonoFieldProps = {
  label?: string
  value: string
  onChange: (s: string) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
  helpText?: string
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

export function TelefonoField({
  label = 'Teléfono',
  value,
  onChange,
  onBlur,
  placeholder = 'Ej: 3001234567',
  error,
  helpText = 'Solo números — puedes copiarlo con espacios o guiones, los quitamos',
  id,
  className,
  disabled,
  required,
  autoFocus
}: TelefonoFieldProps): React.JSX.Element {
  const input = useTelefonoInput(value, onChange)
  const fieldId = id ?? 'telefono-field'
  const errorId = error ? `${fieldId}-error` : undefined
  const helpId = helpText && !error ? `${fieldId}-help` : undefined

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
      <input
        id={fieldId}
        type="tel"
        inputMode="tel"
        value={input.raw}
        onChange={input.handleChange}
        onBlur={(e) => {
          input.handleBlur()
          onBlur?.(e)
        }}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={errorId ?? helpId}
        aria-required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="tel"
        className={cn(
          'h-11 w-full px-3 rounded-md border bg-surface text-sm text-text tabular-nums',
          'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-error focus:border-error focus:ring-error'
            : 'border-border focus:border-accent focus:ring-accent'
        )}
      />
      {error && (
        <p id={errorId} className="text-xs text-error-strong">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={helpId} className="text-xs text-text-muted">
          {helpText}
        </p>
      )}
    </div>
  )
}
