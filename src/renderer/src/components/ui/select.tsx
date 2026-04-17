import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const hintId = error ? `${selectId}-error` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text shadow-inset-input',
            'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-error focus:border-error focus:ring-error',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={hintId}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={hintId} className="text-xs text-error-strong">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'
