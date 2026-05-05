// NumberField — input numérico genérico (decimales o enteros).
// Para montos en pesos usar `<MoneyField>` (formato distinto).
//
// Modo decimal: medidas en cm con coma o punto ("43,32" o "43.32"). Reformatea
// a "43.32" en blur.
// Modo entero: cantidades, stock, contadores. Rechaza decimales y letras.
import { type FocusEvent } from 'react'
import { cn } from '@renderer/lib/cn'
import { useDecimalInput } from '@renderer/lib/use-decimal-input'
import { useIntegerInput } from '@renderer/lib/use-integer-input'

type NumberFieldProps = {
  label: string
  value: number
  onChange: (n: number) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  /** Si 'integer', no acepta decimales. Default 'decimal'. */
  mode?: 'decimal' | 'integer'
  placeholder?: string
  error?: string
  clampMessage?: string
  min?: number
  max?: number
  step?: number
  /** Sufijo visible al final del input (ej. "cm", "kg"). */
  suffix?: string
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

export function NumberField(props: NumberFieldProps): React.JSX.Element {
  const { mode = 'decimal' } = props
  if (mode === 'integer') {
    return <IntegerFieldInner {...props} />
  }
  return <DecimalFieldInner {...props} />
}

function DecimalFieldInner({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '0',
  error,
  clampMessage,
  min = 0,
  max,
  step,
  suffix,
  id,
  className,
  disabled,
  required,
  autoFocus
}: NumberFieldProps): React.JSX.Element {
  const input = useDecimalInput(value, onChange, { min, max })
  return (
    <FieldShell
      label={label}
      id={id}
      error={error}
      clampMessage={clampMessage}
      required={required}
      className={className}
    >
      {(fieldId, errorId, helpId) => (
        <div className="relative">
          <input
            id={fieldId}
            type="text"
            inputMode="decimal"
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
            step={step}
            className={cn(
              'h-11 w-full px-3 rounded-md border bg-surface text-sm text-text tabular-nums',
              'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              suffix && 'pr-10',
              error
                ? 'border-error focus:border-error focus:ring-error'
                : 'border-border focus:border-accent focus:ring-accent'
            )}
          />
          {suffix && (
            <span
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-soft pointer-events-none"
            >
              {suffix}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  )
}

function IntegerFieldInner({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '0',
  error,
  clampMessage,
  min = 0,
  max,
  suffix,
  id,
  className,
  disabled,
  required,
  autoFocus
}: NumberFieldProps): React.JSX.Element {
  const input = useIntegerInput(value, onChange, { min, max })
  return (
    <FieldShell
      label={label}
      id={id}
      error={error}
      clampMessage={clampMessage}
      required={required}
      className={className}
    >
      {(fieldId, errorId, helpId) => (
        <div className="relative">
          <input
            id={fieldId}
            type="text"
            inputMode="numeric"
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
            className={cn(
              'h-11 w-full px-3 rounded-md border bg-surface text-sm text-text tabular-nums',
              'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              suffix && 'pr-10',
              error
                ? 'border-error focus:border-error focus:ring-error'
                : 'border-border focus:border-accent focus:ring-accent'
            )}
          />
          {suffix && (
            <span
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-soft pointer-events-none"
            >
              {suffix}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  )
}

// Shell común: label + slot para input + error/help. Reduce duplicación
// entre las dos variantes (decimal/integer).
type FieldShellProps = {
  label: string
  id?: string
  error?: string
  clampMessage?: string
  required?: boolean
  className?: string
  children: (fieldId: string, errorId: string | undefined, helpId: string | undefined) => React.ReactNode
}

function FieldShell({
  label,
  id,
  error,
  clampMessage,
  required,
  className,
  children
}: FieldShellProps): React.JSX.Element {
  const fieldId = id ?? `num-${label.toLowerCase().replace(/\s+/g, '-')}`
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
      {children(fieldId, errorId, helpId)}
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
