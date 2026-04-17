import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const describedBy = [
      error ? `${inputId}-error` : null,
      hint && !error ? `${inputId}-hint` : null
    ]
      .filter(Boolean)
      .join(' ')

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
          className={cn(
            'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text shadow-inset-input',
            'placeholder:text-text-soft',
            // Halo sutil: el ring usa accent semi-transparente separado del
            // border para evitar el "doble borde" visual que el dueño reportó.
            'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
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
