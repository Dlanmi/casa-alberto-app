// TextField — input/textarea con trim automático, max length visible y
// sanitización de control chars. Reemplaza el `<Input>` plano cuando se
// necesita garantía de datos limpios al guardar.
import { type FocusEvent, type ChangeEvent } from 'react'
import { cn } from '@renderer/lib/cn'
import { useTextInput } from '@renderer/lib/use-text-input'

type TextFieldProps = {
  label: string
  value: string
  onChange: (s: string) => void
  onBlur?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  error?: string
  helpText?: string
  /** Si se pasa, muestra un contador "X / max" y trunca al escribir. */
  maxLength?: number
  /** Si true renderiza textarea en vez de input. */
  multiline?: boolean
  /** Filas iniciales del textarea cuando multiline=true. */
  rows?: number
  /** Si false, NO sanitiza control chars (raro). Default true. */
  sanitizeControl?: boolean
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  /** Type del input cuando NO es multiline. Default 'text'. */
  type?: 'text' | 'email' | 'tel' | 'url'
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helpText,
  maxLength,
  multiline,
  rows = 3,
  sanitizeControl = true,
  id,
  className,
  disabled,
  required,
  autoFocus,
  type = 'text'
}: TextFieldProps): React.JSX.Element {
  const input = useTextInput(value, onChange, { maxLength, sanitizeControl })
  const fieldId = id ?? `text-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = error ? `${fieldId}-error` : undefined
  const helpId = helpText && !error ? `${fieldId}-help` : undefined
  const showCounter = maxLength != null && maxLength > 20

  // Tipo unificado del onChange para input y textarea — ambos comparten la
  // misma firma del hook.
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    input.handleChange(e)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
          {required && (
            <span aria-hidden="true" className="text-error-strong ml-0.5">
              *
            </span>
          )}
        </label>
        {showCounter && (
          <span className="text-xs text-text-soft tabular-nums" aria-live="polite">
            {input.raw.length} / {maxLength}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          id={fieldId}
          rows={rows}
          value={input.raw}
          onChange={handleChange}
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
          maxLength={maxLength}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-surface text-sm text-text',
            'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-16',
            error
              ? 'border-error focus:border-error focus:ring-error'
              : 'border-border focus:border-accent focus:ring-accent'
          )}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={input.raw}
          onChange={handleChange}
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
          maxLength={maxLength}
          className={cn(
            'h-11 w-full px-3 rounded-md border bg-surface text-sm text-text',
            'shadow-(--shadow-inset-input) focus:outline-none focus:ring-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-error focus:border-error focus:ring-error'
              : 'border-border focus:border-accent focus:ring-accent'
          )}
        />
      )}
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
