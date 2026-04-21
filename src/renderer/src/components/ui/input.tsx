import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, inputMode, pattern, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const describedBy = [
      error ? `${inputId}-error` : null,
      hint && !error ? `${inputId}-hint` : null
    ]
      .filter(Boolean)
      .join(' ')

    // En Chromium/Electron, type="number" renderiza spinners nativos
    // (::-webkit-inner-spin-button / ::-webkit-outer-spin-button) que
    // interrumpen el borde derecho y el focus-ring — el bug que el dueño
    // reportó en el wizard. `appearance: none` no es suficiente; Chromium
    // sigue reservando layout interno. Mapeamos number → text + inputMode
    // numeric para renderizar limpio en desktop y conservar el teclado
    // numérico en móvil. min/max se validan en la lógica de negocio.
    const isNumeric = type === 'number'
    const effectiveType = isNumeric ? 'text' : type
    const effectiveInputMode = isNumeric ? (inputMode ?? 'numeric') : inputMode
    const effectivePattern = isNumeric ? (pattern ?? '[0-9]*') : pattern

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          inputMode={effectiveInputMode}
          pattern={effectivePattern}
          className={cn(
            'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text shadow-inset-input',
            'placeholder:text-text-soft',
            // Focus: solo cambio de color de borde (neutral → accent ámbar).
            // Sin ring/outline por fuera — se salían del padre cuando el
            // input es w-full dentro de grids ajustados (ver step-medidas).
            // El outline global de :focus-visible está excluido para inputs
            // en main.css, así que aquí solo hace falta el cambio de border.
            'focus:border-accent focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-error focus:border-error focus:ring-error/30',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-error-strong">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
